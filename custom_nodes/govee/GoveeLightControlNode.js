class GoveeLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Govee Light Plus";
        this.size = [336, 107];

        this.defaultColor = { r: 255, g: 223, b: 196 };

        this.properties = {
            device_id: "",
            device_name: "Select Device",
            device_model: "",
            brightness: 100,
            color: this.defaultColor,
            api_key: "36016e2f-60af-4306-9d64-cd12575ad464",
            devices_fetched: false,
            manual_state: true,
            last_hsv: null,
            force_command: false,
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        this.deviceWidget = this.addWidget("combo", "Device", this.properties.device_name, this.onDeviceSelected.bind(this), { values: ["Select Device"] });
        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`GoveeLightControlNode - Manual state toggled to: ${value ? "On" : "Off"}`);
        });

        if (this.properties.api_key) {
            this.fetchAndAddDeviceDropdown();
        } else {
            console.error("API Key is missing. Please check your configuration.");
        }

        this.lastColor = this.defaultColor;
        this.lastHSV = null;  // Store the last HSV value received
        this.debounceTimeout = null;
        this.updateColorSwatch = this.updateColorSwatch.bind(this);
        this.onDeviceSelected = this.onDeviceSelected.bind(this);
    }

    onExecute() {
        const now = Date.now();

        if (!this.properties.device_id || !this.properties.device_model) {
            console.error(`Missing device ID or model for Govee light: ${this.properties.device_id}`);
            return;
        }

        // Fetch HSV input data
        let hsv = this.getInputData(0);

        // Use last known HSV if not receiving new data
        if (hsv === undefined && this.lastHSV) {
            hsv = this.lastHSV;
            console.log("GoveeLightControlNode - Using last known HSV value:", hsv);
        }

        if (hsv !== undefined) {
            // Update last HSV value
            this.lastHSV = hsv;

            // Convert HSV to RGB
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            const newColor = { r, g, b };

            // Check if color has changed
            if (JSON.stringify(newColor) !== JSON.stringify(this.lastColor)) {
                this.lastColor = newColor;

                // Debounce logic
                if (this.debounceTimeout) {
                    clearTimeout(this.debounceTimeout);
                }

                this.debounceTimeout = setTimeout(() => {
                    this.properties.color = newColor;

                    // Prepare light data for output
                    let lightData = {
                        lights: [{
                            light_id: this.properties.device_id,
                            model: this.properties.device_model,
                            color: this.properties.color
                        }],
                        api_key: this.properties.api_key,
                        state: this.properties.manual_state,
                        force_command: true
                    };

                    // Send the light data to the output
                    this.setOutputData(0, lightData);
                    this.updateColorSwatch();

                    // Log color update
                    if (now - this.properties.lastLogTime > this.properties.logInterval) {
                        this.logEvent(`Color updated after debounce: ${JSON.stringify(this.properties.color)}`);
                        this.properties.lastLogTime = now;
                    }

                }, 300); // Adjust the debounce delay as needed
            }
        } else {
            // Send the existing color if HSV is undefined
            let lightData = {
                lights: [{
                    light_id: this.properties.device_id,
                    model: this.properties.device_model,
                    color: this.properties.color
                }],
                api_key: this.properties.api_key,
                state: this.properties.manual_state
            };

            this.setOutputData(0, lightData);
        }
    }

    updateColorSwatch() {
        if (!this.properties.device_id) {
            this.boxcolor = 'black';
            return;
        }

        const colorHex = this.rgbToHex(this.properties.color.r, this.properties.color.g, this.properties.color.b);
        this.boxcolor = colorHex;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    onDeviceSelected(selectedDevice) {
        const selected = this.deviceOptions.find(device => device.name === selectedDevice);
        if (selected) {
            this.properties.device_id = selected.id;
            this.properties.device_name = selected.name;
            this.properties.device_model = selected.model;
            this.title = `Govee Light - ${this.properties.device_name}`;
            console.log(`Device selected: ID = ${selected.id}, Name = ${selected.name}, Model = ${selected.model}`);
            this.deviceWidget.value = this.properties.device_name;
            this.updateColorSwatch();
        } else {
            console.error("Selected device not found in device options.");
        }
    }

    async fetchAndAddDeviceDropdown() {
        const url = `https://developer-api.govee.com/v1/devices`;
        console.log("Fetching devices from:", url);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Govee-API-Key": this.properties.api_key
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Fetched device data:", data);

            this.deviceOptions = data.data.devices.map(device => ({
                id: device.device,
                name: device.deviceName,
                model: device.model
            }));

            if (this.deviceOptions.length === 0) {
                console.error('No devices found');
                return;
            }

            this.deviceWidget.options.values = this.deviceOptions.map(device => device.name);

            this.onDeviceSelected(this.deviceOptions[0].name);

            this.properties.devices_fetched = true;
        } catch (error) {
            console.error('Error fetching devices:', error);
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
}

LiteGraph.registerNodeType("govee/light_control", GoveeLightControlNode);
