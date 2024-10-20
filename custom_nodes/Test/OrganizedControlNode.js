class DateBasedColorSchemeNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Date-Based Color Scheme";
        this.size = [400, 300];

        // Define inputs and outputs
        this.addInput("Trigger", "boolean"); // Activates the node
        this.addOutput("HSV Info", "object");
        this.addOutput("Status", "string");

        // Initialize properties
        this.properties = {
            colorSchemes: [
                // Example entry
                // {
                //     name: "Halloween",
                //     type: "dateRange", // or "recurring"
                //     startDate: "10-01", // MM-DD format
                //     endDate: "10-31",
                //     colors: [
                //         { hue: 30, saturation: 1, brightness: 254 }, // Orange
                //         { hue: 270, saturation: 1, brightness: 254 } // Purple
                //     ],
                //     selectedLights: ["light.outside1", "light.outside2"]
                // }
            ]
        };

        // Widgets
        this.addWidget("button", "Add Scheme", "Add", () => this.addColorScheme());
        this.addWidget("button", "Remove Scheme", "Remove", () => this.removeColorScheme());

        // Internal state
        this.currentScheme = null;
    }

    addColorScheme() {
        const newScheme = {
            name: `Scheme ${this.properties.colorSchemes.length + 1}`,
            type: "dateRange", // Options: dateRange, recurring
            startDate: "01-01",
            endDate: "12-31",
            recurrence: null, // e.g., "Monday", "Weekends" for recurring
            colors: [
                { hue: 0, saturation: 1, brightness: 254 }, // Default color
                { hue: 120, saturation: 1, brightness: 254 }
            ],
            selectedLights: [] // Array of light entity IDs or names
        };
        this.properties.colorSchemes.push(newScheme);
        this.updateSchemesWidgets();
        this.setDirtyCanvas(true);
    }

    removeColorScheme() {
        if (this.properties.colorSchemes.length > 0) {
            this.properties.colorSchemes.pop();
            this.updateSchemesWidgets();
            this.setDirtyCanvas(true);
        }
    }

    updateSchemesWidgets() {
        // Remove existing scheme widgets
        this.widgets = this.widgets.filter(widget => !widget.name.startsWith("Scheme"));

        // Add widgets for each color scheme
        this.properties.colorSchemes.forEach((scheme, index) => {
            this.addColorSchemeWidgets(scheme, index);
        });
    }

    addColorSchemeWidgets(scheme, index) {
        const baseName = `Scheme ${index + 1}`;

        // Scheme Name
        this.addWidget("text", `${baseName} - Name`, scheme.name, (value) => {
            this.properties.colorSchemes[index].name = value;
        }, { multiline: false });

        // Scheme Type
        this.addWidget("combo", `${baseName} - Type`, scheme.type, (value) => {
            this.properties.colorSchemes[index].type = value;
            this.setDirtyCanvas(true);
        }, { values: ["dateRange", "recurring"] });

        // Depending on the type, show different widgets
        if (scheme.type === "dateRange") {
            // Start Date
            this.addWidget("text", `${baseName} - Start Date`, scheme.startDate, (value) => {
                this.properties.colorSchemes[index].startDate = value;
            }, { multiline: false });

            // End Date
            this.addWidget("text", `${baseName} - End Date`, scheme.endDate, (value) => {
                this.properties.colorSchemes[index].endDate = value;
            }, { multiline: false });
        } else if (scheme.type === "recurring") {
            // Recurrence Pattern
            this.addWidget("combo", `${baseName} - Recurrence`, scheme.recurrence || "Monday", (value) => {
                this.properties.colorSchemes[index].recurrence = value;
            }, { values: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Weekends", "Weekdays"] });
        }

        // Color Selection
        scheme.colors.forEach((color, colorIndex) => {
            this.addWidget("color", `${baseName} - Color ${colorIndex + 1}`, this.rgbToHex(this.hsvToRgb(color.hue / 360, color.saturation, color.brightness / 254)), (value) => {
                const rgb = this.hexToRgb(value);
                const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
                this.properties.colorSchemes[index].colors[colorIndex] = {
                    hue: hsv.h,
                    saturation: hsv.s,
                    brightness: hsv.v * 254
                };
            });
        });

        // Light Selection
        this.addWidget("multi_select", `${baseName} - Lights`, scheme.selectedLights, (values) => {
            this.properties.colorSchemes[index].selectedLights = values;
        }, { values: this.getAllLights(), multiple: true });

        // Optionally, add widgets to add more colors or manage the color array
    }

    // Placeholder function to retrieve all available lights
    getAllLights() {
        // This should fetch available light entities from your system
        // For demonstration, return a static list
        return ["light.outside1", "light.outside2", "light.inside1", "light.inside2"];
    }

    // Helper functions to convert between color formats
    hsvToRgb(h, s, v) {
        let r, g, b;

        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        return {
            r: r * 255,
            g: g * 255,
            b: b * 255
        };
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;

        let d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h, s, v };
    }

    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join('');
    }

    hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Function to determine current date and select appropriate color scheme
    evaluateDateScheme() {
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // Months are 0-based
        const currentDate = today.getDate();
        const currentDay = today.getDay(); // 0 (Sunday) to 6 (Saturday)

        for (let scheme of this.properties.colorSchemes) {
            if (scheme.type === "dateRange") {
                const [startMonth, startDay] = scheme.startDate.split("-").map(Number);
                const [endMonth, endDay] = scheme.endDate.split("-").map(Number);

                const start = new Date(today.getFullYear(), startMonth - 1, startDay);
                const end = new Date(today.getFullYear(), endMonth - 1, endDay);

                if (today >= start && today <= end) {
                    this.currentScheme = scheme;
                    return;
                }
            } else if (scheme.type === "recurring") {
                if (scheme.recurrence === "Weekends" && (currentDay === 0 || currentDay === 6)) {
                    this.currentScheme = scheme;
                    return;
                } else if (scheme.recurrence === "Monday" && currentDay === 1) {
                    this.currentScheme = scheme;
                    return;
                }
                // Add more patterns as needed
            }
        }

        this.currentScheme = null; // No matching scheme found
    }

    onExecute() {
        const trigger = this.getInputData(0);
        if (trigger) {
            this.evaluateDateScheme();

            if (this.currentScheme) {
                // Prepare HSV output object
                const hsvOutput = {};

                // Distribute colors to selected lights, cycling through colors if necessary
                this.currentScheme.selectedLights.forEach((lightId, index) => {
                    const color = this.currentScheme.colors[index % this.currentScheme.colors.length];
                    hsvOutput[lightId] = {
                        hue: color.hue / 360,           // Normalize to 0-1
                        saturation: color.saturation,    // 0-1
                        brightness: color.brightness / 254 // Normalize to 0-1
                    };
                });

                // Output the HSV info object
                this.setOutputData(0, hsvOutput);
                this.setOutputData(1, `Applied scheme: ${this.currentScheme.name}`);
            } else {
                this.setOutputData(1, "No matching color scheme for today.");
            }
        }
    }

    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = { ...this.properties, ...data.properties };
        this.updateSchemesWidgets();
        this.setDirtyCanvas(true);
    }
}

LiteGraph.registerNodeType("Lighting/DateBasedColorScheme", DateBasedColorSchemeNode);
