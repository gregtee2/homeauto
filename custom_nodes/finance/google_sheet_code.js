/* jshint esversion: 6 */

function importCSVData() {
  Logger.log("Script started");

  try {
    // Get the active spreadsheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get the CSVData sheet
    const csvSheet = spreadsheet.getSheetByName("CSVData");
    
    if (!csvSheet) {
      Logger.log("CSVData sheet not found.");
      return;
    }

    // Get all data from CSVData sheet
    const csvRange = csvSheet.getDataRange();
    const parsedData = csvRange.getValues();
    
    Logger.log("Parsed CSV Rows: " + parsedData.length);

    if (parsedData.length < 2) {
      Logger.log("No data rows found.");
      return;
    }

    // Get the output sheet (ProcessedData)
    let sheet = spreadsheet.getSheetByName("ProcessedData");
    if (!sheet) {
      // If the sheet doesn't exist, create it
      sheet = spreadsheet.insertSheet("ProcessedData");
      Logger.log("ProcessedData sheet created.");
    } else {
      // Clear existing content
      sheet.clear();
      Logger.log("ProcessedData sheet cleared.");
    }
    
    // Set the headers for the Google Sheet
    // Renamed "Debit Paid" to "Cost to Close"
    const headers = ["Date Opened", "Date Closed", "Ticker", "Call/Put", "Strike", "Expiration", "Quantity", "Premium Received", "Cost to Close", "Fees", "Gain/Loss", "Status", "Days to Expiry"];
    sheet.appendRow(headers);
    Logger.log("Headers added");

    // Data structure to track open positions by unique option key
    const openPositions = {}; // key: Symbol|Call/Put|Strike|Expiration, value: array of positions

    // Helper function to parse dollar amounts
    function parseDollar(amountInput) {
      if (amountInput === null || amountInput === undefined || amountInput === "") return 0;
      
      // Convert to string if it's not already
      const amountStr = typeof amountInput === 'string' ? amountInput : amountInput.toString();
      
      // Remove $ and commas, then parse as float
      const parsed = parseFloat(amountStr.replace(/[$,]/g, ''));
      
      return isNaN(parsed) ? 0 : parsed;
    }

    // Define action priorities
    const actionPriority = {
      "sell to open": 1,
      "buy to open": 2,
      "sell to close": 3,
      "buy to close": 4
    };

    // Extract header and data rows
    const headerRow = parsedData[0];
    const dataRows = parsedData.slice(1);

    // Function to convert date inputs to Date objects
    function parseDate(dateInput) {
      if (typeof dateInput === 'string') {
        const primaryDateMatch = dateInput.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (primaryDateMatch) {
          return new Date(primaryDateMatch[1]);
        }
        return new Date(dateInput);
      } else if (dateInput instanceof Date) {
        return dateInput;
      } else {
        Logger.log("Unexpected date type: " + typeof dateInput + " | Value: " + dateInput);
        return new Date(); 
      }
    }

    // Sort dataRows by Date ascending and Action priority
    dataRows.sort(function(a, b) {
      const dateA = parseDate(a[0]);
      const dateB = parseDate(b[0]);

      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;

      const actionA = a[1] ? a[1].toString().trim().toLowerCase() : "";
      const actionB = b[1] ? b[1].toString().trim().toLowerCase() : "";

      const priorityA = actionPriority[actionA] || 5;
      const priorityB = actionPriority[actionB] || 5;

      return priorityA - priorityB;
    });

    Logger.log("Data rows sorted.");

    // Temporary array to hold processed rows
    const processedRows = [];

    // Iterate over the sorted rows
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const dateInput = row[0];
      const actionRaw = row[1];
      let action = actionRaw ? row[1].toString().trim().toLowerCase() : "";
      if (action.includes("assigned")) {
          action = "assigned";
      }
      const symbolFull = row[2];
      const description = row[3];
      const quantity = row[4];
      const fees = parseDollar(row[6]);
      let amount = parseDollar(row[7]);

      // Log the action value and date input
      Logger.log(`Row ${i + 2} Action: '${action}'`);
      Logger.log(`Row ${i + 2} Date Input Type: ${typeof dateInput} | Value: ${dateInput}`);

      // Extract the actual symbol
      const symbolMatch = symbolFull.match(/^[A-Za-z]+/);
      const symbol = symbolMatch ? symbolMatch[0] : symbolFull;

      Logger.log(`Processing row ${i + 2}: ${action} ${symbol}`);

      if (["sell to open", "buy to close", "buy to open", "sell to close"].includes(action)) {
        let strategyLabel = ""; // For display in the sheet
        let baseCallPut = "";   // For key matching

        // Determine whether the option is a PUT or CALL and handle accordingly
        if (description.includes("PUT")) {
          strategyLabel = action === "sell to open" ? "CSP" : "Put";
          baseCallPut = "Put";
        } else if (description.includes("CALL")) {
          strategyLabel = action === "sell to open" ? "CC" : "Call";
          baseCallPut = "Call";
        } else {
          Logger.log(`Unknown option type in description: ${description}`);
          continue;
        }

        // Extract strike price and expiration date from the description
        const strikeMatch = description.match(/\$(\d+(\.\d+)?)\s+EXP/);
        const strike = strikeMatch ? strikeMatch[1] : "";
        if (!strike) {
          Logger.log(`Strike price not found in description: ${description}`);
          continue;
        }

        const expirationMatch = description.match(/EXP\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        const expiration = expirationMatch ? expirationMatch[1] : "";
        if (!expiration) {
          Logger.log(`Expiration date not found in description: ${description}`);
          continue;
        }

        const key = `${symbol}|${baseCallPut}|${strike}|${expiration}|${quantity}`;

        const expirationDate = new Date(expiration);
        if (isNaN(expirationDate)) {
          Logger.log(`Invalid expiration date format: ${expiration}`);
          continue;
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        expirationDate.setHours(0, 0, 0, 0);
        let daysToExpiry = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));

        // Log generated key and expiration information
        Logger.log(`Generated Key: ${key} | Expiration Date: ${expiration} | Days to Expiry: ${daysToExpiry}`);

        // Handling 'sell to open' or 'buy to open' actions
        if (action === "sell to open" || action === "buy to open") {
          if (!openPositions[key]) {
            openPositions[key] = [];
          }

          let premiumReceived = 0;
          let costToClose = 0;

          if (action === "sell to open") {
            premiumReceived = amount;
          } else if (action === "buy to open") {
            costToClose = Math.abs(amount);
          }

          openPositions[key].push({
            dateOpened: parseDate(dateInput),
            ticker: symbol,
            callPut: strategyLabel,
            strike: strike,
            expiration: expiration,
            daysToExpiry: daysToExpiry,
            quantity: parseFloat(quantity) || 0,
            premiumReceived: premiumReceived,
            costToClose: costToClose,
            fees: fees
          });

          Logger.log(`Opened position: ${key} | Premium Received: ${premiumReceived} | Cost to Close: ${costToClose} | Days to Expiry: ${daysToExpiry}`);
        }

        if (action === "buy to close" || action === "sell to close" || action === "assigned") {
            if (openPositions[key] && openPositions[key].length > 0) {
                const openPos = openPositions[key].shift();  // Get the open position

                // Adjust amount if 'buy to close'
                if (action === "buy to close") {
                    amount = Math.abs(amount);
                }

                let gainLoss = 0;
                let dateClosed = parseDate(dateInput);
                let daysHeld = Math.ceil((dateClosed.getTime() - openPos.dateOpened.getTime()) / (1000 * 3600 * 24));

                if (action === "buy to close") {
                    gainLoss = openPos.premiumReceived - amount - openPos.fees;
                } else if (action === "sell to close" || action === "assigned") {
                    gainLoss = amount - openPos.costToClose - openPos.fees;
                }

                // Determine the status based on the action
                const status = (action === "assigned") ? "Assigned" : "Closed";

                processedRows.push([
                    Utilities.formatDate(openPos.dateOpened, spreadsheet.getSpreadsheetTimeZone(), "MM/dd/yyyy"),
                    Utilities.formatDate(dateClosed, spreadsheet.getSpreadsheetTimeZone(), "MM/dd/yyyy"),
                    openPos.ticker,
                    openPos.callPut, // Use strategyLabel
                    openPos.strike,
                    openPos.expiration,
                    openPos.quantity,
                    openPos.premiumReceived,
                    amount,
                    openPos.fees,
                    gainLoss,
                    status,
                    daysHeld
                ]);

                Logger.log(`Closed or Assigned position: ${key} | Gain/Loss: ${gainLoss} | Days Held: ${daysHeld}`);

                // Remove the position if it's closed or assigned
                if (openPositions[key].length === 0) {
                    delete openPositions[key];
                }
            } else {
                Logger.log(`No open position found to close or assign for key: ${key}`);
            }
        }
        
        // If the position is still open, update the remaining days to expiry
        if (openPositions[key] && openPositions[key].length > 0) {
          for (let i = 0; i < openPositions[key].length; i++) {
            openPositions[key][i].daysToExpiry = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
            Logger.log(`Updated Days to Expiry for open position: ${key} | Days to Expiry: ${openPositions[key][i].daysToExpiry}`);
          }
        }
      }
    }



     for (const key in openPositions) {
      if (openPositions.hasOwnProperty(key)) { 
        while (openPositions[key].length > 0) {
          const openPos = openPositions[key].shift();
          let daysToExpiry = openPos.daysToExpiry;

          let status = "Open";
          let gainLoss = ""; 
          let dateClosed = ""; 

          if (daysToExpiry <= 0) {
            status = "Expired";

            if (openPos.premiumReceived > 0) {
              gainLoss = openPos.premiumReceived - openPos.fees;
            } else if (openPos.costToClose > 0) {
              gainLoss = -openPos.costToClose - openPos.fees;
            }

            dateClosed = openPos.expiration;
            // Calculate Days Held (from dateOpened to expiration)
            const expirationDate = new Date(openPos.expiration);
            expirationDate.setHours(0, 0, 0, 0);
            const daysHeld = Math.ceil((expirationDate.getTime() - openPos.dateOpened.getTime()) / (1000 * 3600 * 24));

            processedRows.push([
              Utilities.formatDate(openPos.dateOpened, spreadsheet.getSpreadsheetTimeZone(), "MM/dd/yyyy"),
              dateClosed, 
              openPos.ticker,
              openPos.callPut,
              openPos.strike,
              openPos.expiration,
              openPos.quantity,
              openPos.premiumReceived,
              openPos.costToClose,
              openPos.fees,
              gainLoss,
              status,
              daysHeld // Use Days Held if the position is closed
            ]);

            Logger.log(`Processed expired position: ${key} | Gain/Loss: ${gainLoss} | Days Held: ${daysHeld}`);
          } else {
            // Position is still open, so calculate days until expiry
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const expDate = new Date(openPos.expiration);
            expDate.setHours(0, 0, 0, 0);
            const timeDiff = expDate.getTime() - currentDate.getTime();
            daysToExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

            processedRows.push([
              Utilities.formatDate(openPos.dateOpened, spreadsheet.getSpreadsheetTimeZone(), "MM/dd/yyyy"),
              "", // Date Closed is empty for open positions
              openPos.ticker,
              openPos.callPut,
              openPos.strike,
              openPos.expiration,
              openPos.quantity,
              openPos.premiumReceived,
              openPos.costToClose,
              openPos.fees,
              "", // Gain/Loss is empty for open positions
              status,
              daysToExpiry // Days to Expiry for open positions
            ]);

            Logger.log(`Processed open position: ${key} | Status: ${status} | Days to Expiry: ${daysToExpiry}`);
          }
        }
      }
    }

    // Batch append processed rows to the sheet
    if (processedRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, processedRows.length, processedRows[0].length).setValues(processedRows);
      Logger.log(`Appended ${processedRows.length} rows to ProcessedData sheet.`);
    }

    // Format the "Days to Expiry" column as a number
    const lastRow = sheet.getLastRow();
    const daysToExpiryColumn = 13; // "Days to Expiry" is the 13th column

    if (lastRow >= 2) { // Ensure there are data rows
      const daysRange = sheet.getRange(2, daysToExpiryColumn, lastRow - 1, 1);
      daysRange.setNumberFormat("0"); // Set format to integer
      Logger.log("Formatted 'Days to Expiry' column as Number.");
    }

    // Sort the sheet by Status and Days to Expiry
    if (lastRow > 1) {
      const lastColumn = sheet.getLastColumn(); // Ensure lastColumn is defined
      const sortRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);

      const statusOrder = {
        "Expired": 1,
        "Closed": 2,
        "Rolled": 3,
        "Open": 4
      };

      const dataToSort = sortRange.getValues();

      dataToSort.sort((a, b) => {
        const statusA = a[11]; 
        const statusB = b[11];
        
        const statusOrderA = statusOrder[statusA] || 5; 
        const statusOrderB = statusOrder[statusB] || 5;

        if (statusOrderA < statusOrderB) return -1;
        if (statusOrderA > statusOrderB) return 1;

        const daysA = a[12]; 
        const daysB = b[12];

        return daysA - daysB;
      });

      sortRange.setValues(dataToSort);

      Logger.log("ProcessedData sheet sorted by Status and Days to Expiry.");
    }

    Logger.log("Script completed");
  } catch (error) {
    Logger.log("An error occurred: " + error);
  }
} // Close importCSVData
