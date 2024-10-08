//refactored code
class HueLightNodePlus extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light Plus";
        this.size = [336, 87]; 

        this.properties = {
            light_id: "",
            light_name: "Select Light",
            hsv: { hue: 0.10, saturation: 0.17, brightness: 128 },
            api_key: this.getApiKeyFromLocalStorage(),
            bridge_ip: this.getBridgeIpFromLocalStorage(),
            lights_fetched: false,
            manual_state: true
        };

        this.lastLogTime = 0;
        this.logInterval = 1000;

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`HueLightNodePlus - Manual state toggled to: ${value ? "On" : "Off"}`);
        });

        this.lightWidget = this.addWidget("combo", "Light", this.properties.light_name, this.onLightSelected.bind(this), { values: ["Select Light"] });

        if (this.properties.api_key && this.properties.bridge_ip) {
            this.fetchAndAddLightDropdown();
        } else {
            console.error("API Key or Bridge IP is missing. Please check localStorage.");
        }

        this.lastOutputData = null;
        this.memoizedHSVToRGB = {};
        this.logThrottled = this.debounceLog((lightData) => {
            console.log("HueLightNodePlus - HSV values sent:", lightData.lights[0].hsv);
        }, this.logInterval);
    }

    debounceLog(callback, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => callback(...args), delay);
        };
    }

    onStart() {
        this.adjustSize();
    }

    onResize() {
        this.adjustSize();
    }

    adjustSize() {
        this.size = [336, 107];
    }

    onExecute() {
        const hsvInput = this.getInputData(0);
        if (hsvInput !== undefined) {
            this.properties.hsv = hsvInput;
        }

        const lightData = {
            lights: [{
                light_id: this.properties.light_id || "default",
                hsv: this.properties.hsv
            }],
            bridge_ip: this.properties.bridge_ip,
            api_key: this.properties.api_key,
            state: this.properties.manual_state
        };

        // Add this line for debugging
        //console.log("HueLightNodePlus - Emitting lightData:", lightData);

        this.setOutputData(0, lightData);
        this.updateColorSwatch();
    }


    updateColorSwatch() {
        if (!this.properties.light_id) {
            this.boxcolor = 'black'; 
            return;
        }

        const { hue, saturation, brightness } = this.properties.hsv;
        const rgb = this.hsvToRgb(hue, saturation, brightness / 254);
        const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);

        this.boxcolor = colorHex;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    hsvToRgb(h, s, v) {
        const key = `${h}-${s}-${v}`;
        if (this.memoizedHSVToRGB[key]) {
            return this.memoizedHSVToRGB[key];
        }

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        const mappings = [
            [v, t, p], [q, v, p], [p, v, t],
            [p, q, v], [t, p, v], [v, p, q]
        ];

        const [r, g, b] = mappings[i % 6];
        const result = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];

        this.memoizedHSVToRGB[key] = result;
        return result;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    async fetchAndAddLightDropdown() {
        const url = `http://${this.properties.bridge_ip}/api/${this.properties.api_key}/lights`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.lightOptions = Object.entries(data).map(([id, light]) => ({
                id,
                name: light.name
            }));

            if (this.lightOptions.length === 0) {
                console.error('No lights found');
                return;
            }

            this.lightWidget.options.values = this.lightOptions.map(light => light.name);
            this.lightWidget.value = this.properties.light_name;
            this.onLightSelected(this.properties.light_name);
            this.properties.lights_fetched = true;
        } catch (error) {
            console.error('Error fetching lights:', error);
        }
    }

    onLightSelected(selectedLight) {
        const selected = this.lightOptions.find(light => light.name === selectedLight);
        if (selected) {
            this.properties.light_id = selected.id;
            this.properties.light_name = selected.name;
            this.title = `Hue Light - ${this.properties.light_name}`;
        }
    }

    getApiKeyFromLocalStorage() {
        return this.getFromLocalStorage('apiKey', 'API Key');
    }

    getBridgeIpFromLocalStorage() {
        return this.getFromLocalStorage('bridgeIp', 'Bridge IP');
    }

    getFromLocalStorage(key, label) {
        const value = localStorage.getItem(key);
        if (!value) {
            console.error(`${label} not found in localStorage!`);
        } else {
            console.log(`${label} found:`, value);
        }
        return value;
    }

    onDrawForeground(ctx) {
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.title = `Hue Light - ${this.properties.light_name}`;
        if (!this.properties.lights_fetched) {
            this.fetchAndAddLightDropdown();
        }
    }
}

LiteGraph.registerNodeType("Lighting/Hue/hue_light_plus", HueLightNodePlus);







