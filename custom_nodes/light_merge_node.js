// Define LightMergeNode
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

        // To track the previous state
        this.lastMergedIds = [];
    }

    onExecute() {
        let mergedLights = [];

        for (let i = 0; i < this.numInputs; i++) {
            const lightInfo = this.getInputData(i);
            if (lightInfo && lightInfo.light_id !== undefined) {
                mergedLights.push(lightInfo);
            }
        }

        const currentMergedIds = mergedLights.map(light => light.light_id);

        // If there are valid lights to merge and the state has changed
        if (mergedLights.length > 0 && !this.arraysEqual(this.lastMergedIds, currentMergedIds)) {
            this.setOutputData(0, { device_ids: currentMergedIds });

            // Debounced logging
            const currentTime = Date.now();
            if (currentTime - this.lastLogTime > this.logInterval) {
                console.log("LightMergeNode: Received light info:", mergedLights);
                console.log("LightMergeNode: Merged device IDs:", currentMergedIds);
                this.lastLogTime = currentTime;
            }

            // Update the last merged IDs to the current state
            this.lastMergedIds = currentMergedIds;
        } else if (mergedLights.length === 0) {
            // Clear the output if there's no valid data
            this.setOutputData(0, null);

            // Log once about no valid light info
            const currentTime = Date.now();
            if (currentTime - this.lastLogTime > this.logInterval) {
                console.log("LightMergeNode: No valid light info to merge.");
                this.lastLogTime = currentTime;
            }
        }
    }

    // Method to dynamically add more inputs as needed
    addNewInput() {
        this.numInputs++;
        this.addInput(`Light ${this.numInputs}`, "light_info");
        this.size[1] += 30; // Adjust the node height to fit more inputs
    }

    // Utility function to check if two arrays are equal
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/light_merge", LightMergeNode);
