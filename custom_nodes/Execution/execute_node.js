class ExecuteNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "light_info");
        this.addInput("State", "boolean");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        // Initialize the log area
        this.logArea = document.getElementById('log-panel');

        this.lastState = null;
        this.lastHsvs = {}; // Track last HSV values per light
        this.debounceTimeout = null;
    }

    updateLog(message) {
        if (this.logArea) {
            const timestamp = new Date().toLocaleString();
            this.logArea.innerHTML += `[${timestamp}] ${message}<br>`;
            this.logArea.scrollTop = this.logArea.scrollHeight; // Auto-scroll to the bottom
        } else {
            console.warn("Log area is not initialized yet.");
        }
    }

    onExecute() {
        //console.log("ExecuteNode onExecute called.");

        if (!this.properties.enable) {
            console.log("ExecuteNode is disabled.");
            return;
        }

        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);

        if (!lightInfo) {
            this.updateLog("No light info received, skipping execution.");
            return;
        }

        if (!Array.isArray(lightInfo.lights) || lightInfo.lights.length === 0) {
            this.updateLog("Invalid or empty lights array.");
            return;
        }

        if (state === undefined) {
            state = this.properties.state;
        }

        let shouldUpdate = false;

        if (state !== this.lastState) {
            this.lastState = state;
            this.properties.state = state;
            shouldUpdate = true;
            const stateText = state ? "On" : "Off";
            this.updateLog(`State changed to: ${stateText}`);
        }

        lightInfo.lights.forEach(light => {
            const lastHsv = this.lastHsvs[light.light_id] || {};
            const hsvChanged = 
                light.hsv.hue !== lastHsv.hue ||
                light.hsv.saturation !== lastHsv.saturation ||
                light.hsv.brightness !== lastHsv.brightness;

            if (hsvChanged) {
                this.lastHsvs[light.light_id] = { ...light.hsv };
                shouldUpdate = true;
                this.updateLog(`HSV changed for Light ID ${light.light_id}`);
            }
        });

        if (shouldUpdate) {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                lightInfo.lights.forEach(light => {
                    if (light.light_id && lightInfo.bridge_ip && lightInfo.api_key) {
                        const url = `http://${lightInfo.bridge_ip}/api/${lightInfo.api_key}/lights/${light.light_id}/state`;

                        const bodyData = {
                            on: state,
                            hue: Math.round(light.hsv.hue * 65535),
                            sat: Math.round(light.hsv.saturation * 254),
                            bri: Math.round(light.hsv.brightness)
                        };

                        fetch(url, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(bodyData)
                        })
                        .then(response => response.json())
                        .then(responseData => {
                            this.updateLog(`Light ${light.light_id} - State triggered successfully.`);
                        })
                        .catch(error => {
                            this.updateLog(`Light ${light.light_id} - Error triggering state: ${error}`);
                        });
                    } else {
                        this.updateLog(`Missing bridge_ip or api_key for light ${light.light_id}`);
                    }
                });
            }, 1000);
        }
    }

    configure(data) {
        super.configure(data);
        this.properties.enable = false;
    }
}

LiteGraph.registerNodeType("Execution/execute_node.js", ExecuteNode);
















/*class ExecuteNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Govee";
        this.size = [240, 80];
        this.properties = { state: true, enable: false };

        this.addInput("Govee Light Info", "light_info");
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
            const hsv = light.hsv || {};  // Ensure hsv is defined
            const hsvChanged = 
                hsv.hue !== lastHsv.hue ||
                hsv.saturation !== lastHsv.saturation ||
                hsv.brightness !== lastHsv.brightness;

            if (hsvChanged) {
                this.lastHsvs[light.light_id] = { ...hsv };
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
                    if (light.light_id && lightInfo.api_key) {
                        const hsv = light.hsv || { hue: 0, saturation: 0, brightness: 0 }; // Default to zero values if undefined
                        const color = {
                            r: Math.round(hsv.hue * 255),
                            g: Math.round(hsv.saturation * 255),
                            b: Math.round(hsv.brightness)
                        };

                        this.sendCommand(lightInfo, state, color);
                    } else {
                        console.error(`Missing api_key for light ${light.light_id}`);
                    }
                });
            }, 1000); // Wait 1000ms before processing
        }
    }

    sendCommand(lightInfo, state, color) {
        const light = lightInfo.lights[0];

        if (!light.light_id || !light.model) {
            console.error("sendCommand Error: device and model are required params");
            return;
        }

        const url = `https://developer-api.govee.com/v1/devices/control`;

        // Step 1: Turn on the light if it's supposed to be on
        if (state) {
            const turnOnBodyData = {
                device: light.light_id,
                model: light.model,
                cmd: {
                    name: "turn",
                    value: "on"
                }
            };

            console.log("Sending turn on command to URL:", url);
            console.log("Request body for turning on:", JSON.stringify(turnOnBodyData));

            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': lightInfo.api_key,
                },
                body: JSON.stringify(turnOnBodyData)
            })
            .then(response => response.json())
            .then(responseData => {
                console.log(`Govee Light ${light.light_id} - Turned on successfully:`, responseData);

                // Step 2: After turning on, set the color
                const colorBodyData = {
                    device: light.light_id,
                    model: light.model,
                    cmd: {
                        name: "color",
                        value: color
                    }
                };

                console.log("Sending color command to URL:", url);
                console.log("Request body for setting color:", JSON.stringify(colorBodyData));

                return fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Govee-API-Key': lightInfo.api_key,
                    },
                    body: JSON.stringify(colorBodyData)
                });
            })
            .then(response => response.json())
            .then(responseData => {
                console.log(`Govee Light ${light.light_id} - Color set successfully:`, responseData);
            })
            .catch(error => {
                console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
            });

        } else {
            // Handle turning off the light
            const turnOffBodyData = {
                device: light.light_id,
                model: light.model,
                cmd: {
                    name: "turn",
                    value: "off"
                }
            };

            console.log("Sending turn off command to URL:", url);
            console.log("Request body for turning off:", JSON.stringify(turnOffBodyData));

            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': lightInfo.api_key,
                },
                body: JSON.stringify(turnOffBodyData)
            })
            .then(response => response.json())
            .then(responseData => {
                console.log(`Govee Light ${light.light_id} - Turned off successfully:`, responseData);
            })
            .catch(error => {
                console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
            });
        }
    }

    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
}

LiteGraph.registerNodeType("custom/execute_govee", ExecuteNode);*/
