class ExecuteNodeGv extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Govee";
        this.size = [240, 80];
        this.properties = { state: true, enable: false };

        this.addInput("Govee Light Info", "light_info");
        this.addInput("State", "boolean");
        this.addInput("HSV Info", "object");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.commandQueue = [];
        this.isProcessing = false;
        this.retryTimeout = null;
        this.lastHsvs = {};
        this.commandCooldown = 1500;
        this.lastCommandTimestamp = 0;

        // Debounce timer
        this.debounceTimeout = null;
        this.debounceDelay = 500; // 300ms delay after slider stop
    }

    onExecute() {
        if (!this.properties.enable) {
            return; // Skip execution if the node is disabled
        }

        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);
        const hsv = this.getInputData(2); // HSV might be undefined

        // Only log if lightInfo or HSV data is missing
        if (!lightInfo) {
            console.log("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        const light = lightInfo.lights && lightInfo.lights[0];
        if (!light || !light.light_id || !lightInfo.api_key || !light.model) {
            console.log("ExecuteNode - Missing light_id, api_key, or model info.");
            return;
        }

        // Use either HSV or fallback to default color
        let color = { r: 255, g: 255, b: 255 }; // Default white
        if (hsv && hsv.hue !== undefined && hsv.saturation !== undefined && hsv.brightness !== undefined) {
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            color = { r, g, b };
        } else {
            color = light.color || color; // Use light's current color if available
        }

        // Log only if there's a significant change
        if (this.hasStateOrColorChanged(state, color)) {
            this.queueCommand(lightInfo, state, color);
        }
    }


    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState || !this.lastColor || 
            color.r !== this.lastColor.r || 
            color.g !== this.lastColor.g || 
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

    queueCommand(lightInfo, state, color) {
        const now = Date.now();

        // Only allow a command every 1 second
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            console.log("Command blocked due to cooldown.");
            return; // Block the command if cooldown hasn't passed
        }

        this.lastCommandTimestamp = now;

        this.commandQueue.push({ lightInfo, state, color });
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { lightInfo, state, color } = this.commandQueue.shift();

        this.sendGoveeCommand(lightInfo, state, color).then(() => {
            this.isProcessing = false;
            if (this.retryTimeout) clearTimeout(this.retryTimeout);
            this.processQueue();
        }).catch((error) => {
            if (error.retryAfter) {
                this.retryTimeout = setTimeout(() => {
                    this.isProcessing = false;
                    this.processQueue();
                }, error.retryAfter);
            }
        });
    }

    sendGoveeCommand(lightInfo, state, color) {
        const light = lightInfo.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        console.log("Sending command to API:", bodyData); // <-- Add this line

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': lightInfo.api_key,
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                console.warn(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                return Promise.reject({ retryAfter });
            }
            return response.json();
        })
        .then(responseData => {
            console.log(`Govee Light ${light.light_id} - Command triggered successfully:`, responseData);
        })
        .catch(error => {
            if (error.retryAfter) {
                console.error(`Govee Light ${light.light_id} - Rate limited, retrying in ${error.retryAfter}ms`);
            } else {
                console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
            }
        });
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

LiteGraph.registerNodeType("Execution/execute_govee.js", ExecuteNodeGv);














