class HueLightGradeNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light Grade";

        // Set node size
        this.size = [300, 180]; // Adjusted size to accommodate the color swatch and toggle

        // Default properties
        this.properties = {
            hueAdjustment: 0,       // Adjustment values for the sliders
            saturationAdjustment: 0,
            brightnessAdjustment: 0,
            isDisabled: false        // Disable flag
        };

        this.initialValuesCaptured = false; // Flag to determine if initial values have been captured

        // Input: HSV Info (single object containing hue, saturation, and brightness)
        this.addInput("HSV Info", "hsv_info");

        // Slider widgets for adjustment
        this.hueSlider = this.addWidget("slider", "Hue Adjustment", this.properties.hueAdjustment, (value) => {
            this.properties.hueAdjustment = value;
            this.updateOutputs(true);
        }, { min: 0, max: 1, step: 0.01 }); // Adjusted to mirror the source (0 to 1, where 1 represents 360 degrees)

        this.saturationSlider = this.addWidget("slider", "Saturation Adjustment", this.properties.saturationAdjustment, (value) => {
            this.properties.saturationAdjustment = value;
            this.updateOutputs(true);
        }, { min: 0, max: 1, step: 0.01 }); // No negative values

        this.brightnessSlider = this.addWidget("slider", "Brightness Adjustment", this.properties.brightnessAdjustment, (value) => {
            this.properties.brightnessAdjustment = value;
            this.updateOutputs(true);
        }, { min: 0, max: 1, step: 0.01 }); // No negative values

        // Disable toggle
        this.addWidget("toggle", "Disable", this.properties.isDisabled, (value) => {
            this.properties.isDisabled = value;
            this.updateOutputs();
        });

        // Output: Adjusted HSV Info
        this.addOutput("HSV Info", "hsv_info");
    }

    onExecute() {
        this.updateOutputs();
    }

    updateOutputs(fromUserAction = false) {
        // Get the input HSV object
        const hsvInfo = this.getInputData(0);

        if (hsvInfo && !this.initialValuesCaptured) {
            console.log("Received Initial HSV Info:", hsvInfo);

            // Capture initial values from the source node
            this.hueSlider.value = hsvInfo.hue / 1; // Normalize hue to 0-1 for slider
            this.saturationSlider.value = hsvInfo.saturation;
            this.brightnessSlider.value = hsvInfo.brightness / 254; // Normalize brightness to 0-1 for slider

            // Set the captured values as the starting point for adjustments
            this.properties.hueAdjustment = 0;
            this.properties.saturationAdjustment = 0;
            this.properties.brightnessAdjustment = 0;

            // Mark that initial values have been captured
            this.initialValuesCaptured = true;
        }

        if (this.initialValuesCaptured) {
            // Pass through original values if the node is disabled
            if (this.properties.isDisabled) {
                this.setOutputData(0, hsvInfo);
                this.updateColorSwatch(hsvInfo); // Update the color swatch with the original color
            } else {
                // Apply the adjustments as relative changes
                const adjustedHue = Math.min(Math.max(this.hueSlider.value + this.properties.hueAdjustment, 0), 1);
                const adjustedSaturation = Math.min(Math.max(this.saturationSlider.value + this.properties.saturationAdjustment, 0), 1);
                const adjustedBrightness = Math.min(Math.max(this.brightnessSlider.value + this.properties.brightnessAdjustment, 0), 1);

                // Create the adjusted HSV object
                const adjustedHsvInfo = {
                    hue: adjustedHue,
                    saturation: adjustedSaturation,
                    brightness: adjustedBrightness * 254  // Scale brightness back to 0-254
                };

                // Log only when adjustments are made by the user
                if (fromUserAction) {
                    console.log("Adjusted HSV Info:", adjustedHsvInfo);
                }

                // Update color swatch
                this.updateColorSwatch(adjustedHsvInfo);

                // Send the adjusted HSV object to the output
                this.setOutputData(0, adjustedHsvInfo);
            }
        }
    }

    updateColorSwatch(hsvInfo) {
        // Convert HSV to RGB for accurate color display
        const rgb = this.hsvToRgb(hsvInfo.hue, hsvInfo.saturation, hsvInfo.brightness / 254);
        const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.boxcolor = color;

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

    onDrawForeground(ctx) {
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    onResize() {
        this.size = [300, 180]; // Force size on resize to accommodate color swatch and toggle
    }

    onStart() {
        this.size = [300, 180]; // Force size when the node starts to accommodate color swatch and toggle
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/CC_Control_Nodes/hue_light_grade", HueLightGradeNode);
