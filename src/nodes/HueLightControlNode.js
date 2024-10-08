// File: src/nodes/HueLightControlNode.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Lighting/HueLightControlNode"]) {
    class HueLightControlNode extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Hue Light Control";
            this.size = [400, 200]; // Increased size to accommodate multiple widgets

            // Define properties
            this.properties = {
                selectedLightIds: [], // Array to hold multiple Hue light IDs
                selectedLightNames: [] // Array to hold multiple Hue light names
            };

            // Define inputs and outputs
            this.addInput("Add Light", "action"); // Button to add a new light control
            this.addInput("Remove Light", "action"); // Button to remove the last light control
            this.addInput("HSV Info", "hsv_info"); // HSV Control
            this.addInput("Trigger", "boolean"); // On/Off Control
            this.addOutput("Lights Info", "object"); // Output aggregated info

            // Initialize widgets
            this.setupWidgets();

            // Internal state
            this.devices = []; // List of Hue devices
            this.deviceManagerReady = false; // Flag indicating if devices are loaded

            // Bind methods
            this.onAddLight = this.onAddLight.bind(this);
            this.onRemoveLight = this.onRemoveLight.bind(this);
            this.onLightSelected = this.onLightSelected.bind(this);
            this.fetchDevices = this.fetchDevices.bind(this);
            this.handleHSVInput = this.handleHSVInput.bind(this);
            this.handleTrigger = this.handleTrigger.bind(this);

            // State tracking for input change detection
            this.previousHSV = { hue: null, saturation: null, brightness: null };
            this.previousTrigger = null;

            // Debounce timer for HSV inputs
            this.hsvDebounceTimer = null;
            this.HSV_DEBOUNCE_DELAY = 300; // milliseconds

            console.log("HueLightControlNode - Initialized.");
        }

        /**
         * Sets up all widgets with proper callbacks or property bindings.
         */
        setupWidgets() {
            // Button to add a new light selection
            this.addLightButton = this.addWidget(
                "button",
                "Add Light",
                "Add",
                () => {
                    this.onAddLight();
                }
            );

            // Button to remove the last light selection
            this.removeLightButton = this.addWidget(
                "button",
                "Remove Light",
                "Remove",
                () => {
                    this.onRemoveLight();
                }
            );

            // Container for multiple light selectors
            this.lightSelectors = [];

            console.log("HueLightControlNode - Widgets set up.");
        }

        /**
         * Called when the node is added to the graph.
         * Initiates device fetching.
         */
        onAdded() {
            this.fetchDevices();
        }

        /**
         * Fetches Hue devices asynchronously.
         */
        async fetchDevices() {
            console.log("HueLightControlNode - Fetching Hue devices...");
            try {
                // Removed "HueLight" parameter to fetch all devices
                const devices = await window.deviceManager.getDevices();

                console.log("HueLightControlNode - Devices fetched:", devices); // Debug log

                if (devices && Array.isArray(devices) && devices.length > 0) {
                    this.devices = devices;
                    this.deviceManagerReady = true;
                    console.log(`HueLightControlNode - Retrieved devices: ${devices.length}`);
                } else {
                    throw new Error("No Hue Light devices found.");
                }
            } catch (error) {
                console.error("HueLightControlNode - Error fetching devices:", error);
                // Optionally, disable Add Light button if devices can't be fetched
                this.addLightButton.disabled = true;
                this.removeLightButton.disabled = true;
            }
        }

        /**
         * Adds a new light selector dropdown.
         */
        onAddLight() {
            if (!this.deviceManagerReady) {
                console.warn("HueLightControlNode - Device manager not ready.");
                return;
            }

            // Limit the number of selectable lights if desired
            const MAX_LIGHTS = 10;
            if (this.lightSelectors.length >= MAX_LIGHTS) {
                console.warn(`HueLightControlNode - Maximum of ${MAX_LIGHTS} lights reached.`);
                return;
            }

            // Create a new dropdown for light selection
            const lightSelector = this.addWidget(
                "combo",
                `Select Light ${this.lightSelectors.length + 1}`,
                "Select Light",
                (value) => {
                    this.onLightSelected(value, this.lightSelectors.indexOf(lightSelector));
                },
                { values: ["Select Light", ...this.getLightOptions()] }
            );

            // Add to the array of selectors
            this.lightSelectors.push(lightSelector);

            // Adjust node size
            this.size[1] += 50; // Increase height for each new selector

            this.setDirtyCanvas(true);
            console.log(`HueLightControlNode - Added light selector ${this.lightSelectors.length}.`);
        }

        /**
         * Removes the last light selector dropdown.
         */
        onRemoveLight() {
            if (this.lightSelectors.length === 0) {
                console.warn("KasaLightControlNode - No light selectors to remove.");
                return;
            }

            const lightSelector = this.lightSelectors.pop(); // Remove the last selector reference

            // Manually remove the DOM element for the widget
            const index = this.widgets.indexOf(lightSelector); // Find the widget's index in the array
            if (index > -1) {
                this.widgets.splice(index, 1); // Remove the widget from the widgets array
            }

            // Adjust the node size
            this.size[1] -= 50; // Decrease height accordingly

            // Remove the last selected light from the properties arrays
            this.properties.selectedLightIds.pop();
            this.properties.selectedLightNames.pop();

            this.setDirtyCanvas(true); // Refresh the canvas to update the UI
            console.log(`KasaLightControlNode - Removed light selector ${this.lightSelectors.length + 1}.`);
        }


        /**
         * Retrieves available light options for dropdowns.
         */
        getLightOptions() {
            // Adjusted to access 'name' and 'light_id' directly
            return this.devices.map(device => `${device.name} (ID: ${device.light_id})`);
        }

        /**
         * Callback when a light is selected from a dropdown.
         * @param {string} value - Selected value from the dropdown.
         * @param {number} index - Index of the selector in the lightSelectors array.
         */
        onLightSelected(value, index) {
            console.log(`HueLightControlNode - onLightSelected called with value: ${value} at index: ${index}`);

            // Check if value is a string
            if (typeof value !== 'string') {
                console.error("HueLightControlNode - Selected value is not a string:", value);
                return;
            }

            if (value === "Select Light") {
                // Remove the light from selected lists if deselected
                this.properties.selectedLightIds.splice(index, 1);
                this.properties.selectedLightNames.splice(index, 1);
                return;
            }

            // Extract device ID from the selected value using regex
            const match = value.match(/\(ID:\s*(\d+)\)/);
            if (match && match[1]) {
                const lightId = match[1]; // Keep as string to match DeviceManager's light_id
                const lightName = value.split(" (ID:")[0];

                // Update properties
                this.properties.selectedLightIds[index] = lightId;
                this.properties.selectedLightNames[index] = lightName;

                console.log(`HueLightControlNode - Light selected at index ${index}: ${value}`);

                // Emit the selected lights info downstream (optional)
                this.setOutputData(0, { selectedLights: this.properties.selectedLightIds });
            } else {
                console.error("HueLightControlNode - Unable to extract Light ID.");
                // Remove the light from selected lists if extraction fails
                this.properties.selectedLightIds.splice(index, 1);
                this.properties.selectedLightNames.splice(index, 1);
            }
        }

        /**
         * Handles incoming HSV Info input.
         * @param {object} hsv - Object containing hue, saturation, and brightness.
         */
        handleHSVInput(hsv) {
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("HueLightControlNode - No lights selected. Cannot update HSV.");
                return;
            }

            if (typeof hsv !== 'object' || hsv === null) {
                console.error("HueLightControlNode - Invalid HSV input:", hsv);
                return;
            }

            const { hue, saturation, brightness } = hsv;

            // Validate HSV values
            if (
                typeof hue !== 'number' ||
                typeof saturation !== 'number' ||
                typeof brightness !== 'number'
            ) {
                console.error("HueLightControlNode - HSV values must be numbers:", hsv);
                return;
            }

            // Check for changes in HSV values
            if (
                hue === this.previousHSV.hue &&
                saturation === this.previousHSV.saturation &&
                brightness === this.previousHSV.brightness
            ) {
                // No changes detected; do not send redundant commands
                return;
            }

            // Update previous HSV values
            this.previousHSV = { hue, saturation, brightness };

            // Normalize HSV values to expected ranges
            const normalizedHue = hue * 360; // Assuming hue is 0-1, converting to 0-360
            const normalizedSaturation = saturation * 100; // Assuming saturation is 0-1, converting to 0-100

            // Round brightness to ensure it's an integer
            const roundedBrightness = Math.round(brightness);

            // Debug: Log normalized values
            console.log(`HueLightControlNode - Normalized HSV: hue=${normalizedHue}, saturation=${normalizedSaturation}, brightness=${roundedBrightness}`);

            // Debounce the HSV input to prevent rapid API calls
            if (this.hsvDebounceTimer) {
                clearTimeout(this.hsvDebounceTimer);
            }

            this.hsvDebounceTimer = setTimeout(() => {
                // Iterate over all selected lights and set their colors
                this.properties.selectedLightIds.forEach(lightId => {
                    window.deviceManager.setLightColor(lightId, { hue: normalizedHue, saturation: normalizedSaturation, brightness: roundedBrightness })
                        .then(() => {
                            console.log(`HueLightControlNode - Set HSV for Light ID ${lightId}:`, { hue: normalizedHue, saturation: normalizedSaturation, brightness: roundedBrightness });
                        })
                        .catch(error => {
                            console.error(`HueLightControlNode - Error setting HSV for Light ID ${lightId}:`, error);
                        });
                });
            }, this.HSV_DEBOUNCE_DELAY);
        }

        /**
         * Handles incoming Trigger input for On/Off commands.
         * @param {boolean} trigger - Trigger signal.
         */
        handleTrigger(trigger) {
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("HueLightControlNode - No lights selected. Cannot toggle state.");
                return;
            }

            // Ensure desiredState is always a valid boolean
            const desiredState = Boolean(trigger); 

            // Check if the desired state is different from the previous state
            if (desiredState === this.previousTrigger) {
                // No change in trigger; do not send redundant commands
                return;
            }

            // Update previous trigger state
            this.previousTrigger = desiredState;

            console.log(`HueLightControlNode - handleTrigger: Setting state to ${desiredState ? "On" : "Off"} for lights`);

            // Iterate over all selected lights and set their states
            this.properties.selectedLightIds.forEach(lightId => {
                window.deviceManager.setLightState(lightId, desiredState)
                    .then(() => {
                        console.log(`HueLightControlNode - Set state for Light ID ${lightId} to ${desiredState ? "On" : "Off"}.`);
                    })
                    .catch(error => {
                        console.error(`HueLightControlNode - Error setting state for Light ID ${lightId}:`, error);
                    });
            });
        }

        /**
         * Executes the node's main functionality.
         * Triggered by LiteGraph.
         */
        onExecute() {
            const addLightAction = this.getInputData(0); // "Add Light" input
            const removeLightAction = this.getInputData(1); // "Remove Light" input
            const hsvInput = this.getInputData(2); // HSV Info
            const triggerInput = this.getInputData(3); // Trigger

            if (addLightAction) {
                this.onAddLight();
            }

            if (removeLightAction) {
                this.onRemoveLight();
            }

            if (hsvInput) {
                this.handleHSVInput(hsvInput);
            }

            if (triggerInput !== undefined) {
                this.handleTrigger(triggerInput);
            }
        }

        /**
         * Serializes the node's state for saving.
         * @returns {object} Serialized data.
         */
        serialize() {
            const data = super.serialize();
            data.properties = this.properties;
            data.previousHSV = this.previousHSV;
            data.previousTrigger = this.previousTrigger;
            return data;
        }

        /**
         * Configures the node from serialized data.
         * @param {object} data Serialized data.
         */
        configure(data) {
            super.configure(data);
            this.properties = data.properties || this.properties;
            this.previousHSV = data.previousHSV || { hue: null, saturation: null, brightness: null };
            this.previousTrigger = data.previousTrigger || null;

            // Restore the selected lights
            if (this.properties.selectedLightIds && this.properties.selectedLightIds.length > 0) {
                // Recreate the light selectors based on saved IDs
                this.properties.selectedLightIds.forEach((lightId, index) => {
                    const device = this.devices.find(device => device.light_id === lightId);
                    if (device) {
                        const lightName = `${device.name} (ID: ${device.light_id})`;
                        const lightSelector = this.addWidget(
                            "combo",
                            `Select Light ${index + 1}`,
                            lightName,
                            (value) => {
                                this.onLightSelected(value, index);
                            },
                            { values: ["Select Light", ...this.getLightOptions()] }
                        );
                        this.lightSelectors.push(lightSelector);
                        this.size[1] += 50; // Adjust size
                    }
                });
            }

            console.log("HueLightControlNode - Configured with properties:", this.properties);
            this.setDirtyCanvas(true);
        }

        /**
         * Clean up timers and listeners when the node is removed.
         */
        onRemoved() {
            if (this.hsvDebounceTimer) {
                clearTimeout(this.hsvDebounceTimer);
            }
            // If there are any other listeners or timers, clear them here
        }
    }

    // Register the node with LiteGraph under the "Lighting" category
    LiteGraph.registerNodeType("Lighting/HueLightControlNode", HueLightControlNode);
    console.log("HueLightControlNode - Registered successfully under 'Lighting' category.");

    // Attach the node class to LiteGraph namespace to prevent re-registration
    LiteGraph.HueLightControlNode = HueLightControlNode;
}
