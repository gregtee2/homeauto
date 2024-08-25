class TriggerBusNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Trigger Bus";
        this.size = [300, 150];  // Set consistent size like FixedLightMergeNode

        // Add fixed number of inputs (5 in this case)
        for (let i = 1; i <= 5; i++) {
            this.addInput(`Trigger ${i}`, "boolean");
        }

        // Add output
        this.addOutput("Out", "boolean");
    }

    onExecute() {
        let output = false;

        // Check inputs to determine if any trigger is active
        for (let i = 0; i < this.inputs.length; i++) {
            const inputState = this.getInputData(i);
            if (inputState) {
                output = true;
                break;
            }
        }

        this.setOutputData(0, output);
    }

    onSerialize(o) {
        // Serialize the properties
        o.properties = this.properties;
    }

    onConfigure(o) {
        // Reconfigure the node based on loaded properties
        this.properties = o.properties;
        this.updateSize();
    }

    updateSize() {
        // Ensure the size is updated (optional, since it's fixed)
        this.size = [300, 150];  // Consistent with FixedLightMergeNode
    }

    onAdded() {
        this.updateSize();  // Ensure the size is set when the node is added to the graph
    }
}

LiteGraph.registerNodeType("custom/trigger_bus", TriggerBusNode);
