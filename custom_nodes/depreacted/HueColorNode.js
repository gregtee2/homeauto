class HueColorNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Color Control";
        this.size = [552.12, 414.89];
        this.properties = {
            hue: 0.5,        // Default hue value (middle of the color wheel)
            saturation: 0,
            brightness: 128, // Default brightness
        };

        // Sliders
        this.hueSlider = this.addWidget("slider", "Hue", this.properties.hue, (value) => {
            this.properties.hue = value;
            this.updateColor();
        }, { min: 0, max: 1, step: 0.01 });

        this.addSpacer();

        this.saturationSlider = this.addWidget("slider", "Saturation", this.properties.saturation, (value) => {
            this.properties.saturation = value;
            this.updateColor();
        }, { min: 0, max: 1, step: 0.01 });

        this.addSpacer();

        this.brightnessSlider = this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
            this.updateColor();
        }, { min: 0, max: 255 });

        this.addSpacer();

        this.addWidget("button", "Reset", null, this.resetSliders);

        this.addOutput("HSV Info", "hsv_info");

        this.updateColor(true);  // Initial color update
    }

    // Utility function to add spacing between UI elements
    addSpacer() {
        this.widgets.push({ type: "null", name: "", value: null });
    }

    // Reset sliders to default values
    resetSliders() {
        this.properties.hue = 0.5;
        this.properties.saturation = 0;
        this.properties.brightness = 128;
        this.updateColor();
    }

    // Method to update color based on slider values
    updateColor(initial = false) {
        const hsv = {
            hue: this.properties.hue,
            saturation: this.properties.saturation,
            brightness: this.properties.brightness
        };

        // Convert HSV to RGB
        const rgb = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);

        if (rgb && rgb.length === 3) {
            this.boxcolor = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
        } else {
            console.error("Error in HSV to RGB conversion:", rgb);
            this.boxcolor = '#808080';  // Default to gray on error
        }

        // Output HSV for the Hue light node
        if (!initial) {
            this.setOutputData(0, hsv);
        }

        // Redraw the node canvas
        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    // Convert HSV to RGB
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
        const toHex = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Visual representation of the current color in the node UI
    onDrawForeground(ctx) {
        const swatchHeight = 60;
        ctx.fillStyle = this.boxcolor || 'gray';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    onExecute() {
        this.updateColor();
    }

    onResize() {
        this.size = [552.12, 414.89];
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("custom/hue_color_control", HueColorNode);
