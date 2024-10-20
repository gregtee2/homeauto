class HSVControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Control Test";
        this.size = [425, 235];

        this.properties = {
            hueShift: 0.10,
            saturation: 0.20,
            brightness: 128,
            enableCommand: false,
            lastHsvInfo: { hue: 0, saturation: 1.0, brightness: 254 }
        };

        this.selectedColor = null;
        this.memoizedHSVToRGB = {};
        this.debounceTimer = null;

        this.sliders = {}; // Initialize an object to hold slider references

        const slidersConfig = [
            { name: "Hue Shift", property: "hueShift", min: 0, max: 360, type: "slider" },
            { name: "Saturation", property: "saturation", min: 0, max: 1, type: "slider" },
            { name: "Brightness", property: "brightness", min: 0, max: 254, type: "slider" }
        ];

        slidersConfig.forEach(({ name, property, min, max, type }) => {
            const slider = this.addWidget(type, name, this.properties[property], (value) => {
                this.properties[property] = value;
                this.updateColorSwatch(); // Immediate visual update
                this.debounceStoreAndSendHSV(); // Debounce API updates
            }, { min, max });
            this.sliders[property] = slider; // Store the slider reference
        });

        // Manual toggle to allow final command sending
        this.addWidget("toggle", "Enable Time Trigger", this.properties.enableCommand, (value) => {
            this.properties.enableCommand = value;
        });

        // Add Trigger input
        this.addInput("Trigger", LiteGraph.ACTION);

        // Output widget
        this.addOutput("HSV Info", "hsv_info");

        // Color swatches
        this.colorOptions = [
            { color: "#FF0000", hsv: { hue: 0, saturation: 1, brightness: 254 } },    // Red
            { color: "#FFA500", hsv: { hue: 30, saturation: 1, brightness: 254 } },   // Orange
            { color: "#FFFF00", hsv: { hue: 60, saturation: 1, brightness: 254 } },   // Yellow
            { color: "#00FF00", hsv: { hue: 120, saturation: 1, brightness: 254 } },  // Green
            { color: "#0000FF", hsv: { hue: 240, saturation: 1, brightness: 254 } },  // Blue
            { color: "#00FFFF", hsv: { hue: 180, saturation: 1, brightness: 254 } },  // Cyan
            { color: "#800080", hsv: { hue: 270, saturation: 1, brightness: 254 } },  // Purple
            { color: "#FFFFFF", hsv: { hue: 0, saturation: 0, brightness: 254 } }     // White
        ];
    }

    debounceStoreAndSendHSV() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce the actual API updates (e.g., 200ms delay)
        this.debounceTimer = setTimeout(() => {
            this.storeAndSendHSV();
        }, 200);
    }

    storeAndSendHSV() {
        const hsvInfo = {
            hue: this.properties.hueShift / 360, // Convert to 0-1 range
            saturation: this.properties.saturation,
            brightness: this.properties.brightness
        };

        this.properties.lastHsvInfo = hsvInfo;

        // Always output HSV Info when storeAndSendHSV is called
        this.setOutputData(0, hsvInfo);
    }

    onAction(action, param) {
        if (action === "Trigger") {
            // Output current HSV Info immediately
            this.storeAndSendHSV();
        }
    }

    updateColorSwatch() {
        const rgb = this.hsvToRgb(
            this.properties.hueShift / 360,
            this.properties.saturation,
            this.properties.brightness / 254
        );
        const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        this.boxcolor = color;

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

    drawColorBoxes(ctx) {
        if (this.flags.collapsed) {
            return; // Don't draw the color boxes if the node is collapsed
        }

        const boxSize = 40;
        const margin = 10;
        const startX = 10;
        const startY = this.size[1] - 90;

        this.colorOptions.forEach((option, index) => {
            const x = startX + (index * (boxSize + margin));
            const y = startY;

            ctx.fillStyle = option.color;
            ctx.fillRect(x, y, boxSize, boxSize);

            if (this.selectedColor === option.color) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, boxSize, boxSize);
            }
        });
    }

    onDrawForeground(ctx) {
        if (this.flags.collapsed) {
            return; // Skip drawing foreground if the node is collapsed
        }

        this.drawColorBoxes(ctx);

        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }

    onMouseDown(event, localPos, graphCanvas) {
        if (this.flags.collapsed) {
            return; // Skip interaction if the node is collapsed
        }

        const boxSize = 40;
        const margin = 10;
        const startX = 10;
        const startY = this.size[1] - 90;

        this.colorOptions.forEach((option, index) => {
            const x = startX + (index * (boxSize + margin));
            const y = startY;

            if (
                localPos[0] > x && localPos[0] < x + boxSize &&
                localPos[1] > y && localPos[1] < y + boxSize
            ) {
                this.selectedColor = option.color;
                this.setHSV(option.hsv);
            }
        });
    }

    setHSV(hsv) {
        this.properties.hueShift = hsv.hue;           // hsv.hue in degrees (0-360)
        this.properties.saturation = hsv.saturation;  // hsv.saturation (0-1)
        this.properties.brightness = hsv.brightness;  // hsv.brightness (0-254)

        // Update the sliders to reflect new values
        if (this.sliders.hueShift) {
            this.sliders.hueShift.value = this.properties.hueShift;
        }
        if (this.sliders.saturation) {
            this.sliders.saturation.value = this.properties.saturation;
        }
        if (this.sliders.brightness) {
            this.sliders.brightness.value = this.properties.brightness;
        }

        this.setDirtyCanvas(true);

        this.updateColorSwatch(); // Immediate visual update
        this.debounceStoreAndSendHSV(); // Debounced API update
    }

    onResize() {
        this.size = [425, 235];
    }

    onStart() {
        this.size = [425, 235];
    }

    serialize() {
        const data = super.serialize();
        data.properties = { ...this.properties };
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = { ...this.properties, ...data.properties };
        this.updateColorSwatch();
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/CC_Control_Nodes/hsv_control", HSVControlNode);
