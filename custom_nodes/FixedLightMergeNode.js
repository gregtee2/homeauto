class FixedLightMergeNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Fixed Light Merge";
        this.size = [300, 150];

        // Add 5 fixed inputs
        for (let i = 1; i <= 5; i++) {
            this.addInput(`Light ${i}`, "light_info");
        }

        // Single output for the merged light info
        this.addOutput("Merged Light Info", "light_info");

        // Store the last merged IDs and last known inputs
        this.lastMergedIds = "";
        this.lastInputStates = new Array(this.inputs.length).fill(undefined);
    }

    onExecute() {
        let mergedLights = [];
        let bridge_ip = null;
        let api_key = null;

        let hasValidInput = false;

        // Collect data from all inputs
        for (let i = 0; i < this.inputs.length; i++) {
            const lightInfo = this.getInputData(i);
            if (lightInfo && lightInfo.lights && lightInfo.lights.length > 0) {
                hasValidInput = true;

                // Merge the lights while preserving their individual info
                mergedLights = mergedLights.concat(lightInfo.lights);

                // Capture the bridge_ip and api_key from the first valid input
                if (!bridge_ip && lightInfo.bridge_ip) {
                    bridge_ip = lightInfo.bridge_ip;
                }
                if (!api_key && lightInfo.api_key) {
                    api_key = lightInfo.api_key;
                }
            }

            // Check if the input state has changed
            if (this.lastInputStates[i] !== lightInfo) {
                this.lastInputStates[i] = lightInfo;
            }
        }

        // Handle when there are valid light inputs
        if (hasValidInput) {
            const mergedIds = mergedLights.map(light => light.light_id).join(",");

            // Only log if the merged IDs have changed
            if (mergedIds !== this.lastMergedIds) {
                console.log("FixedLightMergeNode: Merged device IDs:", mergedIds);
                this.lastMergedIds = mergedIds; // Update last merged IDs
            }

            // Set the combined light info as the output
            this.setOutputData(0, {
                device_ids: mergedLights.map(light => light.light_id),
                lights: mergedLights, // Pass through individual light info
                bridge_ip: bridge_ip,  // Include bridge_ip
                api_key: api_key       // Include api_key
            });
        } else {
            // Only log once if transitioning to a state with no valid inputs
            if (this.lastMergedIds !== "") {
                console.log("FixedLightMergeNode: No valid light inputs connected, outputting null.");
                this.lastMergedIds = ""; // Reset last merged IDs
            }
            // If no lights are connected, ensure we don't send an empty output
            this.setOutputData(0, null);
        }
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/fixed_light_merge", FixedLightMergeNode);