/*//GTP 4.0 code
class HueLightNodePlus extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light Plus";
        this.size = [336, 87]; 

        this.properties = {
            light_id: "",
            light_name: "Select Light",
            hsv: { hue: 0.10, saturation: 0.17, brightness: 128 }, // Default HSV values
            api_key: this.getApiKeyFromLocalStorage(),
            bridge_ip: this.getBridgeIpFromLocalStorage(),
            lights_fetched: false,
            manual_state: true // Add manual state for the toggle
        };

        this.lastLogTime = 0;  // Initialize the lastLogTime
        this.logInterval = 1000;  // Set the logging interval to 1000 ms

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`HueLightNodePlus - Manual state toggled to: ${value ? "On" : "Off"}`);
        });

        this.lightWidget = this.addWidget("combo", "Light", this.properties.light_name, this.onLightSelected.bind(this), { values: ["Select Light"] });

        if (this.properties.api_key && this.properties.bridge_ip) {
            this.fetchAndAddLightDropdown();
        } else {
            console.error("API Key or Bridge IP is missing. Please check localStorage.");
        }

        this.lastOutputData = null;
    }

    onStart() {
        this.size = [336, 107]; 
    }

    onResize() {
        this.size = [336, 107]; 
    }

    // Define the logThrottled method outside of onExecute
    logThrottled(lightData) {
        const now = Date.now();
        if (now - this.lastLogTime > this.logInterval) {
            //console.log("HueLightNodePlus - HSV values sent:", lightData.lights[0].hsv);
            this.lastLogTime = now;
        }
    }

    onExecute() {
        let lightData;

        if (!this.properties.light_id) {
            lightData = {
                lights: [{
                    light_id: "default",
                    hsv: { hue: 0.10, saturation: 0.17, brightness: 128 } 
                }],
                bridge_ip: this.properties.bridge_ip,
                api_key: this.properties.api_key,
                state: this.properties.manual_state
            };
        } else {
            const hsvInput = this.getInputData(0);
            if (hsvInput !== undefined) {
                this.properties.hsv = hsvInput;
            }

            lightData = {
                lights: [{
                    light_id: this.properties.light_id,
                    hsv: this.properties.hsv
                }],
                bridge_ip: this.properties.bridge_ip,
                api_key: this.properties.api_key,
                state: this.properties.manual_state
            };
        }

        // Call the logThrottled function
        this.logThrottled(lightData);

        // Set the output data and update the swatch
        this.setOutputData(0, lightData);
        this.updateColorSwatch(); 
    }

    updateColorSwatch() {
        if (!this.properties.light_id) {
            this.boxcolor = 'black'; 
            return;
        }

        const hsv = this.properties.hsv;
        const rgb = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 254);
        const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);

        this.boxcolor = colorHex;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
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

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    onDrawForeground(ctx) {
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    getApiKeyFromLocalStorage() {
        const apiKey = localStorage.getItem('apiKey');
        if (!apiKey) {
            console.error("API Key not found in localStorage!");
        } else {
            console.log("API Key found:", apiKey);
        }
        return apiKey;
    }

    getBridgeIpFromLocalStorage() {
        const bridgeIp = localStorage.getItem('bridgeIp');
        if (!bridgeIp) {
            console.error("Bridge IP not found in localStorage!");
        } else {
            console.log("Bridge IP found:", bridgeIp);
        }
        return bridgeIp;
    }

    onLightSelected(selectedLight) {
        const selected = this.lightOptions.find(light => light.name === selectedLight);
        if (selected) {
            this.properties.light_id = selected.id;
            this.properties.light_name = selected.name;
            this.title = `Hue Light - ${this.properties.light_name}`;
        }
    }

    fetchAndAddLightDropdown() {
        const url = `http://${this.properties.bridge_ip}/api/${this.properties.api_key}/lights`;
        console.log("Fetching lights from:", url);

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Fetched light data:", data);

                this.lightOptions = Object.entries(data).map(([id, light]) => ({
                    id: id,
                    name: light.name
                }));

                if (this.lightOptions.length === 0) {
                    console.error('No lights found');
                    return;
                }

                this.lightWidget.options.values = this.lightOptions.map(light => light.name);
                this.lightWidget.value = this.properties.light_name;

                this.onLightSelected(this.properties.light_name);
                this.properties.lights_fetched = true;
            })
            .catch(error => {
                console.error('Error fetching lights:', error);
            });
    }

    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.title = `Hue Light - ${this.properties.light_name}`;
        if (!this.properties.lights_fetched) {
            this.fetchAndAddLightDropdown();
        }
    }
}

LiteGraph.registerNodeType("Lighting/Hue/hue_light_plus", HueLightNodePlus);*/
