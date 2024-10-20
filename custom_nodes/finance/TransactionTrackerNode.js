class TransactionTrackerNode {
    constructor() {
        this.title = "Transaction Tracker";
        this.addOutput("summary", "object");

        // Store the predefined transactions
        this.transactions = [
            {
                "Date": "10/17/2024",
                "Action": "Sell to Open",
                "Symbol": "MSTR 11/01/2024 195.00 P",
                "Description": "PUT MICROSTRATEGY INC $195 EXP 11/01/24",
                "Quantity": "1",
                "Price": "$16.29",
                "Fees & Comm": "$0.71",
                "Amount": "$1,628.29"
            },
            {
                "Date": "10/17/2024",
                "Action": "Buy to Close",
                "Symbol": "MSTR 10/25/2024 200.00 P",
                "Description": "PUT MICROSTRATEGY INC $200 EXP 10/25/24",
                "Quantity": "1",
                "Price": "$14.79",
                "Fees & Comm": "$0.66",
                "Amount": "-$1,479.66"
            },
            {
                "Date": "10/15/2024",
                "Action": "Reinvest Dividend",
                "Symbol": "SWVXX",
                "Description": "SCHWAB VALUE ADVANTAGE MONEY INVESTOR SHARES",
                "Quantity": "",
                "Price": "",
                "Fees & Comm": "",
                "Amount": "$378.41"
            },
            {
                "Date": "10/15/2024",
                "Action": "Reinvest Shares",
                "Symbol": "SWVXX",
                "Description": "SCHWAB VALUE ADVANTAGE MONEY INVESTOR SHARES",
                "Quantity": "378.41",
                "Price": "$1.00",
                "Fees & Comm": "",
                "Amount": "-$378.41"
            },
            // More transactions can be added here
        ];

        // Summary data
        this.summary = { totalTransactions: 0, totalGains: 0, totalLosses: 0, netTotal: 0 };
    }

    // This function calculates the summary totals for gains, losses, and net total
    updateSummary() {
        let totalGains = 0;
        let totalLosses = 0;

        // Iterate over the transactions
        this.transactions.forEach(transaction => {
            const amount = parseFloat(transaction.Amount.replace('$', ''));
            if (amount > 0) {
                totalGains += amount;
            } else {
                totalLosses += amount;
            }
        });

        // Set summary values
        this.summary.totalTransactions = this.transactions.length;
        this.summary.totalGains = totalGains;
        this.summary.totalLosses = totalLosses;
        this.summary.netTotal = totalGains + totalLosses;
    }

    // Draw the summary and transaction table in the node's UI
    onDrawForeground(ctx) {
        // Draw background
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);

        // Draw summary
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText("Total Transactions: " + this.summary.totalTransactions, 10, 20);
        ctx.fillText("Total Gains: $" + this.summary.totalGains.toFixed(2), 10, 40);
        ctx.fillText("Total Losses: $" + this.summary.totalLosses.toFixed(2), 10, 60);
        ctx.fillText("Net Total: $" + this.summary.netTotal.toFixed(2), 10, 80);

        // Draw the transaction table
        this.renderTransactionTable(ctx);
    }

    // Render the transaction table to display Date, Action, and Amount
    renderTransactionTable(ctx) {
        let yOffset = 100;
        const rowHeight = 20;

        ctx.font = "10px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("Date", 10, yOffset);
        ctx.fillText("Action", 100, yOffset);
        ctx.fillText("Amount", 240, yOffset);
        yOffset += rowHeight;

        // Iterate through the transactions and display them
        this.transactions.forEach(transaction => {
            const amount = parseFloat(transaction.Amount.replace('$', ''));

            // Highlight gains in green and losses in red
            ctx.fillStyle = amount > 0 ? "green" : "red";
            ctx.fillText(transaction.Date, 10, yOffset);
            ctx.fillText(transaction.Action, 100, yOffset);
            ctx.fillText(transaction.Amount, 240, yOffset);

            yOffset += rowHeight;
        });
    }

    // Execute function to calculate and update summary
    onExecute() {
        this.updateSummary();  // Calculate gains, losses, and totals
        this.setOutputData(0, this.summary);  // Output summary for potential connection to other nodes
    }
}

// Register the node with Lightgraph
LiteGraph.registerNodeType("finance/transaction_tracker", TransactionTrackerNode);
