class HueLightNodePlus extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light Plus";
        this.size = [336, 87]; // Set to the size from the graph file

        this.properties = {
            light_id: "",
            light_name: "Select Light",
            hsv: { hue: 0.10, saturation: 0.17, brightness: 128 }, // Default HSV values
            api_key: this.getApiKeyFromLocalStorage(),
            bridge_ip: this.getBridgeIpFromLocalStorage(),
            lights_fetched: false
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        // Initialize the dropdown widget with default value
        this.lightWidget = this.addWidget("combo", "Light", this.properties.light_name, this.onLightSelected.bind(this), { values: ["Select Light"] });

        if (this.properties.api_key && this.properties.bridge_ip) {
            this.fetchAndAddLightDropdown();
        } else {
            console.error("API Key or Bridge IP is missing. Please check localStorage.");
        }

        this.lastOutputData = null;
    }

    onStart() {
        this.size = [336, 87]; // Force the node to have a specific size when added to the graph
    }

    onResize() {
        this.size = [336, 87]; // Enforce size when the node is resized
    }

    onExecute() {
        let lightData;

        if (!this.properties.light_id) {
            //console.warn("No light selected, using placeholder data.");
            lightData = {
                lights: [{
                    light_id: "default",
                    hsv: { hue: 0, saturation: 1, brightness: 254 } // Default HSV values
                }],
                bridge_ip: this.properties.bridge_ip,
                api_key: this.properties.api_key
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
                api_key: this.properties.api_key
            };
        }

        //console.log("HueLightNodePlus - Sending light data:", lightData);

        // Output lightData to the next connected node
        this.setOutputData(0, lightData);
        this.updateColorSwatch(); // Update color swatch with new or placeholder HSV data
    }


    updateColorSwatch() {
        if (!this.properties.light_id) {
            this.boxcolor = 'black'; // Set a default color if no light is selected
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

                // Update the dropdown with fetched light options
                this.lightWidget.options.values = this.lightOptions.map(light => light.name);
                this.lightWidget.value = this.properties.light_name;

                // Set the selected light
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

LiteGraph.registerNodeType("custom/hue_light_plus", HueLightNodePlus);
