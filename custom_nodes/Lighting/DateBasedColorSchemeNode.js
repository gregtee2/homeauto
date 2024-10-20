class DateBasedColorSchemeNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Date-Based Color Scheme";
        this.size = [350, 200];

        // Initialize properties
        this.properties = {
            colorSchemes: [],
            selectedLights: [] // Array of light entity IDs or names
        };

        // Widgets
        this.addWidget("button", "Add Scheme", "Add", () => this.addColorScheme());
        this.addWidget("button", "Remove Scheme", "Remove", () => this.removeColorScheme());

        // Internal state
        this.currentScheme = null;

        // Add storage for last known HSV Info data
        this.lastHSVInfoData = [];
        this.triggerActivated = false; // New flag to track if the trigger has been activated

        // Initialize scheme widgets if any exist
        this.updateSchemesWidgets();
    }

    /**
     * Method to add a new color scheme
     */
    addColorScheme() {
        const newScheme = {
            name: `Scheme ${this.properties.colorSchemes.length + 1}`,
            type: "dateRange", // Options: dateRange, recurring
            startDate: "01-01", // MM-DD format
            endDate: "12-31",   // MM-DD format
            hsvInfoCount: 2,    // Number of HSV Info inputs per scheme
            colors: [
                { hue: 0, saturation: 1, brightness: 254 },   // Default color
                { hue: 120, saturation: 1, brightness: 254 } // Default color
            ]
        };
        this.properties.colorSchemes.push(newScheme);
        console.log(`Added ${newScheme.name}`);

        // Initialize lastHSVInfoData for the new scheme
        this.lastHSVInfoData.push([]);

        // Add scheme-specific inputs and outputs with fixed index-based names
        const schemeIndex = this.properties.colorSchemes.length - 1;

        // Use index-based names for the inputs/outputs, not the scheme name
        this.addInput(`Scheme_${schemeIndex}_Trigger`, "boolean");
        for (let i = 1; i <= newScheme.hsvInfoCount; i++) {
            this.addInput(`Scheme_${schemeIndex}_HSV_Info_${i}`, "hsv_info");
        }

        this.addOutput(`Scheme_${schemeIndex}_Trigger`, "boolean");
        for (let i = 1; i <= newScheme.hsvInfoCount; i++) {
            this.addOutput(`Scheme_${schemeIndex}_HSV_Info_${i}`, "hsv_info");
        }

        // Update widgets and canvas
        this.updateSchemesWidgets();
        this.setDirtyCanvas(true);
    }

    /**
     * Method to remove the last color scheme
     */
    removeColorScheme() {
        if (this.properties.colorSchemes.length > 0) {
            const removedScheme = this.properties.colorSchemes.pop();
            console.log(`Removed ${removedScheme.name}`);

            // Remove the corresponding data in lastHSVInfoData
            this.lastHSVInfoData.pop();

            // Remove scheme-specific inputs and outputs
            const schemeIndex = this.properties.colorSchemes.length; // After pop
            const schemeName = `Scheme_${schemeIndex}`;

            // Remove inputs
            for (let i = this.inputs.length - 1; i >= 0; i--) {
                if (
                    this.inputs[i].name.startsWith(`${schemeName}_Trigger`) ||
                    this.inputs[i].name.startsWith(`${schemeName}_HSV_Info`)
                ) {
                    console.log(`Removing input: ${this.inputs[i].name}`);
                    this.removeInput(i);
                }
            }

            // Remove outputs
            for (let i = this.outputs.length - 1; i >= 0; i--) {
                if (
                    this.outputs[i].name.startsWith(`${schemeName}_Trigger`) ||
                    this.outputs[i].name.startsWith(`${schemeName}_HSV_Info`)
                ) {
                    console.log(`Removing output: ${this.outputs[i].name}`);
                    this.removeOutput(i);
                }
            }

            // Update widgets and canvas
            this.updateSchemesWidgets();
            this.setDirtyCanvas(true);
        } else {
            console.warn("No schemes to remove.");
        }
    }

    /**
     * Method to update scheme configuration widgets
     */
    updateSchemesWidgets() {
        console.log("Updating scheme widgets...");

        // Step 1: Remove existing scheme widgets
        for (let i = this.widgets.length - 1; i >= 0; i--) {
            if (this.widgets[i].name.startsWith("Scheme")) {
                console.log(`Removing widget: ${this.widgets[i].name}`);
                this.widgets.splice(i, 1);
            }
        }

        // Step 2: Add widgets for each scheme
        this.properties.colorSchemes.forEach((scheme, index) => {
            this.addColorSchemeWidgets(scheme, index);
        });

        // Step 3: Adjust node size based on the number of schemes
        this.size[1] = 200 + this.properties.colorSchemes.length * 100; // Adjusted base height
        console.log(`Node size set to ${this.size[1]}px height`);

        // Step 4: Refresh the Inspector Panel synchronously
        this.setDirtyCanvas(true);
        console.log("Inspector Panel refreshed.");
    }

    /**
     * Method to create widgets for a single scheme
     * @param {object} scheme - The color scheme object
     * @param {number} index - The index of the scheme
     */
    addColorSchemeWidgets(scheme, index) {
        const baseName = `Scheme ${index + 1}`;

        // Scheme Name
        this.addWidget(
            "text",
            `${baseName} - Name`,
            scheme.name,
            (value) => {
                this.properties.colorSchemes[index].name = value;
                this.setDirtyCanvas(true);
                console.log(`${baseName} name changed to ${value}`);
            },
            { multiline: false, hint: "Enter Scheme Name" }
        );

        // Scheme Type
        this.addWidget(
            "combo",
            `${baseName} - Type`,
            scheme.type,
            (value) => {
                this.properties.colorSchemes[index].type = value;
                this.setDirtyCanvas(true);
                console.log(`${baseName} type changed to ${value}`);
            },
            { values: ["dateRange", "recurring"] }
        );

        // Start Date
        this.addWidget(
            "text",
            `${baseName} - Start Date`,
            scheme.startDate,
            (value) => {
                if (this.isValidDate(value)) {
                    this.properties.colorSchemes[index].startDate = value;
                    this.setDirtyCanvas(true);
                    console.log(`${baseName} start date set to ${value}`);
                } else {
                    alert("Invalid Start Date format. Use MM-DD.");
                }
            },
            { multiline: false, hint: "MM-DD" }
        );

        // End Date
        this.addWidget(
            "text",
            `${baseName} - End Date`,
            scheme.endDate,
            (value) => {
                if (this.isValidDate(value)) {
                    this.properties.colorSchemes[index].endDate = value;
                    this.setDirtyCanvas(true);
                    console.log(`${baseName} end date set to ${value}`);
                } else {
                    alert("Invalid End Date format. Use MM-DD.");
                }
            },
            { multiline: false, hint: "MM-DD" }
        );
    }

    /**
     * Helper function to validate date format MM-DD
     * @param {string} dateStr - The date string to validate
     * @returns {boolean} True if valid, else false
     */
    isValidDate(dateStr) {
        return /^\d{2}-\d{2}$/.test(dateStr);
    }

    /**
     * Checks if the current date is within the given start and end dates.
     * @param {string} start - Start date in MM-DD format.
     * @param {string} end - End date in MM-DD format.
     * @returns {boolean} True if current date is within the range, else false.
     */
    isCurrentDateInRange(start, end) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // Months are 0-based
        const currentDay = today.getDate();

        // Parse start and end dates
        const [startMonth, startDay] = start.split("-").map(Number);
        const [endMonth, endDay] = end.split("-").map(Number);

        // Create Date objects for start and end dates
        const startDate = new Date(currentYear, startMonth - 1, startDay);
        let endDate = new Date(currentYear, endMonth - 1, endDay);

        // Handle year rollover (e.g., start in December, end in January)
        if (endDate < startDate) {
            endDate = new Date(currentYear + 1, endMonth - 1, endDay);
        }

        // Current date
        const currentDate = new Date(currentYear, currentMonth, currentDay);

        // Check if current date is within the range
        return currentDate >= startDate && currentDate <= endDate;
    }

    /**
     * Executes the node's main functionality.
     * Triggered by LiteGraph.
     */
    onExecute() {
        this.properties.colorSchemes.forEach((scheme, index) => {
            const hsvInfoCount = scheme.hsvInfoCount || 2; // Default to 2 if not set

            // Calculate base input and output indices
            const baseInputIndex = index * (1 + hsvInfoCount);
            const baseOutputIndex = index * (1 + hsvInfoCount);

            // Retrieve Trigger input
            const schemeTrigger = this.getInputData(baseInputIndex); // Scheme {n} Trigger input

            // Check if the current date is within the scheme's date range
            const isInDateRange = this.isCurrentDateInRange(scheme.startDate, scheme.endDate);

            // Check if the trigger input is activated (true) and in date range
            const triggerOutput = (schemeTrigger && isInDateRange) ? true : null;

            // If trigger is activated for the first time, set the flag
            if (schemeTrigger && !this.triggerActivated) {
                this.triggerActivated = true;
            }

            // Only send the trigger output if the trigger has been activated at least once
            if (this.triggerActivated) {
                this.setOutputData(baseOutputIndex, triggerOutput); // Scheme {n} Trigger output
            }

            // If Trigger is activated and in date range, send Trigger to HSV Control Nodes
            if (triggerOutput) {
                for (let i = 0; i < hsvInfoCount; i++) {
                    const inputIndex = baseInputIndex + 1 + i;
                    const inputLink = this.inputs[inputIndex].link;
                    if (inputLink !== null && inputLink !== undefined) {
                        const link = this.graph.links[inputLink];
                        if (link) {
                            const linkedNode = this.graph.getNodeById(link.origin_id);
                            if (linkedNode && typeof linkedNode.onAction === "function") {
                                linkedNode.onAction("Trigger", null);
                            }
                        }
                    }
                }
            }

            // Retrieve all HSV Info inputs
            const schemeHSVInputs = [];
            for (let i = 0; i < hsvInfoCount; i++) {
                const inputIndex = baseInputIndex + 1 + i;
                const hsvInputData = this.getInputData(inputIndex); // Scheme {n} HSV Info {i+1} input
                schemeHSVInputs.push(hsvInputData);
            }

            // Handle HSV Info Outputs
            for (let i = 0; i < hsvInfoCount; i++) {
                const hsvData = schemeHSVInputs[i];
                const outputIndex = baseOutputIndex + 1 + i; // Scheme {n} HSV Info {i+1} output

                if (hsvData && isInDateRange) {
                    this.setOutputData(outputIndex, hsvData);
                } else {
                    this.setOutputData(outputIndex, null);
                }
            }
        });
    }

    /**
     * Serializes the node's state for saving.
     * @returns {object} Serialized data.
     */
    serialize() {
        const data = super.serialize();

        // Properly serialize inputs/outputs with links
        data.inputs = this.inputs.map(input => ({
            name: input.name,
            type: input.type,
            link: input.link || null  // Ensure null-safe serialization
        }));
        data.outputs = this.outputs.map(output => ({
            name: output.name,
            type: output.type
        }));

        // Serialize node-specific properties (color schemes, etc.)
        data.properties = this.properties;

        console.log("Serialized Data:", data);  // For debugging
        return data;
    }


    /**
     * Configures the node from serialized data.
     * @param {object} data Serialized data.
     */
    configure(data) {
        super.configure(data);
        this.properties = { ...this.properties, ...data.properties };

        // Reset internal state
        this.lastHSVInfoData = [];

        // Iterate over inputs/outputs instead of removing everything blindly
        // Match existing inputs/outputs to serialized data and adjust accordingly

        // Handle inputs
        const serializedInputs = data.inputs || [];
        serializedInputs.forEach((inputData, index) => {
            // Check if the input already exists
            if (this.inputs[index]) {
                if (this.inputs[index].name !== inputData.name || this.inputs[index].type !== inputData.type) {
                    // Input has changed, update it
                    this.removeInput(index);
                    this.addInput(inputData.name, inputData.type);
                    console.log(`Updated input ${inputData.name}`);
                }
            } else {
                // Input doesn't exist, add it
                this.addInput(inputData.name, inputData.type);
                console.log(`Added input ${inputData.name}`);
            }
        });

        // Remove any extra inputs that weren't in the serialized data
        while (this.inputs.length > serializedInputs.length) {
            this.removeInput(this.inputs.length - 1);
            console.log("Removed extra input");
        }

        // Handle outputs
        const serializedOutputs = data.outputs || [];
        serializedOutputs.forEach((outputData, index) => {
            if (this.outputs[index]) {
                if (this.outputs[index].name !== outputData.name || this.outputs[index].type !== outputData.type) {
                    this.removeOutput(index);
                    this.addOutput(outputData.name, outputData.type);
                    console.log(`Updated output ${outputData.name}`);
                }
            } else {
                this.addOutput(outputData.name, outputData.type);
                console.log(`Added output ${outputData.name}`);
            }
        });

        while (this.outputs.length > serializedOutputs.length) {
            this.removeOutput(this.outputs.length - 1);
            console.log("Removed extra output");
        }

        // Relink inputs/outputs with existing connections after graph has loaded
        setTimeout(() => {
            serializedInputs.forEach((inputData, i) => {
                const linkId = inputData.link;
                if (linkId !== null && linkId !== undefined && this.graph.links[linkId]) {
                    const link = this.graph.links[linkId];
                    link.target_id = this.id;
                    link.target_slot = i;
                    console.log(`Re-linked input ${inputData.name} to slot ${i}`);
                } else {
                    console.warn(`No link found for input ${inputData.name}`);
                }
            });

            serializedOutputs.forEach((outputData, i) => {
                const linkId = outputData.link;
                if (linkId !== null && linkId !== undefined && this.graph.links[linkId]) {
                    const link = this.graph.links[linkId];
                    link.origin_id = this.id;
                    link.origin_slot = i;
                    console.log(`Re-linked output ${outputData.name} to slot ${i}`);
                } else {
                    console.warn(`No link found for output ${outputData.name}`);
                }
            });
        }, 100);

        console.log("DateBasedColorSchemeNode inputs after configure:", this.inputs);
        console.log("DateBasedColorSchemeNode outputs after configure:", this.outputs);

        // Update widgets and canvas
        this.updateSchemesWidgets();
        this.setDirtyCanvas(true);
    }




}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/DateBasedColorScheme", DateBasedColorSchemeNode);