/*
class ExecuteNodeGv extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Govee";
        this.size = [240, 80];
        this.properties = { state: true, enable: false };

        this.addInput("Govee Light Info", "light_info");
        this.addInput("State", "boolean");
        this.addInput("HSV Info", "object");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.commandQueue = [];
        this.isProcessing = false;
        this.retryTimeout = null;
        this.lastHsvs = {};
        this.commandCooldown = 1000;
        this.lastCommandTimestamp = 0;

        // Debounce timer
        this.debounceTimeout = null;
        this.debounceDelay = 300; // 300ms delay after slider stop
    }

    onExecute() {
        if (!this.properties.enable) {
            console.log("ExecuteNode is disabled.");
            return;
        }

        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);
        const hsv = this.getInputData(2); // HSV might be undefined

        // Add logs to print incoming data
        console.log("ExecuteNode - Incoming data:", { lightInfo, state, hsv });

        if (!lightInfo) {
            console.log("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        const light = lightInfo.lights && lightInfo.lights[0];
        if (!light || !light.light_id || !lightInfo.api_key || !light.model) {
            console.log("ExecuteNode - Missing light_id, api_key, or model info:", lightInfo);
            return;
        }

        console.log("ExecuteNode - Processing light command");

        // Use either HSV or fallback to default color
        let color = { r: 255, g: 255, b: 255 }; // Default white
        if (hsv && hsv.hue !== undefined && hsv.saturation !== undefined && hsv.brightness !== undefined) {
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            color = { r, g, b };
            console.log(`ExecuteNode - Calculated Color: ${JSON.stringify(color)}`);
        } else {
            color = light.color || color; // Use light's current color if available
            console.log(`ExecuteNode - Using current/default color: ${JSON.stringify(color)}`);
        }

        if (this.hasStateOrColorChanged(state, color)) {
            this.queueCommand(lightInfo, state, color);
            console.log("ExecuteNode - Queueing command");
        } else {
            console.log("No HSV data or color/state change, skipping execution.");
        }
    }

    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState || !this.lastColor || 
            color.r !== this.lastColor.r || 
            color.g !== this.lastColor.g || 
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

    queueCommand(lightInfo, state, color) {
        const now = Date.now();

        // Only allow a command every 1 second
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            console.log("Command blocked due to cooldown.");
            return; // Block the command if cooldown hasn't passed
        }

        this.lastCommandTimestamp = now;

        this.commandQueue.push({ lightInfo, state, color });
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { lightInfo, state, color } = this.commandQueue.shift();

        this.sendGoveeCommand(lightInfo, state, color).then(() => {
            this.isProcessing = false;
            if (this.retryTimeout) clearTimeout(this.retryTimeout);
            this.processQueue();
        }).catch((error) => {
            if (error.retryAfter) {
                this.retryTimeout = setTimeout(() => {
                    this.isProcessing = false;
                    this.processQueue();
                }, error.retryAfter);
            }
        });
    }

    sendGoveeCommand(lightInfo, state, color) {
        const light = lightInfo.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        console.log("Sending command to API:", bodyData); // <-- Add this line

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': lightInfo.api_key,
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                console.warn(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                return Promise.reject({ retryAfter });
            }
            return response.json();
        })
        .then(responseData => {
            console.log(`Govee Light ${light.light_id} - Command triggered successfully:`, responseData);
        })
        .catch(error => {
            if (error.retryAfter) {
                console.error(`Govee Light ${light.light_id} - Rate limited, retrying in ${error.retryAfter}ms`);
            } else {
                console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
            }
        });
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

LiteGraph.registerNodeType("Execution/execute_govee.js", ExecuteNodeGv);
























class ExecuteNodeGv extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Govee";
        this.size = [240, 80];
        this.properties = { state: true, enable: false };

        this.addInput("Govee Light Info", "light_info");
        this.addInput("State", "boolean");
        this.addInput("HSV Info", "object");  // Added input for HSV values

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.lastState = null;
        this.lastHsvs = {}; // Track last HSV values per light
        this.lastCommandTimestamp = 0;
        this.commandCooldown = 1000; // 1 second cooldown for state changes
    }

    onExecute() {
        if (!this.properties.enable) {
            console.log("ExecuteNode is disabled.");
            return;
        }

        const lightInfo = this.getInputData(0);
        let state = this.getInputData(1);
        const hsv = this.getInputData(2);  // Get the HSV data

        if (!lightInfo) {
            console.log("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        const light = lightInfo.lights && lightInfo.lights[0];
        if (!light || !light.light_id || !lightInfo.api_key || !light.model) {
            console.log("ExecuteNode - Missing light_id, api_key, or model info:", lightInfo);
            return;
        }

        if (state === undefined) {
            state = this.properties.state;
        }

        let color;
        if (hsv && hsv.hue !== undefined && hsv.saturation !== undefined && hsv.brightness !== undefined) {
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            color = { r, g, b };
            console.log(`HSV data received and converted to RGB:`, color);
        } else {
            color = light.color || { r: 255, g: 255, b: 255 }; // Default to white if no HSV data is received
            console.log(`No valid HSV data received, using default color.`);
        }

        const currentTime = Date.now();

        let hsvChanged = false;
        if (hsv && hsv.hue !== undefined && hsv.saturation !== undefined && hsv.brightness !== undefined) {
            const lastHsv = this.lastHsvs[light.light_id] || {};
            hsvChanged = 
                lastHsv.hue !== hsv.hue || 
                lastHsv.saturation !== hsv.saturation || 
                lastHsv.brightness !== hsv.brightness;

            if (hsvChanged) {
                this.lastHsvs[light.light_id] = { ...hsv }; // Save current HSV values
                console.log("HSV values changed, updating light...");
            }
        }

        if (hsvChanged || state !== this.lastState || lightInfo.force_command) {
            this.lastState = state;
            this.lastCommandTimestamp = currentTime;
            this.sendGoveeCommand(lightInfo, state, color, hsv ? hsv.brightness : undefined);
        }
    }

    sendGoveeCommand(lightInfo, state, color, brightness) {
        const light = lightInfo.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': lightInfo.api_key,
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => response.json())
        .then(responseData => {
            console.log(`Govee Light ${light.light_id} - Command triggered successfully:`, responseData);
        })
        .catch(error => {
            console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
        });
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

LiteGraph.registerNodeType("Execution/execute_govee.js", ExecuteNodeGv);












class ExecuteNodeGv extends LiteGraph.LGraphNode {
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
        const hsv = this.getInputData(2); // Get the HSV data from the "HSV Info" input

        if (!lightInfo) {
            console.log("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        const light = lightInfo.lights && lightInfo.lights[0];
        if (!light || !light.light_id || !lightInfo.api_key || !light.model) {
            console.log("ExecuteNode - Missing light_id, api_key, or model info:", lightInfo);
            return;
        }

        // If state input is undefined, use the internal state property
        if (state === undefined) {
            state = this.properties.state;
        }

        let color;
        if (hsv !== undefined) {
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            color = { r, g, b };
            console.log(`HSV data received and converted to RGB:`, color);
        } else {
            color = light.color || { r: 255, g: 255, b: 255 }; // Default to white if no HSV data is received
        }

        // Ensure we only send "Off" command if the state is set to off
        if (state === false && this.lastState !== state) {
            this.lastState = state;
            this.properties.state = state;

            // Debounce to prevent rapid re-triggering
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                this.sendGoveeCommand(lightInfo, state, color);
            }, 500); // Wait 500ms before processing
            return;
        }

        // If the state is "On" and HSV values changed, update the light color
        if (state === true && (state !== this.lastState || hsv !== undefined)) {
            this.lastState = state;
            this.properties.state = state;

            // Debounce to prevent rapid re-triggering
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                this.sendGoveeCommand(lightInfo, state, color);
            }, 500); // Wait 500ms before processing
        }
    }

    sendGoveeCommand(lightInfo, state, color) {
        const light = lightInfo.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: {
                name: state ? "color" : "turn",
                value: state ? color : "off"
            }
        };

        console.log(`Sending ${state ? "On" : "Off"} command to Govee light ID ${light.light_id}`, bodyData);

        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': lightInfo.api_key,
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => response.json())
        .then(responseData => {
            console.log(`Govee Light ${light.light_id} - Command triggered successfully:`, responseData);
        })
        .catch(error => {
            console.error(`Govee Light ${light.light_id} - Error triggering command:`, error);
        });
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

LiteGraph.registerNodeType("Execution/execute_govee.js", ExecuteNodeGv);*/
