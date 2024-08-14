class LightMergeNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Light Merge";
        this.size = [300, 150];
        this.properties = { mergedLights: [] };

        // Initial input for at least one light
        this.addInput("Light 1", "light_info");

        // Output for the merged light info
        this.addOutput("Merged Light Info", "light_info");

        // Track the number of inputs
        this.numInputs = 1;

        // For debouncing logs
        this.lastLogTime = 0;
        this.logInterval = 1000; // Log once every 1000ms
        this.lastMergedIds = ""; // Track last merged IDs to reduce repetitive logging
    }

    onExecute() {
        let mergedLights = [];

        for (let i = 0; i < this.numInputs; i++) {
            const lightInfo = this.getInputData(i);
            if (lightInfo) {
                mergedLights.push(lightInfo);
            }
        }

        const mergedIds = mergedLights.map(light => light.light_id).join(",");

        // Set the combined light info as the output
        this.setOutputData(0, { device_ids: mergedLights.map(light => light.light_id) });

        // Debounced logging - only log when there is a meaningful change
        const currentTime = Date.now();
        if (currentTime - this.lastLogTime > this.logInterval && mergedIds !== this.lastMergedIds) {
            if (mergedLights.length > 0) {
                console.log("LightMergeNode: Merged device IDs:", mergedLights.map(light => light.light_id));
                this.lastMergedIds = mergedIds; // Update last logged IDs
            }
            this.lastLogTime = currentTime;
        }

        // Adjust inputs dynamically based on connections
        this.adjustInputs();
    }

    // Method to adjust inputs dynamically
    adjustInputs() {
        let connectedInputs = 0;

        for (let i = 0; i < this.numInputs; i++) {
            if (this.isInputConnected(i)) {
                connectedInputs++;
            }
        }

        if (connectedInputs === this.numInputs) {
            this.addNewInput();
        } else if (connectedInputs < this.numInputs - 1) {
            this.removeLastInput();
        }
    }

    // Method to dynamically add more inputs as needed
    addNewInput() {
        this.numInputs++;
        this.addInput(`Light ${this.numInputs}`, "light_info");
        this.size[1] += 30; // Adjust the node height to fit more inputs
        console.log(`LightMergeNode: Added new input - Light ${this.numInputs}`);
    }

    // Method to remove the last input if it's not needed
    removeLastInput() {
        if (this.numInputs > 1) {
            this.numInputs--;
            this.removeInput(this.numInputs);
            this.size[1] -= 30; // Adjust the node height accordingly
            console.log(`LightMergeNode: Removed input - Light ${this.numInputs + 1}`);
        }
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/light_merge", LightMergeNode);
