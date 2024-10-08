// Option Roll Cost Calculator Node for LightGraph
class OptionRollCostCalculatorNode {
  constructor() {
    this.title = "Option Roll Cost Calculator";

    // Node properties with default values
    this.properties = {
      contracts: 1, // Number of contracts
      existingStrikePrice: 200, // Existing Strike Price ($)
      newStrikePrice: 210, // New Strike Price ($)
      costToClose: 3.35, // Cost to close existing position ($)
      premiumReceived: 10, // Premium received from new option ($)
      delta: 0.33, // Delta of the new option
      sharePrice: 215, // Current share price ($), will be fetched
      sharesToBuy: 0, // Calculated number of shares to buy
      totalCostOrCredit: 0, // Calculated total cost or credit (numeric value)
      stockSymbol: "AAPL", // Default stock symbol
      alphaVantageAPIKey: "8P3LI5AQ3Q4URZ7K", // Your Alpha Vantage API Key
      proxyUsername: "", // Username for proxy authentication
      proxyPassword: "", // Password for proxy authentication
      errorMessage: "", // To store error messages
    };

    // Adding widgets to allow users to manually input values

    // Stock Symbol
    this.addWidget(
      "string",
      "Stock Symbol",
      this.properties.stockSymbol,
      "stockSymbol",
      {
        placeholder: "e.g., AAPL",
        tooltip: "Enter the ticker symbol of the underlying stock.",
      }
    );

    // Alpha Vantage API Key
    this.addWidget(
      "string",
      "Alpha Vantage API Key",
      this.properties.alphaVantageAPIKey,
      "alphaVantageAPIKey",
      {
        placeholder: "Enter your API key",
        tooltip: "Your Alpha Vantage API key for fetching real-time data.",
      }
    );

    // Proxy Username
    this.addWidget(
      "string",
      "Proxy Username",
      this.properties.proxyUsername,
      "proxyUsername",
      {
        placeholder: "Proxy Username",
        tooltip: "Username for authenticating with the proxy server.",
      }
    );

    // Proxy Password
    this.addWidget(
      "password",
      "Proxy Password",
      this.properties.proxyPassword,
      "proxyPassword",
      {
        placeholder: "Proxy Password",
        tooltip: "Password for authenticating with the proxy server.",
      }
    );

    // Refresh Button
    this.addWidget(
      "button",
      "Refresh Price",
      () => this.fetchStockPrice(),
      "refreshPrice",
      {
        tooltip: "Click to fetch the latest share price.",
      }
    );

    // Number of Contracts
    this.addWidget(
      "number",
      "Contracts",
      this.properties.contracts,
      "contracts",
      {
        min: 1,
        step: 1,
        tooltip: "Enter the number of option contracts you are rolling.",
      }
    );

    // Existing Strike Price
    this.addWidget(
      "number",
      "Existing Strike Price ($)",
      this.properties.existingStrikePrice,
      "existingStrikePrice",
      {
        min: 0,
        tooltip: "Enter the strike price of the existing option.",
      }
    );

    // New Strike Price
    this.addWidget(
      "number",
      "New Strike Price ($)",
      this.properties.newStrikePrice,
      "newStrikePrice",
      {
        min: 0,
        tooltip: "Enter the strike price of the new option.",
      }
    );

    // Cost to Close
    this.addWidget(
      "number",
      "Cost to Close ($)",
      this.properties.costToClose,
      "costToClose",
      {
        min: 0,
        tooltip: "Enter the cost to close the existing option position.",
      }
    );

    // Premium Received
    this.addWidget(
      "number",
      "Premium Received ($)",
      this.properties.premiumReceived,
      "premiumReceived",
      {
        min: 0,
        tooltip: "Enter the premium received from selling the new option.",
      }
    );

    // Delta
    this.addWidget("number", "Delta", this.properties.delta, "delta", {
      min: 0,
      max: 1,
      step: 0.01,
      tooltip: "Enter the delta of the new option.",
    });

    // Share Price (Read-Only)
    this.addWidget(
      "number",
      "Share Price ($)",
      this.properties.sharePrice,
      "sharePrice",
      {
        min: 0,
        readonly: true,
        tooltip: "Latest share price fetched from Alpha Vantage.",
      }
    );

    // Number of Shares to Buy (Read-only)
    this.addWidget(
      "text",
      "Number of Shares to Buy",
      this.properties.sharesToBuy,
      "sharesToBuy",
      {
        readonly: true,
        tooltip: "Calculated number of shares to buy for hedging.",
      }
    );

    // Error Message Display
    this.addWidget(
      "text",
      "Error Message",
      this.properties.errorMessage,
      "errorMessage",
      {
        readonly: true,
        multiline: true,
        textColor: "red",
        tooltip: "Displays any errors encountered during data fetching.",
      }
    );

    // Export Report Button (Optional)
    this.addWidget(
      "button",
      "Export Report",
      () => this.exportReport(),
      null,
      {
        tooltip: "Click to export the current report.",
      }
    );

    // Initialize by fetching the latest stock price
    this.onExecute();
    this.fetchStockPrice(); // Fetch initial price
  }

