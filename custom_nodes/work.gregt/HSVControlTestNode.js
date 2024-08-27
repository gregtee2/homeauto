class HSVControlTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Control Test";
        this.size = [360, 256];
        this.properties = {
            hueShift: 0.10,
            saturation: 0.20,
            brightness: 128,
            enableCommand: false,  // Toggle to enable/disable command sending
            lastHsvInfo: { hue: 0, saturation: 1.0, brightness: 254 }  // Store the last HSV settings
        };

        this.hueShiftSlider = this.addWidget("slider", "Hue Shift", this.properties.hueShift, (value) => {
            this.properties.hueShift = Math.round(value);
            this.updateHueShiftWidgets();
            this.storeAndMaybeSendHSV();
        }, { min: 0, max: 360 });

        this.hueShiftInput = this.addWidget("number", "Hue Shift Value", this.properties.hueShift, (value) => {
            this.properties.hueShift = Math.round(value);
            this.updateHueShiftWidgets();
            this.storeAndMaybeSendHSV();
        }, { step: 50 });

        this.addWidget("slider", "Saturation", this.properties.saturation, (value) => {
            this.properties.saturation = value;
            this.storeAndMaybeSendHSV();
        }, { min: 0, max: 1 });

        this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
            this.storeAndMaybeSendHSV();
        }, { min: 0, max: 254 });

        // Manual toggle to allow final command sending
        this.addWidget("toggle", "Enable Time Trigger", this.properties.enableCommand, (value) => {
            this.properties.enableCommand = value;
            console.log("Enable Command set to:", value);
        });

        // New input to receive the trigger signal
        this.addInput("Time Trigger", "boolean");

        this.addOutput("HSV Info", "hsv_info");

        this.updateColorSwatch();
    }

    onResize() {
        this.size = [360, 256];
    }

    onExecute() {
        // Directly assign the PushButtonNode output to this trigger
        let timeTrigger = this.getInputData(0);

        // Direct test: Check if it's true or false and log the outcome
        //console.log("Time Trigger received (before interpretation):", timeTrigger);

        timeTrigger = this.interpretAsBoolean(timeTrigger);

        //console.log("Time Trigger received (interpreted as boolean):", timeTrigger);

        if (this.properties.enableCommand && timeTrigger === true) {
            this.sendStoredHSV();
        }

        this.updateColorSwatch();
    }

    interpretAsBoolean(value) {
        if (value === "On" || value === "True" || value === "true" || value === 1 || value === true) {
            return true;
        } else if (value === "Off" || value === "False" || value === "false" || value === 0 || value === false) {
            return false;
        } else {
            return Boolean(value);
        }
    }

    storeAndMaybeSendHSV() {
        const hsvInfo = {
            hue: this.properties.hueShift / 360,
            saturation: this.properties.saturation,
            brightness: this.properties.brightness
        };

        this.properties.lastHsvInfo = hsvInfo;

        if (!this.properties.enableCommand) {
            this.setOutputData(0, hsvInfo);
            console.log("Real-time update sent:", hsvInfo);
        } else {
            console.log("Stored HSV values:", hsvInfo);
        }
    }

    sendStoredHSV() {
        this.setOutputData(0, this.properties.lastHsvInfo);
        console.log("HSVControlTestNode - Final command sent to light:", this.properties.lastHsvInfo);
    }

    updateHueShiftWidgets() {
        this.hueShiftSlider.value = this.properties.hueShift;
        this.hueShiftInput.value = this.properties.hueShift;
    }

    updateColorSwatch() {
        const rgb = this.hsvToRgb(this.properties.hueShift / 360, this.properties.saturation, this.properties.brightness / 254);
        const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.boxcolor = color;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    hsvToRgb(h, s, v) {
        let r, g, b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);

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
        this.properties = data.properties || {
            hueShift: 0, saturation: 1.0, brightness: 254, enableCommand: false, lastHsvInfo: { hue: 0, saturation: 1.0, brightness: 254 }
        };

        this.updateHueShiftWidgets();
        this.updateColorSwatch();
    }

    onStart() {
        this.size = [360, 256];
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("custom/hsv_control_test", HSVControlTestNode);
