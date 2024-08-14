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
        this.adjustInputs(mergedLights.length);
    }

    // Method to adjust inputs dynamically
    adjustInputs(connectedLightsCount) {
        const expectedInputs = connectedLightsCount + 1;

        // If too many inputs, remove extras
        while (this.numInputs > expectedInputs) {
            this.removeInput(this.numInputs - 1);
            this.numInputs--;
        }

        // If too few inputs, add the needed ones
        while (this.numInputs < expectedInputs) {
            this.addNewInput();
        }

        // Maintain a minimum size to avoid shrinking too much
        this.size[1] = Math.max(150, 50 + this.numInputs * 30);
    }

    // Method to dynamically add more inputs as needed
    addNewInput() {
        this.addInput(`Light ${this.numInputs + 1}`, "light_info");
        this.numInputs++;
        console.log(`LightMergeNode: Added new input - Light ${this.numInputs}`);
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/light_merge", LightMergeNode);