  /**
   * Called whenever a property changes (e.g., user updates input fields).
   * This ensures that calculations are re-executed in real-time.
   * @param {string} name - The name of the property that changed.
   * @param {*} value - The new value of the property.
   */
  onPropertyChanged(name, value) {
    if (name === "stockSymbol" || name === "alphaVantageAPIKey" || name === "proxyUsername" || name === "proxyPassword") {
      // If stock symbol, API key, or proxy credentials change, fetch the latest price
      this.fetchStockPrice();
    } else {
      this.onExecute();
    }
  }

  /**
   * Fetches the latest stock price from Alpha Vantage using your own proxy.
   */
  fetchStockPrice() {
    const symbol = this.properties.stockSymbol.trim();
    const apiKey = this.properties.alphaVantageAPIKey.trim();
    const proxyUsername = this.properties.proxyUsername.trim();
    const proxyPassword = this.properties.proxyPassword.trim();

    if (!symbol) {
      this.setProperty("errorMessage", "Please enter a stock symbol.");
      return;
    }

    if (!apiKey) {
      this.setProperty("errorMessage", "Please enter your Alpha Vantage API key.");
      return;
    }

    if (!proxyUsername || !proxyPassword) {
      this.setProperty("errorMessage", "Please enter your proxy credentials.");
      return;
    }

    // Using your own proxy
    const proxyUrl = "http://localhost:3000/proxy?url="; // Replace with your server's address if different
    const targetUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      symbol
    )}&apikey=${encodeURIComponent(apiKey)}`;

    const url = proxyUrl + encodeURIComponent(targetUrl);

    // Disable the refresh button to prevent multiple clicks
    const refreshButton = this.widgets.refreshPrice;
    if (refreshButton && refreshButton.dom) {
      refreshButton.dom.disabled = true;
      refreshButton.dom.innerText = "Refreshing...";
    }

    // Clear previous error messages
    this.setProperty("errorMessage", "");

    // Encode proxy credentials for Basic Auth
    const credentials = btoa(`${proxyUsername}:${proxyPassword}`);

    fetch(url, {
      headers: {
        'Authorization': 'Basic ' + credentials,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data["Global Quote"] && data["Global Quote"]["05. price"]) {
          const latestPrice = parseFloat(data["Global Quote"]["05. price"]);
          if (!isNaN(latestPrice)) {
            this.setProperty("sharePrice", latestPrice);
            this.onExecute(); // Re-run calculations with the new share price
          } else {
            this.setProperty("errorMessage", "Invalid price data received.");
          }
        } else if (data["Note"]) {
          // Handle API rate limit message
          this.setProperty(
            "errorMessage",
            "API rate limit exceeded. Please wait and try again."
          );
        } else {
          this.setProperty(
            "errorMessage",
            "Failed to fetch data. Please check the stock symbol and API key."
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching stock price:", error);
        this.setProperty("errorMessage", "Error fetching stock price.");
      })
      .finally(() => {
        // Re-enable the refresh button
        if (refreshButton && refreshButton.dom) {
          refreshButton.dom.disabled = false;
          refreshButton.dom.innerText = "Refresh Price";
        }
      });
  }

  /**
   * Core execution method that performs calculations based on input properties
   * and updates the relevant output properties.
   */
  onExecute() {
    // Retrieve and parse input property values
    const contracts = parseInt(this.properties.contracts, 10);
    const existingStrikePrice = parseFloat(this.properties.existingStrikePrice);
    const newStrikePrice = parseFloat(this.properties.newStrikePrice);
    const costToClose = parseFloat(this.properties.costToClose);
    const premiumReceived = parseFloat(this.properties.premiumReceived);
    const delta = parseFloat(this.properties.delta);
    const sharePrice = parseFloat(this.properties.sharePrice);

    // Validate inputs
    if (isNaN(contracts) || contracts < 1) {
      this.setProperty("totalCostOrCredit", "Invalid number of contracts.");
      return;
    }
    if (isNaN(existingStrikePrice) || existingStrikePrice < 0) {
      this.setProperty("totalCostOrCredit", "Invalid existing strike price.");
      return;
    }
    if (isNaN(newStrikePrice) || newStrikePrice < 0) {
      this.setProperty("totalCostOrCredit", "Invalid new strike price.");
      return;
    }
    if (isNaN(costToClose) || costToClose < 0) {
      this.setProperty("totalCostOrCredit", "Invalid cost to close.");
      return;
    }
    if (isNaN(premiumReceived) || premiumReceived < 0) {
      this.setProperty("totalCostOrCredit", "Invalid premium received.");
      return;
    }
    if (isNaN(delta) || delta <= 0 || delta > 1) {
      this.setProperty("totalCostOrCredit", "Invalid delta.");
      return;
    }
    if (isNaN(sharePrice) || sharePrice < 0) {
      this.setProperty("totalCostOrCredit", "Invalid share price.");
      return;
    }

    // Clear previous error messages
    this.setProperty("errorMessage", "");

    // Calculate Net Credit or Cost per Contract
    const netCreditOrCostPerContract = premiumReceived - costToClose;

    // Total Net Credit or Cost for all Contracts
    const totalNetCreditOrCost = netCreditOrCostPerContract * contracts;

    // Determine Number of Shares to Buy if Cost to Close exceeds Premium Received
    let sharesToBuy = 0;
    if (netCreditOrCostPerContract < 0 && delta > 0) {
      sharesToBuy = Math.ceil(
        (Math.abs(netCreditOrCostPerContract) * contracts) / delta
      );
    }

    // Calculate Total Cost or Credit for the Contract(s)
    let totalCostOrCredit = 0;
    if (sharesToBuy > 0) {
      totalCostOrCredit = -sharesToBuy * sharePrice; // Negative value indicates a cost
    } else {
      totalCostOrCredit = totalNetCreditOrCost * 100; // Positive for credit, negative for cost
    }

    // Update 'sharesToBuy' property
    this.setProperty("sharesToBuy", sharesToBuy);

    // Update 'totalCostOrCredit' property with numeric value
    this.setProperty("totalCostOrCredit", totalCostOrCredit);
  }

  /**
   * Custom drawing method to overlay the "Total Cost or Credit" with color coding.
   * @param {CanvasRenderingContext2D} ctx - The canvas context.
   */
  onDrawForeground(ctx) {
    // Define position for the overlay text
    const x = 10; // Adjust x-coordinate as needed
    const y = this.size[1] - 10; // Position near the bottom; adjust as needed

    // Retrieve the total cost or credit value
    const totalCostOrCredit = this.properties.totalCostOrCredit;

    // Determine formatting and color
    let formattedText = "";
    let color = "black";

    if (typeof totalCostOrCredit === "number") {
      if (totalCostOrCredit > 0) {
        formattedText = `$${totalCostOrCredit.toFixed(2)}`;
        color = "green"; // Credit
      } else if (totalCostOrCredit < 0) {
        formattedText = `($${Math.abs(totalCostOrCredit).toFixed(2)})`;
        color = "red"; // Cost
      } else {
        formattedText = `$0.00`;
        color = "black"; // Neutral
      }
    } else {
      // If totalCostOrCredit is not a number, assume an error and set default values
      formattedText = "Error";
      color = "red";
    }

    // Set text properties
    ctx.font = "16px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // Draw the text overlay
    ctx.fillText("Total Cost or Credit: " + formattedText, x, y);
  }

  /**
   * Export a report of the current calculations.
   */
  exportReport() {
    const report = {
      stockSymbol: this.properties.stockSymbol,
      sharePrice: this.properties.sharePrice,
      contracts: this.properties.contracts,
      existingStrikePrice: this.properties.existingStrikePrice,
      newStrikePrice: this.properties.newStrikePrice,
      costToClose: this.properties.costToClose,
      premiumReceived: this.properties.premiumReceived,
      delta: this.properties.delta,
      sharesToBuy: this.properties.sharesToBuy,
      totalCostOrCredit: this.properties.totalCostOrCredit,
      proxyUsername: this.properties.proxyUsername, // Optional: Include if needed
      errorMessage: this.properties.errorMessage,
    };

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "OptionRollReport.json");
    document.body.appendChild(downloadAnchorNode); // Required for Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  /**
   * Serialize properties for saving the node's state.
   * @param {object} data - The data object to populate.
   */
  onSerialize(data) {
    data.contracts = this.properties.contracts;
    data.existingStrikePrice = this.properties.existingStrikePrice;
    data.newStrikePrice = this.properties.newStrikePrice;
    data.costToClose = this.properties.costToClose;
    data.premiumReceived = this.properties.premiumReceived;
    data.delta = this.properties.delta;
    data.sharePrice = this.properties.sharePrice;
    data.sharesToBuy = this.properties.sharesToBuy;
    data.totalCostOrCredit = this.properties.totalCostOrCredit;
    data.stockSymbol = this.properties.stockSymbol;
    data.alphaVantageAPIKey = this.properties.alphaVantageAPIKey;
    data.proxyUsername = this.properties.proxyUsername;
    data.proxyPassword = this.properties.proxyPassword;
    data.errorMessage = this.properties.errorMessage;
  }

  /**
   * Deserialize properties when loading the node's state.
   * @param {object} data - The data object containing saved properties.
   */
  onDeserialize(data) {
    this.properties.contracts = data.contracts ?? this.properties.contracts;
    this.properties.existingStrikePrice =
      data.existingStrikePrice ?? this.properties.existingStrikePrice;
    this.properties.newStrikePrice =
      data.newStrikePrice ?? this.properties.newStrikePrice;
    this.properties.costToClose =
      data.costToClose ?? this.properties.costToClose;
    this.properties.premiumReceived =
      data.premiumReceived ?? this.properties.premiumReceived;
    this.properties.delta = data.delta ?? this.properties.delta;
    this.properties.sharePrice =
      data.sharePrice ?? this.properties.sharePrice;
    this.properties.sharesToBuy =
      data.sharesToBuy ?? this.properties.sharesToBuy;
    this.properties.totalCostOrCredit =
      data.totalCostOrCredit ?? this.properties.totalCostOrCredit;
    this.properties.stockSymbol =
      data.stockSymbol ?? this.properties.stockSymbol;
    this.properties.alphaVantageAPIKey =
      data.alphaVantageAPIKey ?? this.properties.alphaVantageAPIKey;
    this.properties.proxyUsername =
      data.proxyUsername ?? this.properties.proxyUsername;
    this.properties.proxyPassword =
      data.proxyPassword ?? this.properties.proxyPassword;
    this.properties.errorMessage =
      data.errorMessage ?? this.properties.errorMessage;

    // Re-execute to ensure calculations are up-to-date
    this.onExecute();
  }
}

// Register the node with LightGraph
LiteGraph.registerNodeType(
  "finance/option_roll_cost_calculator",
  OptionRollCostCalculatorNode
);
