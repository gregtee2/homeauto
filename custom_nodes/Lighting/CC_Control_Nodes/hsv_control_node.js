class HSVControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Control Test";

        // Set the default size explicitly in the constructor
        this.size = [425, 235]; 

        this.properties = {
            hueShift: 0.10,
            saturation: 0.20,
            brightness: 128,
            enableCommand: false,  // Toggle to enable/disable command sending
            lastHsvInfo: { hue: 0, saturation: 1.0, brightness: 254 }  // Store the last HSV settings
        };

        // Existing widgets for sliders
        this.hueShiftSlider = this.addWidget("slider", "Hue Shift", this.properties.hueShift, (value) => {
            this.properties.hueShift = Math.round(value);
            this.updateHueShiftWidgets();
            this.debounceStoreAndMaybeSendHSV();
        }, { min: 0, max: 360 });

        this.saturationSlider = this.addWidget("slider", "Saturation", this.properties.saturation, (value) => {
            this.properties.saturation = value;
            this.debounceStoreAndMaybeSendHSV();
        }, { min: 0, max: 1 });

        this.brightnessSlider = this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
            this.debounceStoreAndMaybeSendHSV();
        }, { min: 0, max: 254 });

        this.addWidget("toggle", "Enable Time Trigger", this.properties.enableCommand, (value) => {
            this.properties.enableCommand = value;
        });

        // Restoring the HSV Info output
        this.addOutput("HSV Info", "hsv_info");

        // Colors represented as clickable boxes, aligned horizontally
        this.colorOptions = [
            { color: "#FF0000", hsv: { hue: 0, saturation: 1, brightness: 254 } },   // Red
            { color: "#FFA500", hsv: { hue: 30, saturation: 1, brightness: 254 } },  // Orange
            { color: "#FFFF00", hsv: { hue: 60, saturation: 1, brightness: 254 } },  // Yellow
            { color: "#00FF00", hsv: { hue: 120, saturation: 1, brightness: 254 } }, // Green
            { color: "#0000FF", hsv: { hue: 240, saturation: 1, brightness: 254 } }, // Blue
            { color: "#00FFFF", hsv: { hue: 180, saturation: 1, brightness: 254 } }, // Cyan
            { color: "#800080", hsv: { hue: 270, saturation: 1, brightness: 254 } }, // Purple
            { color: "#FFFFFF", hsv: { hue: 0, saturation: 0, brightness: 254 } }    // White
        ];

        this.selectedColor = null; // To track which color box is clicked
    }

    // Override the serialization function to store the node size explicitly
    onSerialize(o) {
        o.size = this.size; // Ensure the size is serialized
        o.properties = this.properties;
    }

    // Override the configuration function to restore the node size
    onConfigure(o) {
        this.size = o.size || [425, 235]; // Restore the size from serialized data
        this.properties = o.properties;
    }

    // Function to set the HSV values when a color box is clicked
    setHSV(hsv) {
        this.properties.hueShift = hsv.hue;
        this.properties.saturation = hsv.saturation;
        this.properties.brightness = hsv.brightness;

        // Update all sliders
        this.updateHueShiftWidgets();
        this.saturationSlider.value = hsv.saturation;
        this.brightnessSlider.value = hsv.brightness;

        // Trigger the debounce and send the new HSV values
        this.debounceStoreAndMaybeSendHSV();
    }

    debounceStoreAndMaybeSendHSV() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set a delay to allow the user to finish moving the slider
        this.debounceTimer = setTimeout(() => {
            this.storeAndMaybeSendHSV();
            this.updateColorSwatch(); // Ensure the swatch is updated after changes
        }, 300); // Adjust the debounce delay as needed
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
        }
    }

    updateHueShiftWidgets() {
        this.hueShiftSlider.value = this.properties.hueShift;
    }

    updateColorSwatch() {
        const rgb = this.hsvToRgb(this.properties.hueShift / 360, this.properties.saturation, this.properties.brightness / 254);
        const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.boxcolor = color;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    // Override the drawing function to draw color boxes and color swatch
    onDrawForeground(ctx) {
        const boxSize = 40;  // Size of each color box
        const margin = 10;   // Margin between color boxes
        const startX = 10;   // Starting X position for the color boxes
        const startY = this.size[1] - 90; // Starting Y position for the color boxes

        // Draw each color box
        this.colorOptions.forEach((option, index) => {
            const x = startX + (index * (boxSize + margin));
            const y = startY;

            // Draw color box
            ctx.fillStyle = option.color;
            ctx.fillRect(x, y, boxSize, boxSize);

            // Add a border if this box is selected
            if (this.selectedColor === option.color) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, boxSize, boxSize);
            }
        });

        // Draw the color swatch at the bottom to show the color being sent to the light
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    // Handle mouse click events to detect when a color box is clicked
    onMouseDown(event, localPos, graphCanvas) {
        const boxSize = 40;  // Size of each color box
        const margin = 10;   // Margin between color boxes
        const startX = 10;   // Starting X position for the color boxes
        const startY = this.size[1] - 90; // Starting Y position for the color boxes

        // Check if the click was within one of the color boxes
        this.colorOptions.forEach((option, index) => {
            const x = startX + (index * (boxSize + margin));
            const y = startY;

            // Check if click is within the bounds of this box
            if (
                localPos[0] > x && localPos[0] < x + boxSize &&
                localPos[1] > y && localPos[1] < y + boxSize
            ) {
                // Update the selected color and set HSV values
                this.selectedColor = option.color;
                this.setHSV(option.hsv);
            }
        });
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

    // Force the node size on resize
    onResize() {
        this.size = [425, 235]; 
    }

    // Force the node size when the graph starts
    onStart() {
        this.size = [425, 235]; 
    }

    // Override the serialization method
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    // Override the configuration method
    configure(data) {
        super.configure(data);
        this.properties = data.properties || {
            hueShift: 0, saturation: 1.0, brightness: 254, enableCommand: false, lastHsvInfo: { hue: 0, saturation: 1.0, brightness: 254 }
        };

        this.updateHueShiftWidgets();
        this.updateColorSwatch();
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/CC_Control_Nodes/hsv_control", HSVControlNode);





















/*class HSVControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Control Test";
        this.size = [360, 256]; // Forced node size

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
            this.debounceStoreAndMaybeSendHSV();
        }, { min: 0, max: 360 });

        this.hueShiftInput = this.addWidget("number", "Hue Shift Value", this.properties.hueShift, (value) => {
            this.properties.hueShift = Math.round(value);
            this.updateHueShiftWidgets();
            this.debounceStoreAndMaybeSendHSV();
        }, { step: 50 });

        this.addWidget("slider", "Saturation", this.properties.saturation, (value) => {
            this.properties.saturation = value;
            this.debounceStoreAndMaybeSendHSV();
        }, { min: 0, max: 1 });

        this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
            this.debounceStoreAndMaybeSendHSV();
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

        this.debounceTimer = null; // Initialize the debounce timer
    }

    debounceStoreAndMaybeSendHSV() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set a delay to allow the user to finish moving the slider
        this.debounceTimer = setTimeout(() => {
            this.storeAndMaybeSendHSV();
            this.updateColorSwatch(); // Ensure the swatch is updated after changes
        }, 300); // Adjust the debounce delay as needed
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
            console.log("Final HSV update sent:", hsvInfo); // Only log the final update
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

    onResize() {
        this.size = [360, 256]; // Reapply the forced node size on resize
    }

    onStart() {
        this.size = [360, 256]; // Reapply the forced node size on start
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
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/CC_Control_Nodes/hsv_control", HSVControlNode);*/
