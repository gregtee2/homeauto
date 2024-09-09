class PassThroughNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Pass-Through";
        this.size = [20, 20]; // Small and simple

        // Use "*" as the data type to accept any input and output
        this.addInput("Input", "*");
        this.addOutput("Output", "*");
    }

    onExecute() {
        // Pass input data directly to the output
        const inputData = this.getInputData(0);
        if (inputData !== undefined) {
            this.setOutputData(0, inputData);
        }
    }
}

// Register the node with the name "Pass-Through"
LiteGraph.registerNodeType("Utility/pass_through", PassThroughNode);
