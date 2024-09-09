class ExecuteNode extends LiteGraph.LGraphNode {
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

        this.lastLogTime = 0; // Last time the log was output
        this.logInterval = 2000; // Minimum time between logs in milliseconds
    }

    logThrottled(message) {
        const now = Date.now();
        if (now - this.lastLogTime > this.logInterval) {
            console.log(message);
            this.lastLogTime = now;
        }
    }

    onExecute() {
        if (!this.properties.enable) {
            this.logThrottled("ExecuteNode is disabled.");
            return;
        }

        const lightInfo = this.getInputData(0);
        const state = this.getInputData(1);

        if (!lightInfo) {
            this.logThrottled("ExecuteNode - No light info received, skipping execution.");
            return;
        }

        const light = lightInfo.lights && lightInfo.lights[0];
        if (!light || !light.light_id || !lightInfo.api_key || !light.model) {
            console.log("ExecuteNode - Missing light_id, api_key, or model info:", lightInfo);
            return;
        }

        const hsv = lightInfo.hsv;
        let color;
        if (hsv !== undefined) {
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            color = { r, g, b };
            console.log(`HSV data received and converted to RGB:`, color);
        } else {
            color = light.color || { r: 255, g: 255, b: 255 };
        }

        const hsvChanged = this.lastHSV === null || JSON.stringify(this.lastHSV) !== JSON.stringify(hsv);
        const stateChanged = state !== this.lastState;

        if (hsvChanged || stateChanged || lightInfo.force_command) {
            this.lastState = state;
            this.lastHSV = lightInfo.color;

            console.log("Sending color command due to HSV or state change");
            this.sendCommand(lightInfo, state, color);
        }
    }

    // Updated sendCommand function
    sendCommand(lightInfo, state, color) {
        const light = lightInfo.lights[0];

        // Validate required parameters
        if (!light.light_id || !light.model) {
            console.error("sendCommand Error: device and model are required params");
            return;
        }

        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: {
                name: "color",
                value: {
                    r: color.r,
                    g: color.g,
                    b: color.b
                }
            }
        };

        if (!state) {
            bodyData.cmd = {
                name: "turn",
                value: "off"
            };
        }

        // Log the request URL and body
        console.log("Sending request to URL:", url);
        console.log("Request body:", JSON.stringify(bodyData));

        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': lightInfo.api_key,
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            console.log("Received response:", response);
            if (!response.ok) {
                return response.json().then(errData => {
                    console.error("Error response data:", errData);
                    throw new Error('Request failed with status ' + response.status);
                });
            }
            return response.json();
        })
        .then(responseData => {
            if (responseData.code === 200) {
                console.log(`Govee Light ${light.light_id} - Command triggered successfully:`, responseData);
            } else {
                console.error(`Govee Light ${light.light_id} - Error in response:`, responseData);
            }
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

LiteGraph.registerNodeType("custom/execute_govee", ExecuteNode);
