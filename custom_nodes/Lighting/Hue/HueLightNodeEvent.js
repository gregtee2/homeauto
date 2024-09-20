class HueLightNodeEvent extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light Event";
        this.size = [336, 87];

        this.properties = {
            light_id: "",
            light_name: "Select Light",
            hsv: { hue: 0.10, saturation: 0.17, brightness: 128 },
            api_key: localStorage.getItem('apiKey'),
            bridge_ip: localStorage.getItem('bridgeIp'),
            lights_fetched: false,
            manual_state: true
        };

        this.lastEventData = null;  // Store the last emitted event data
        this.debounceTimeout = null;
        this.hasLoggedUndefinedInput = false;  // Prevent repeated logs for undefined input
        this.lastHSVInput = null;  // Store the last received HSV input to avoid reprocessing

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        // Toggle for manual on/off
        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            this.emitLightSettings();  // Emit settings when toggled
        });

        // Dropdown for light selection
        this.lightWidget = this.addWidget("combo", "Light", this.properties.light_name, this.onLightSelected.bind(this), { values: ["Select Light"] });

        if (this.properties.api_key && this.properties.bridge_ip) {
            this.fetchAndAddLightDropdown();
        } else {
            console.error("API Key or Bridge IP is missing. Please check localStorage.");
        }

        // Emit initial light settings
        this.emitLightSettings();
    }

    // Emit the current light settings through EventBus with change detection
    emitLightSettings() {
        const eventData = {
            devices: [{
                light_id: this.properties.light_id,
                bridge_ip: this.properties.bridge_ip,
                api_key: this.properties.api_key,
                hsv: this.properties.hsv,
                state: this.properties.manual_state
            }],
            timestamp: new Date().toISOString(),
            state: this.properties.manual_state
        };

        // Compare HSV with the last event and only log if it's changed
        if (JSON.stringify(this.lastEventData?.devices?.[0]?.hsv) !== JSON.stringify(eventData.devices[0].hsv)) {
            console.log("HueLightNodeEvent: Emitting new HSV settings:", eventData);
        }

        // Always publish the event, but only log once for significant changes
        window.EventBus.publish("light_settings", eventData);  
        this.lastEventData = eventData;  // Update the last event data
    }

    onExecute() {
        const hsvInput = this.getInputData(0);

        // Check if the input has changed before processing it
        if (hsvInput && JSON.stringify(hsvInput) !== JSON.stringify(this.lastHSVInput)) {
            console.log("HueLightNodeEvent: Received valid HSV input:", hsvInput);
            this.properties.hsv = hsvInput;
            this.lastHSVInput = hsvInput;  // Update last input to avoid repeated processing
            this.emitLightSettings();  // Emit immediately
            this.hasLoggedUndefinedInput = false;  // Reset undefined log flag
        } else if (!hsvInput) {
            // Log only once when HSV input is undefined
            if (!this.hasLoggedUndefinedInput) {
                console.log("HueLightNodeEvent: No HSV input detected");
                this.hasLoggedUndefinedInput = true;  // Set flag to prevent further logging
            }
        }

        this.updateColorSwatch();

        // Force a graph update to process changes
        if (this.graph) {
            this.graph._dirtyCanvas = true;
            this.graph._dirtyBgcanvas = true;
            this.graph.trigger("node_updated", this);  // Notify the graph that this node has been updated
        }
    }

    // Function to handle light selection from dropdown (existing functionality)
    onLightSelected(selectedLight) {
        const selected = this.lightOptions.find(light => light.name === selectedLight);
        if (selected) {
            this.properties.light_id = selected.id;
            this.properties.light_name = selected.name;
            this.title = `Hue Light - ${this.properties.light_name}`;
            this.emitLightSettings();  // Emit settings when a new light is selected
        }
    }

    // Function to fetch lights from the Hue Bridge (existing functionality)
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

    // Function to update the color swatch (existing functionality)
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

    // Utility functions for HSV to RGB and RGB to Hex conversions
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
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("Lighting/Hue/hue_light_event", HueLightNodeEvent);
