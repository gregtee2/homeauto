class GroupedHueLightNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Grouped Hue Lights";
        this.size = [210, 150]; // Adjusted to accommodate multiple lights

        this.properties = {
            selected_lights: [],  // Array to hold selected light IDs
            hsv: { hue: 0, saturation: 1, brightness: 254 },
            api_key: this.getApiKeyFromLocalStorage(),
            bridge_ip: this.getBridgeIpFromLocalStorage(),
            lights_fetched: false
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        // Initialize the dropdown widget with default value
        this.lightWidget = this.addWidget("multiselect", "Lights", this.properties.selected_lights, this.onLightsSelected.bind(this), { values: [] });

        // Check if API Key and Bridge IP are valid
        if (this.properties.api_key && this.properties.bridge_ip) {
            this.fetchAndAddLightDropdown();
        } else {
            console.error("API Key or Bridge IP is missing. Please check localStorage.");
        }

        this.lastOutputData = null;
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

    onLightsSelected(selectedLights) {
        this.properties.selected_lights = selectedLights;
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

                // Update the dropdown with fetched light options
                this.lightWidget.options.values = this.lightOptions.map(light => light.name);
                this.properties.lights_fetched = true;
            })
            .catch(error => {
                console.error('Error fetching lights:', error);
            });
    }

    onExecute() {
        if (this.properties.selected_lights.length === 0) {
            // No lights selected, skip execution
            return;
        }

        const hsvInput = this.getInputData(0);
        if (hsvInput !== undefined) {
            this.properties.hsv = hsvInput;
        }

        // Validate selected_lights and hsv data
        if (this.properties.selected_lights.length === 0 || !this.properties.hsv) {
            console.error("Invalid selected_lights or hsv data: ", this.properties);
            return;
        }

        // Prepare data for all selected lights
        const lightsData = this.properties.selected_lights.map(lightName => {
            const selectedLight = this.lightOptions.find(light => light.name === lightName);
            return {
                light_id: selectedLight.id,
                hsv: this.properties.hsv
            };
        });

        const currentData = {
            lights: lightsData,
            bridge_ip: this.properties.bridge_ip,
            api_key: this.properties.api_key
        };

        if (JSON.stringify(this.lastOutputData) === JSON.stringify(currentData)) {
            // No changes detected, skip sending data
            return;
        }

        // Store the current data to compare in the next execution
        this.lastOutputData = currentData;

        console.log("Sending to ExecuteNode:", currentData);
        this.setOutputData(0, currentData);

        this.updateColorSwatch();
    }

    updateColorSwatch() {
        if (this.properties.selected_lights.length === 0) {
            // No lights selected, skip color swatch update
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

LiteGraph.registerNodeType("custom/grouped_hue_light", GroupedHueLightNode);
