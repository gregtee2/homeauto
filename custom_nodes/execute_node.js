class ExecuteNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute";
        this.size = [200, 80];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "light_info");
        this.addInput("State", "boolean");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.lastState = null;
        this.lastHsvs = {}; // Track last HSV values per light
        this.debounceTimeout = null;
    }

    onExecute() {
        if (!this.properties.enable) {
            console.log("ExecuteNode is disabled.");
            return;
        }

        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);

        if (!lightInfo) {
            console.log("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        if (!Array.isArray(lightInfo.lights) || lightInfo.lights.length === 0) {
            console.log("ExecuteNode - Invalid or empty lights array:", lightInfo);
            return;
        }

        //console.log("ExecuteNode - Received light info:", lightInfo);
        //console.log("ExecuteNode - Received state:", state);

        if (state === undefined) {
            state = this.properties.state;
        }

        let shouldUpdate = false;

        // Check for state changes
        if (state !== this.lastState) {
            this.lastState = state;
            this.properties.state = state;
            shouldUpdate = true;
        }

        // Check for HSV changes in each light
        lightInfo.lights.forEach(light => {
            const lastHsv = this.lastHsvs[light.light_id] || {};
            const hsvChanged = 
                light.hsv.hue !== lastHsv.hue ||
                light.hsv.saturation !== lastHsv.saturation ||
                light.hsv.brightness !== lastHsv.brightness;

            if (hsvChanged) {
                this.lastHsvs[light.light_id] = { ...light.hsv };
                shouldUpdate = true;
            }
        });

        // Execute only if there were changes
        if (shouldUpdate) {
            // Debounce to prevent rapid re-triggering
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                lightInfo.lights.forEach(light => {
                    if (light.light_id && lightInfo.bridge_ip && lightInfo.api_key) {
                        const url = `http://${lightInfo.bridge_ip}/api/${lightInfo.api_key}/lights/${light.light_id}/state`;

                        const bodyData = {
                            on: state,
                            hue: Math.round(light.hsv.hue * 65535), // Hue in range [0, 65535]
                            sat: Math.round(light.hsv.saturation * 254),  // Saturation in range [0, 254]
                            bri: Math.round(light.hsv.brightness)        // Brightness in range [1, 254]
                        };

                        console.log(`Sending command to light ID ${light.light_id} with state ${state ? "ON" : "OFF"}`, bodyData);

                        fetch(url, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(bodyData)
                        })
                        .then(response => response.json())
                        .then(responseData => {
                            console.log(`Light ${light.light_id} - State triggered successfully:`, responseData);
                        })
                        .catch(error => {
                            console.error(`Light ${light.light_id} - Error triggering state:`, error);
                        });
                    } else {
                        console.error(`Missing bridge_ip or api_key for light ${light.light_id}`);
                    }
                });
            }, 1000); // Wait 1000ms before processing
        }
    }

    configure(data) {
        super.configure(data);
        this.properties.enable = false; // Reset enable to false on load
    }
}

LiteGraph.registerNodeType("custom/execute", ExecuteNode);
