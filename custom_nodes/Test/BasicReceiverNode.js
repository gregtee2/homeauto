class BasicReceiverNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Basic Receiver";
        this.addInput("Input", "object");
    }

    onExecute() {
        const receivedData = this.getInputData(0); // Get data from the input slot
        console.log("BasicReceiverNode: Received data", receivedData);
    }
}

LiteGraph.registerNodeType("Test/BasicReceiver", BasicReceiverNode);
