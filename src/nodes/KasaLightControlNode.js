// File: src/nodes/KasaLightControlNode.js

class KasaLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Kasa Light Control";
        this.size = [400, 200]; // Increased size to accommodate multiple widgets

        // Define properties
        this.properties = {
            selectedLightIds: [],       // Array to hold multiple Kasa light IDs
            selectedLightNames: [],     // Array to hold multiple Kasa light names
            status: "No action yet"     // Holds the status message
        };

        // Define inputs and outputs
        this.addInput("Add Light", "action");    // Button to add a new light control
        this.addInput("Remove Light", "action"); // Button to remove the last light control
        this.addInput("HSV Info", "hsv_info");   // Input to set color
        this.addInput("Toggle", "boolean");      // Input to toggle light On/Off
        this.addOutput("Status", "string");      // Output for status

        // Initialize widgets
        this.setupWidgets();

        // Internal state
        this.devices = []; // List of Kasa devices
        this.deviceManagerReady = false; // Flag indicating if devices are loaded

        // Container for multiple light selectors
        this.lightSelectors = [];

        // State tracking
        this.lastToggleState = null; // Tracks the last toggle state
        this.lastHsvInfo = null;     // Tracks the last HSV input

        // Debounce timer for HSV inputs
        this.hsvDebounceTimer = null;
        this.HSV_DEBOUNCE_DELAY = 300; // milliseconds

        // Bind methods
        this.onAddLight = this.onAddLight.bind(this);
        this.onRemoveLight = this.onRemoveLight.bind(this);
        this.onLightSelected = this.onLightSelected.bind(this);
        this.fetchDevices = this.fetchDevices.bind(this);
        this.onDevicesReady = this.onDevicesReady.bind(this);

        console.log("KasaLightControlNode - Initialized.");
    }

    /**
     * Sets up widgets with proper callbacks or property bindings.
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

        // Status display (readonly text widget) bound to 'status' property
        this.statusWidget = this.addWidget(
            "text",                       // Type of widget
            "Status",                     // Widget label
            this.properties.status,       // Initial value bound to 'status' property
            null,                         // No callback needed for readonly widget
            {
                property: "status",        // Bind to 'status' property
                readonly: true
            }                            // Make the widget readonly
        );

        console.log("KasaLightControlNode - Widgets set up.");
    }

    /**
     * Called when the node is added to the graph.
     * Initiates device fetching.
     */
    onAdded() {
        this.fetchDevices();
    }

    /**
     * Fetches Kasa devices asynchronously.
     */
    async fetchDevices() {
        console.log("KasaLightControlNode - Fetching Kasa devices...");
        try {
            const devices = await window.KasaDeviceManager.fetchDevices();
            console.log("KasaLightControlNode - Devices fetched:", devices);

            if (devices && Array.isArray(devices) && devices.length > 0) {
                this.devices = devices;
                this.deviceManagerReady = true;
                console.log(`KasaLightControlNode - Retrieved devices: ${devices.length}`);
                this.onDevicesReady();
            } else {
                throw new Error("No Kasa devices found.");
            }
        } catch (error) {
            console.error("KasaLightControlNode - Error fetching devices:", error);
            // Optionally, disable Add Light button if devices can't be fetched
            this.addLightButton.disabled = true;
            this.removeLightButton.disabled = true;
        }
    }

    /**
     * Called when devices are ready.
     * Restores light selectors if needed.
     */
    onDevicesReady() {
        // Restore the selected lights if needed
        if (this.needsLightSelectorsRestore) {
            this.needsLightSelectorsRestore = false;
            if (this.properties.selectedLightIds && this.properties.selectedLightIds.length > 0) {
                this.properties.selectedLightIds.forEach((lightId, index) => {
                    const device = this.devices.find(device => device.deviceId === lightId);
                    if (device) {
                        const lightName = `${device.alias || device.host} (${device.deviceId})`;
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

            this.setDirtyCanvas(true);
        }
    }

    /**
     * Adds a new light selector dropdown.
     */
    onAddLight() {
        if (!this.deviceManagerReady) {
            console.warn("KasaLightControlNode - Device manager not ready.");
            return;
        }

        // Limit the number of selectable lights if desired
        const MAX_LIGHTS = 10;
        if (this.lightSelectors.length >= MAX_LIGHTS) {
            console.warn(`KasaLightControlNode - Maximum of ${MAX_LIGHTS} lights reached.`);
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
        console.log(`KasaLightControlNode - Added light selector ${this.lightSelectors.length}.`);
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
        return this.devices.map(device => device.alias || device.host); // Only show light name
    }

    onLightSelected(value, index) {
        if (value === "Select Light" || value === "No Kasa Lights Found") {
            this.properties.selectedLightIds.splice(index, 1);
            this.properties.selectedLightNames.splice(index, 1);
            return;
        }

        // Find the device based on the selected name
        const device = this.devices.find(device => device.alias === value || device.host === value);
        if (device) {
            this.properties.selectedLightIds[index] = device.deviceId;
            this.properties.selectedLightNames[index] = device.alias || device.host;

            console.log(`KasaLightControlNode - Selected light at index ${index}: ${device.alias || device.host}`);
        } else {
            console.error("KasaLightControlNode - Unable to find device.");
            this.properties.selectedLightIds.splice(index, 1);
            this.properties.selectedLightNames.splice(index, 1);
        }
    }


    /**
     * Executes the node's main functionality.
     * Triggered by LiteGraph.
     */
    onExecute() {
        const addLightAction = this.getInputData(0); // "Add Light" input
        const removeLightAction = this.getInputData(1); // "Remove Light" input
        const hsvInfo = this.getInputData(2); // "HSV Info" input
        const toggle = this.getInputData(3); // "Toggle" input

        if (addLightAction) {
            this.onAddLight();
        }

        if (removeLightAction) {
            this.onRemoveLight();
        }

        if (this.properties.selectedLightIds.length === 0) {
            // No lights selected; skip processing
            return;
        }

        // Handle Toggle Input
        if (typeof toggle === 'boolean') {
            // Check if toggle state has changed
            if (toggle !== this.lastToggleState) {
                // Update the last toggle state
                this.lastToggleState = toggle;
                console.log(`KasaLightControlNode - Processing Toggle input: ${toggle}`);

                // Iterate over all selected lights and set their states
                this.properties.selectedLightIds.forEach(lightId => {
                    if (toggle) {
                        // Turn On the light
                        window.KasaDeviceManager.turnOn(lightId)
                            .then(() => {
                                console.log(`KasaLightControlNode - Successfully turned On light ID ${lightId}.`);
                                // Update status
                                this.properties.status = `Light ${lightId} turned On`;
                                this.statusWidget.value = this.properties.status;
                                this.setDirtyCanvas(true);
                            })
                            .catch(error => {
                                console.error(`KasaLightControlNode - Error turning On light ID ${lightId}:`, error);
                            });
                    } else {
                        // Turn Off the light
                        window.KasaDeviceManager.turnOff(lightId)
                            .then(() => {
                                console.log(`KasaLightControlNode - Successfully turned Off light ID ${lightId}.`);
                                // Update status
                                this.properties.status = `Light ${lightId} turned Off`;
                                this.statusWidget.value = this.properties.status;
                                this.setDirtyCanvas(true);
                            })
                            .catch(error => {
                                console.error(`KasaLightControlNode - Error turning Off light ID ${lightId}:`, error);
                            });
                    }
                });
            } else {
                // Toggle state unchanged; no action taken
                // Optionally, you can log this if needed
                // console.log(`KasaLightControlNode - Toggle state unchanged (${toggle}). No action taken.`);
            }
        }

        // Handle HSV Info Input
        if (hsvInfo) {
            // Check if HSV values have changed
            const hsvChanged = !this.lastHsvInfo ||
                hsvInfo.hue !== this.lastHsvInfo.hue ||
                hsvInfo.saturation !== this.lastHsvInfo.saturation ||
                hsvInfo.brightness !== this.lastHsvInfo.brightness;

            if (hsvChanged) {
                // Update lastHsvInfo
                this.lastHsvInfo = { ...hsvInfo };

                const { hue, saturation, brightness } = hsvInfo;

                // Validate HSV values
                if (
                    typeof hue !== 'number' || hue < 0 || hue > 1 ||
                    typeof saturation !== 'number' || saturation < 0 || saturation > 1 ||
                    typeof brightness !== 'number' || brightness < 0 || brightness > 254
                ) {
                    console.error("KasaLightControlNode - Invalid HSV values received.");
                    return;
                }

                // Convert HSV to Kasa's expected format
                const kasaHsv = {
                    hue: Math.round(hue * 360),
                    saturation: Math.round(saturation * 100),
                    brightness: Math.round((brightness / 254) * 100)
                };
                console.log(`KasaLightControlNode - Converted HSV Info for Kasa:`, kasaHsv);

                // Debounce the HSV input to prevent rapid API calls
                if (this.hsvDebounceTimer) {
                    clearTimeout(this.hsvDebounceTimer);
                }

                this.hsvDebounceTimer = setTimeout(() => {
                    // Iterate over all selected lights and set their colors
                    this.properties.selectedLightIds.forEach(lightId => {
                        window.KasaDeviceManager.setColor(lightId, kasaHsv)
                            .then(() => {
                                console.log(`KasaLightControlNode - Successfully set color for light ID ${lightId}.`);
                                // Update status
                                this.properties.status = `Set color for Light ${lightId}: H:${kasaHsv.hue} S:${kasaHsv.saturation} B:${kasaHsv.brightness}`;
                                this.statusWidget.value = this.properties.status;
                                this.setDirtyCanvas(true);
                            })
                            .catch(error => {
                                console.error(`KasaLightControlNode - Error setting color for light ID ${lightId}:`, error);
                            });
                    });
                }, this.HSV_DEBOUNCE_DELAY);
            } else {
                // HSV values unchanged; no action taken
                // Optionally, you can log this if needed
                // console.log("KasaLightControlNode - HSV values unchanged. No action taken.");
            }
        }
    }

    /**
     * Serializes the node's state for saving.
     * @returns {object} Serialized data.
     */
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        data.lastToggleState = this.lastToggleState;
        data.lastHsvInfo = this.lastHsvInfo;
        return data;
    }

    /**
     * Configures the node from serialized data.
     * @param {object} data Serialized data.
     */
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.lastToggleState = data.lastToggleState || null;
        this.lastHsvInfo = data.lastHsvInfo || null;

        // Set a flag to restore light selectors after devices are ready
        this.needsLightSelectorsRestore = true;

        // Restore status widget value
        this.statusWidget.value = this.properties.status || "No action yet";
        this.setDirtyCanvas(true);
    }
}

// Register the node with LiteGraph under the "Lighting" category
LiteGraph.registerNodeType("Lighting/KasaLightControlNode", KasaLightControlNode);
console.log("KasaLightControlNode - Registered successfully under 'Lighting' category.");
