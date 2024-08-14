// Define TriggerNode
class TriggerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute";
        this.size = [200, 60];
        this.properties = { state: true }; // Default state set to true
        this.addInput("Light Info", "light_info");
        this.addInput("State", "boolean");

        this.lastState = null;
        this.debounceTimeout = null;

        // For debouncing logs
        this.lastLogTime = 0;
        this.logInterval = 1000; // Log once every 1000ms
    }

    updateLightState(lightInfo) {
        const data = {
            on: this.properties.state,
            bri: lightInfo.hsv.brightness,
            hue: lightInfo.hsv.hue,
            sat: lightInfo.hsv.saturation
        };

        fetch(`http://localhost:5000/api/light/${lightInfo.light_id}/state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => response.json())
          .then(data => {
              console.log(`Light ${lightInfo.light_id} - State updated successfully:`, data);
          })
          .catch(error => {
              console.error(`Error updating light state for ${lightInfo.light_id}:`, error);
          });
    }

    onExecute() {
        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);

        // Use default state if input state is undefined
        if (state === undefined) {
            state = this.properties.state;
        }

        // If lightInfo is invalid, exit early
        if (!lightInfo || (!Array.isArray(lightInfo.device_ids) && !lightInfo.light_id)) {
            return;
        }

        // Check if state has changed
        if (state !== this.lastState) {
            this.lastState = state;
            this.properties.state = state;

            // Debounce the input checking and state triggering
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                let deviceIds = lightInfo.device_ids;

                // Fallback to single light_id if device_ids is not provided
                if (!Array.isArray(deviceIds) && lightInfo.light_id) {
                    deviceIds = [lightInfo.light_id];
                }

                if (!Array.isArray(deviceIds)) {
                    return;
                }

                deviceIds.forEach(light_id => {
                    if (light_id) {
                        fetch(`http://localhost:5000/api/light/${light_id}/state`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ on: state })
                        })
                        .then(response => response.json())
                        .then(responseData => {
                            console.log(`Light ${light_id} - State triggered successfully:`, responseData);
                        })
                        .catch(error => {
                            console.error(`Light ${light_id} - Error triggering state:`, error);
                        });
                    }
                });
            }, 500); // Wait 500ms before processing, to avoid rapid re-triggers
        }
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/trigger", TriggerNode);
