class BasicSenderNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Basic Sender";
        this.addOutput("Output", "object");
    }

    onExecute() {
        const dataToSend = { message: "Hello from Sender Node!" };
        console.log("BasicSenderNode: Sending data", dataToSend);
        this.setOutputData(0, dataToSend); // Send the data to the output slot
    }
}

LiteGraph.registerNodeType("Test/BasicSender", BasicSenderNode);
