// File: KasaLightControlNode.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Lighting/KasaLightControlNode"]) {
    class KasaLightControlNode extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Kasa Light Control";
            this.size = [400, 200]; // Initial size with fixed width
            this.resizable = false; // Prevent manual resizing

            // Define properties
            this.properties = {
                selectedLightIds: [],
                selectedLightNames: [],
                status: "No action yet"
            };

            // Initialize lightSelectors
            this.lightSelectors = [];

            // Define inputs and outputs
            this.addInput("HSV Info", "hsv_info");        // Input to set color
            this.addInput("Trigger", "boolean");          // Input to toggle light On/Off
            this.addOutput("Light Info", "light_info");   // Output light info

            // Initialize widgets
            this.setupWidgets();

            // Internal state
            this.devices = [];               // List of Kasa devices
            this.deviceManagerReady = false; // Flag indicating if devices are loaded

            // State tracking for input change detection
            this.lastToggleInput = null; // Track last toggle input
            this.lastHsvInfo = null;     // Track last HSV input

            // Debounce timer for HSV inputs
            this.hsvDebounceTimer = null;
            this.HSV_DEBOUNCE_DELAY = 300; // milliseconds

            // Flag to indicate that light selectors need to be restored
            this.needsLightSelectorsRestore = false;

            // Property for Color Swatch
            this.boxcolor = "#000000"; // Default color (black)

            // Per-Light State Tracking
            // Structure: { lightId: { on: boolean, hue: number, saturation: number, brightness: number } }
            this.perLightState = {};

            console.log("KasaLightControlNode - Initialized.");

            // Bind methods
            this.onAddLight = this.onAddLight.bind(this);
            this.onRemoveLight = this.onRemoveLight.bind(this);
            this.onLightSelected = this.onLightSelected.bind(this);
            this.fetchDevices = this.fetchDevices.bind(this);
            this.onDevicesReady = this.onDevicesReady.bind(this);
            this.onRefreshDevices = this.onRefreshDevices.bind(this);
            this.handleExternalStateChange = this.handleExternalStateChange.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.updateColorSwatch = this.updateColorSwatch.bind(this); // Ensure binding

            // Register callbacks with KasaDeviceManager
            if (window.KasaDeviceManager) {
                // Listen for state changes
                if (typeof window.KasaDeviceManager.onStateChange === 'function') {
                    window.KasaDeviceManager.onStateChange(this.handleExternalStateChange);
                } else {
                    console.error("KasaLightControlNode - KasaDeviceManager does not have onStateChange method.");
                }
            } else {
                console.error("KasaLightControlNode - KasaDeviceManager is not available.");
            }
        }

        /**
         * Sets up all widgets with proper callbacks or property bindings.
         */
        setupWidgets() {
            try {
                const widgetWidth = this.size[0] - 20; // Consistent widget width

                // Button to add a new light selection
                this.addLightButton = this.addWidget(
                    "button",
                    "Add Light",
                    "Add",
                    () => {
                        this.onAddLight();
                    },
                    {
                        width: widgetWidth
                    }
                );

                // Button to remove the last light selection
                this.removeLightButton = this.addWidget(
                    "button",
                    "Remove Light",
                    "Remove",
                    () => {
                        this.onRemoveLight();
                    },
                    {
                        width: widgetWidth
                    }
                );

                // Button to refresh devices
                this.refreshDevicesButton = this.addWidget(
                    "button",
                    "Refresh Devices",
                    "Refresh",
                    () => {
                        this.onRefreshDevices();
                    },
                    {
                        width: widgetWidth
                    }
                );

                // Status display (readonly text widget) bound to 'status' property
                this.statusWidget = this.addWidget(
                    "text",
                    "Status",
                    this.properties.status,
                    null,
                    {
                        property: "status",
                        readonly: true,
                        width: widgetWidth
                    }
                );

                console.log("KasaLightControlNode - Widgets set up.");
            } catch (error) {
                console.error("KasaLightControlNode - Error setting up widgets:", error);
                this.updateStatus(`Error setting up widgets: ${error.message}`);
            }
        }

        /**
         * Called when the node is added to the graph.
         * Initiates device fetching.
         */
        onAdded() {
            try {
                this.fetchDevices(); // Fetch devices when the node is added
            } catch (error) {
                console.error("KasaLightControlNode - Error in onAdded:", error);
                this.updateStatus(`Error in onAdded: ${error.message}`);
            }
        }

        /**
         * Fetches Kasa devices asynchronously.
         */
        async fetchDevices() {
            console.log("KasaLightControlNode - Fetching Kasa devices...");
            try {
                if (window.KasaDeviceManager && typeof window.KasaDeviceManager.fetchDevices === 'function') {
                    const devices = await window.KasaDeviceManager.fetchDevices();
                    console.log("KasaLightControlNode - Devices fetched:", devices);

                    if (devices && Array.isArray(devices) && devices.length > 0) {
                        this.devices = devices;
                        this.deviceManagerReady = true;
                        console.log(`KasaLightControlNode - Retrieved devices: ${devices.length}`);
                        this.onDevicesReady();
                    } else {
                        throw new Error("No Kasa Light devices found.");
                    }
                } else {
                    throw new Error("KasaDeviceManager is not available or does not have fetchDevices method.");
                }
            } catch (error) {
                console.error("KasaLightControlNode - Error fetching devices:", error);
                // Disable Add/Remove/Refresh buttons if devices can't be fetched
                this.widgets.forEach(widget => {
                    if (
                        widget.name === "Add Light" ||
                        widget.name === "Remove Light" ||
                        widget.name === "Refresh Devices"
                    ) {
                        widget.disabled = true;
                    }
                });
                this.updateStatus(`Error fetching devices: ${error.message}`);
            }
        }

        /**
         * Called when devices are ready.
         * Restores light selectors if needed.
         */
        onDevicesReady() {
            try {
                // Restore the selected lights if needed
                if (this.needsLightSelectorsRestore) {
                    this.needsLightSelectorsRestore = false;
                    if (this.properties.selectedLightIds && this.properties.selectedLightIds.length > 0) {
                        this.properties.selectedLightIds.forEach((lightId, index) => {
                            const device = this.devices.find(device => device.deviceId === lightId);
                            if (device) {
                                const lightName = `${device.alias}`; // Show only the name
                                const lightSelector = this.addWidget(
                                    "combo",
                                    `Select Light ${index + 1}`,
                                    lightName,
                                    (value) => {
                                        this.onLightSelected(value, this.lightSelectors.indexOf(lightSelector));
                                    },
                                    {
                                        values: ["Select Light", ...this.getLightOptions()],
                                        width: this.size[0] - 20
                                    }
                                );
                                this.lightSelectors.push(lightSelector);
                                // Initialize perLightState
                                this.perLightState[lightId] = {
                                    on: false,
                                    hue: 0,
                                    saturation: 0,
                                    brightness: 0
                                };
                            } else {
                                console.warn(`KasaLightControlNode - Device with ID ${lightId} not found. Removing from selection.`);
                                // Remove invalid lightId
                                this.properties.selectedLightIds[index] = null;
                                this.properties.selectedLightNames[index] = null;
                            }
                        });
                    }
                    // Recalculate the node's size
                    this.updateNodeSize();
                    this.setDirtyCanvas(true);
                    this.updateStatus("Light selectors restored.");
                }
            } catch (error) {
                console.error("KasaLightControlNode - Error in onDevicesReady:", error);
                this.updateStatus(`Error in onDevicesReady: ${error.message}`);
            }
        }

        /**
         * Refreshes the list of Kasa devices.
         */
        async onRefreshDevices() {
            console.log("KasaLightControlNode - Refreshing Kasa devices...");
            try {
                await this.fetchDevices();
                console.log("KasaLightControlNode - Devices refreshed.");
                this.updateStatus("Devices refreshed.");
            } catch (error) {
                console.error("KasaLightControlNode - Error refreshing devices:", error);
                this.updateStatus(`Error refreshing devices: ${error.message}`);
            }
        }

        /**
         * Retrieves available light options for dropdowns.
         */
        getLightOptions() {
            return this.devices.map(device => device.alias); // Only names are returned
        }

        /**
         * Adds a new light selector dropdown.
         */
        onAddLight() {
            if (!this.deviceManagerReady) {
                console.warn("KasaLightControlNode - Device manager not ready.");
                this.updateStatus("Device manager not ready.");
                return;
            }

            // Limit the number of selectable lights if desired
            const MAX_LIGHTS = 20;
            if (this.lightSelectors.length >= MAX_LIGHTS) {
                console.warn(`KasaLightControlNode - Maximum of ${MAX_LIGHTS} lights reached.`);
                this.updateStatus(`Maximum of ${MAX_LIGHTS} lights reached.`);
                return;
            }

            try {
                // Create a new dropdown for light selection
                const lightSelector = this.addWidget(
                    "combo",
                    `Select Light ${this.lightSelectors.length + 1}`,
                    "Select Light",
                    (value) => {
                        this.onLightSelected(value, this.lightSelectors.indexOf(lightSelector));
                    },
                    {
                        values: ["Select Light", ...this.getLightOptions()],
                        width: this.size[0] - 20
                    }
                );

                // Add to the array of selectors
                this.lightSelectors.push(lightSelector);

                // Synchronize Internal State Arrays
                this.properties.selectedLightIds.push(null);
                this.properties.selectedLightNames.push(null);

                // Update the node's size
                this.updateNodeSize();

                // Update the canvas
                this.setDirtyCanvas(true, true);

                console.log(`KasaLightControlNode - Added light selector ${this.lightSelectors.length}.`);
                this.updateStatus(`Added light selector ${this.lightSelectors.length}.`);
            } catch (error) {
                console.error("KasaLightControlNode - Error adding light selector:", error);
                this.updateStatus(`Error adding light selector: ${error.message}`);
            }
        }

        /**
         * Removes the last light selector dropdown.
         */
        onRemoveLight() {
            if (this.lightSelectors.length === 0) {
                console.warn("KasaLightControlNode - No light selectors to remove.");
                this.updateStatus("No light selectors to remove.");
                return;
            }

            try {
                const lightSelector = this.lightSelectors.pop();

                // Remove the widget from the widgets array
                const index = this.widgets.indexOf(lightSelector);
                if (index > -1) {
                    this.widgets.splice(index, 1);
                }

                // Remove the last selected light from the properties arrays
                const removedLightId = this.properties.selectedLightIds.pop();
                this.properties.selectedLightNames.pop();

                // Remove from perLightState
                if (removedLightId && this.perLightState[removedLightId]) {
                    delete this.perLightState[removedLightId];
                }

                // Update the node's size
                this.updateNodeSize();

                // Update the canvas
                this.setDirtyCanvas(true, true);

                console.log(`KasaLightControlNode - Removed light selector ${this.lightSelectors.length + 1}.`);
                this.updateStatus(`Removed light selector ${this.lightSelectors.length + 1}.`);
            } catch (error) {
                console.error("KasaLightControlNode - Error removing light selector:", error);
                this.updateStatus(`Error removing light selector: ${error.message}`);
            }
        }

        /**
         * Callback when a light is selected from a dropdown.
         * @param {string} value - Selected value from the dropdown.
         * @param {number} index - Index of the selector in the lightSelectors array.
         */
        onLightSelected(value, index) {
            try {
                console.log(`KasaLightControlNode - onLightSelected called with value: ${value} at index: ${index}`);

                // Check if value is a string
                if (typeof value !== 'string') {
                    console.error("KasaLightControlNode - Selected value is not a string:", value);
                    this.updateStatus("Invalid selection.");
                    return;
                }

                if (value === "Select Light") {
                    // Remove the light from selected lists if deselected
                    const removedLightId = this.properties.selectedLightIds[index];

                    if (removedLightId && this.perLightState[removedLightId]) {
                        delete this.perLightState[removedLightId];
                    }

                    this.properties.selectedLightIds[index] = null;
                    this.properties.selectedLightNames[index] = null;

                    this.updateColorSwatch(); // Update color swatch as selection changed
                    this.updateStatus(`Deselected light at selector ${index + 1}.`);
                    return;
                }

                // Find device by name
                const device = this.devices.find(device => device.alias === value);
                if (device) {
                    const lightId = device.deviceId;
                    const lightName = device.alias;

                    // Prevent Duplicate Selections
                    if (this.properties.selectedLightIds.includes(lightId)) {
                        console.warn(`KasaLightControlNode - Light ID ${lightId} is already selected.`);
                        this.updateStatus(`Light "${lightName}" is already selected.`);

                        // Reset the dropdown to "Select Light"
                        this.lightSelectors[index].value = "Select Light";
                        this.properties.selectedLightIds[index] = null;
                        this.properties.selectedLightNames[index] = null;
                        return;
                    }

                    // Update properties
                    this.properties.selectedLightIds[index] = lightId;
                    this.properties.selectedLightNames[index] = lightName;

                    console.log(`KasaLightControlNode - Light selected at index ${index}: ${value}`);

                    // Fetch Current State and Color of the Selected Light
                    this.fetchLightStateAndColor(lightId);
                } else {
                    console.error("KasaLightControlNode - Unable to find device.");
                    // Remove the light from selected lists if extraction fails
                    const removedLightId = this.properties.selectedLightIds[index];

                    if (removedLightId && this.perLightState[removedLightId]) {
                        delete this.perLightState[removedLightId];
                    }

                    this.properties.selectedLightIds[index] = null;
                    this.properties.selectedLightNames[index] = null;

                    this.updateColorSwatch(); // Update color swatch as selection changed
                    this.updateStatus(`Invalid selection at selector ${index + 1}.`);
                }
            } catch (error) {
                console.error("KasaLightControlNode - Error in onLightSelected:", error);
                this.updateStatus(`Error selecting light: ${error.message}`);
            }
        }

        /**
         * Fetches the current state and color of a selected light.
         * Updates the internal perLightState accordingly.
         * @param {string} lightId - The ID of the light to fetch.
         */
        async fetchLightStateAndColor(lightId) {
            try {
                if (window.KasaDeviceManager && typeof window.KasaDeviceManager.getLightState === 'function') {
                    const lightState = await window.KasaDeviceManager.getLightState(lightId);
                    console.log(`KasaLightControlNode - Fetched state for Light ID ${lightId}:`, lightState);

                    const state = lightState.on_off === 1; // Boolean: true is "on", false is "off"
                    const hue = (typeof lightState.hue === 'number') ? lightState.hue : 0; // 0-360
                    const saturation = (typeof lightState.saturation === 'number') ? lightState.saturation : 0; // 0-100
                    const brightness = (typeof lightState.brightness === 'number') ? lightState.brightness : 0; // 0-254

                    // Update Per-light State
                    this.perLightState[lightId] = {
                        on: state,
                        hue: hue,               // 0-360
                        saturation: saturation, // 0-100
                        brightness: brightness  // 0-254
                    };

                    // Update Color Swatch with normalized values
                    this.updateColorSwatch(
                        hue / 360,
                        saturation / 100,
                        brightness / 254
                    );

                    // Update Status
                    const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                    this.updateStatus(`Light "${lightName}" is ${state ? "On" : "Off"}`);
                } else {
                    throw new Error("KasaDeviceManager is not available or does not have getLightState method.");
                }
            } catch (error) {
                console.error(`KasaLightControlNode - Error fetching state and color for Light ID ${lightId}:`, error);
                this.updateStatus(`Error fetching Light "${lightId}": ${error.message}`);
            }
        }

        /**
         * Handles incoming HSV Info input.
         * @param {object} hsv - Object containing hue, saturation, and brightness.
         */
        handleHSVInput(hsv) {
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("KasaLightControlNode - No lights selected. Cannot update HSV.");
                this.updateStatus("No lights selected. Cannot update HSV.");
                return;
            }

            if (typeof hsv !== 'object' || hsv === null) {
                console.error("KasaLightControlNode - Invalid HSV input:", hsv);
                this.updateStatus("Invalid HSV input.");
                return;
            }

            const { hue, saturation, brightness } = hsv;

            // Validate HSV values
            if (
                typeof hue !== 'number' ||
                typeof saturation !== 'number' ||
                typeof brightness !== 'number'
            ) {
                console.error("KasaLightControlNode - HSV values must be numbers:", hsv);
                this.updateStatus("HSV values must be numbers.");
                return;
            }

            // Assuming HSV input ranges are normalized: hue:0-1, saturation:0-1, brightness:0-1

            // Scale HSV values
            let scaledHue = hue * 360;
            let scaledSaturation = saturation * 100;
            let scaledBrightness = brightness * 254;

            // Ensure hue is within 0-359
            if (scaledHue >= 360) {
                scaledHue = 0;
            } else {
                scaledHue = Math.round(scaledHue);
            }

            // Similarly for saturation and brightness
            scaledSaturation = Math.round(scaledSaturation);
            scaledBrightness = Math.round(scaledBrightness);

            // Validate ranges
            if (
                scaledHue < 0 || scaledHue > 359 ||
                scaledSaturation < 0 || scaledSaturation > 100 ||
                scaledBrightness < 0 || scaledBrightness > 254
            ) {
                console.error("KasaLightControlNode - Scaled HSV values out of expected ranges:", { scaledHue, scaledSaturation, scaledBrightness });
                this.updateStatus("Scaled HSV values out of expected ranges.");
                return;
            }

            // Check for changes in HSV values
            if (
                scaledHue === this.lastHsvInfo?.hue &&
                scaledSaturation === this.lastHsvInfo?.saturation &&
                scaledBrightness === this.lastHsvInfo?.brightness
            ) {
                // No changes detected; do not send redundant commands
                return;
            }

            // Update lastHsvInfo
            this.lastHsvInfo = { hue: scaledHue, saturation: scaledSaturation, brightness: scaledBrightness };

            // Update the Color Swatch with normalized values
            this.updateColorSwatch(
                scaledHue / 360,
                scaledSaturation / 100,
                scaledBrightness / 254
            );

            // Convert to Kasa's expected format
            const kasaHsv = {
                hue: scaledHue,                // 0-359
                saturation: scaledSaturation,  // 0-100%
                brightness: scaledBrightness   // 0-254
            };
            console.log(`KasaLightControlNode - Converted HSV Info for Kasa:`, kasaHsv);

            // Debounce the HSV input to prevent rapid API calls
            if (this.hsvDebounceTimer) {
                clearTimeout(this.hsvDebounceTimer);
            }

            this.hsvDebounceTimer = setTimeout(() => {
                // Iterate over all selected lights and set their colors
                this.properties.selectedLightIds.forEach(lightId => {
                    if (lightId && window.KasaDeviceManager && typeof window.KasaDeviceManager.setColor === 'function') {
                        window.KasaDeviceManager.setColor(lightId, kasaHsv)
                            .then(() => {
                                console.log(`KasaLightControlNode - Successfully set color for Light ID ${lightId}.`);
                                // Update perLightState
                                if (this.perLightState[lightId]) {
                                    this.perLightState[lightId].hue = kasaHsv.hue;
                                    this.perLightState[lightId].saturation = kasaHsv.saturation;
                                    this.perLightState[lightId].brightness = kasaHsv.brightness;
                                }
                                // Update status
                                const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                                this.updateStatus(`Set color for Light "${lightName}": H:${kasaHsv.hue} S:${kasaHsv.saturation} B:${kasaHsv.brightness}`);
                                this.setDirtyCanvas(true);
                            })
                            .catch(error => {
                                console.error(`KasaLightControlNode - Error setting color for Light ID ${lightId}:`, error);
                                this.updateStatus(`Error setting color for Light "${lightId}": ${error.message}`);
                            });
                    } else {
                        console.error("KasaLightControlNode - KasaDeviceManager is not available or does not have setColor method.");
                        this.updateStatus(`Error: Cannot set color for Light "${lightId}".`);
                    }
                });
            }, this.HSV_DEBOUNCE_DELAY);
        }

        /**
         * Handles incoming Trigger input for On/Off commands.
         * @param {boolean} toggle - Toggle signal.
         */
        handleToggleInput(toggle) {
            // Only process if a light is selected
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("KasaLightControlNode - No lights selected. Cannot toggle state.");
                this.updateStatus("No lights selected. Cannot toggle state.");
                return;
            }

            // Avoid sending redundant commands if toggle state hasn't changed
            if (toggle === this.lastToggleInput) {
                console.log("KasaLightControlNode - Toggle state unchanged. No action taken.");
                return;
            }

            // Update previous toggle state
            this.lastToggleInput = toggle;

            console.log(`KasaLightControlNode - handleToggleInput: Setting state to ${toggle ? "On" : "Off"} for lights`);
            this.updateStatus(`Setting lights to ${toggle ? "On" : "Off"}.`);

            // Iterate over all selected lights and set their states
            this.properties.selectedLightIds.forEach(lightId => {
                if (toggle) {
                    window.KasaDeviceManager.turnOn(lightId)
                        .then(() => {
                            console.log(`KasaLightControlNode - Successfully turned On Light ID ${lightId}.`);
                            // Update perLightState
                            if (this.perLightState[lightId]) {
                                this.perLightState[lightId].on = true;
                            }
                            // Update status
                            const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                            this.updateStatus(`Light "${lightName}" turned On.`);
                            this.setDirtyCanvas(true);
                        })
                        .catch(error => {
                            console.error(`KasaLightControlNode - Error turning On Light ID ${lightId}:`, error);
                            this.updateStatus(`Error turning On Light "${lightId}": ${error.message}`);
                        });
                } else {
                    window.KasaDeviceManager.turnOff(lightId)
                        .then(() => {
                            console.log(`KasaLightControlNode - Successfully turned Off Light ID ${lightId}.`);
                            // Update perLightState
                            if (this.perLightState[lightId]) {
                                this.perLightState[lightId].on = false;
                            }
                            // Update status
                            const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                            this.updateStatus(`Light "${lightName}" turned Off.`);
                            this.setDirtyCanvas(true);
                        })
                        .catch(error => {
                            console.error(`KasaLightControlNode - Error toggling state for Light ID ${lightId}:`, error);
                            this.updateStatus(`Error toggling Light "${lightId}": ${error.message}`);
                            // Attempt to fetch state regardless of the outcome
                            this.fetchLightStateAndColor(lightId);
                        });
                }
            });
        }

        /**
         * Executes the node's main functionality.
         * Triggered by LiteGraph.
         */
        onExecute() {
            try {
                const hsvInput = this.getInputData(0);    // "HSV Info" input
                const triggerInput = this.getInputData(1); // "Trigger" input

                // Handle HSV Info Input
                if (hsvInput) {
                    this.handleHSVInput(hsvInput);
                }

                // Handle Trigger Input
                if (triggerInput !== undefined) {
                    this.handleToggleInput(triggerInput);
                }

                // Emit Light Info Downstream
                const lightData = {
                    lights: this.properties.selectedLightIds
                        .filter(id => id !== null)
                        .map(id => ({
                            light_id: id,
                            name: this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(id)],
                            status: this.perLightState[id]?.on ? "On" : "Off"
                        })),
                    status: this.properties.status
                };

                this.setOutputData(0, lightData);
            } catch (error) {
                console.error("KasaLightControlNode - Error in onExecute:", error);
                this.updateStatus(`Error in onExecute: ${error.message}`);
            }
        }

        /**
         * Serializes the node's state for saving.
         * @returns {object} Serialized data.
         */
        serialize() {
            try {
                const data = super.serialize();
                data.properties = this.properties;
                data.lastToggleInput = this.lastToggleInput;
                data.lastHsvInfo = this.lastHsvInfo;
                data.boxcolor = this.boxcolor;            // Include boxcolor in serialization
                data.perLightState = this.perLightState;  // Include per-light state
                // Exclude size from serialization to prevent resizing on load
                return data;
            } catch (error) {
                console.error("KasaLightControlNode - Error in serialize:", error);
                return {};
            }
        }

        /**
         * Configures the node from serialized data.
         * @param {object} data Serialized data.
         */
        configure(data) {
            try {
                super.configure(data);
                this.properties = data.properties || this.properties;
                this.lastToggleInput = (data.lastToggleInput !== undefined) ? data.lastToggleInput : null;
                this.lastHsvInfo = data.lastHsvInfo || null;
                this.perLightState = data.perLightState || {};

                // Set a flag to restore light selectors after devices are ready
                this.needsLightSelectorsRestore = true;

                // Restore Box Color from Serialized Data
                this.boxcolor = data.boxcolor || "#000000";

                // Restore status widget value
                if (this.statusWidget) {
                    this.statusWidget.value = this.properties.status || "No action yet";
                }

                // Enforce Fixed Size
                this.size[0] = 400; // Ensure width matches the constructor
                this.updateNodeSize(); // Adjust height based on restored data

                // If lights were previously selected, fetch their state
                if (this.properties.selectedLightIds.length > 0) {
                    this.properties.selectedLightIds.forEach(lightId => {
                        if (lightId) {
                            this.fetchLightStateAndColor(lightId);
                        }
                    });
                }

                console.log("KasaLightControlNode - Configured with properties:", this.properties);
                this.setDirtyCanvas(true);
            } catch (error) {
                console.error("KasaLightControlNode - Error in configure:", error);
                this.updateStatus(`Error in configure: ${error.message}`);
            }
        }

        /**
         * Clean up timers and listeners when the node is removed.
         */
        onRemoved() {
            try {
                if (this.hsvDebounceTimer) {
                    clearTimeout(this.hsvDebounceTimer);
                }
                // If there are any other listeners or timers, clear them here
            } catch (error) {
                console.error("KasaLightControlNode - Error in onRemoved:", error);
            }
        }

        /**
         * Converts HSV values to RGB.
         * @param {number} h - Hue (0-1).
         * @param {number} s - Saturation (0-1).
         * @param {number} v - Value/Brightness (0-1).
         * @returns {Array} [r, g, b] values (0-255).
         */
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

            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }

        /**
         * Converts RGB values to Hex color string.
         * @param {number} r - Red (0-255).
         * @param {number} g - Green (0-255).
         * @param {number} b - Blue (0-255).
         * @returns {string} Hex color string.
         */
        rgbToHex(r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }

        /**
         * Updates the color swatch at the bottom of the node.
         * @param {number} [hue] - Hue value (0-1).
         * @param {number} [saturation] - Saturation value (0-1).
         * @param {number} [brightness] - Brightness value (0-1).
         */
        updateColorSwatch(hue = this.lastHsvInfo?.hue, saturation = this.lastHsvInfo?.saturation, brightness = this.lastHsvInfo?.brightness) {
            try {
                if (
                    hue === null || hue === undefined ||
                    saturation === null || saturation === undefined ||
                    brightness === null || brightness === undefined
                ) {
                    this.boxcolor = "#000000"; // Default to black if values are incomplete
                } else {
                    // Convert normalized HSV to RGB
                    const rgb = this.hsvToRgb(hue, saturation, brightness);
                    const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
                    this.boxcolor = colorHex;
                }

                // Redraw the node to update the color swatch
                if (this.graph && this.graph.canvas) {
                    this.setDirtyCanvas(true, true);
                }
            } catch (error) {
                console.error("KasaLightControlNode - Error updating color swatch:", error);
                this.updateStatus(`Error updating color swatch: ${error.message}`);
            }
        }

        /**
         * Draws the color swatch and per-light indicators on the node's foreground.
         * @param {CanvasRenderingContext2D} ctx - The rendering context.
         */
        onDrawForeground(ctx) {
            try {
                // Ensure the parent class's method is called if it exists
                if (super.onDrawForeground) {
                    super.onDrawForeground(ctx);
                }

                // Calculate the cumulative height of widgets
                let widgetsHeight = 0;
                this.widgets.forEach(widget => {
                    const widgetHeight = widget.computeSize
                        ? widget.computeSize(this.size[0])[1]
                        : LiteGraph.NODE_WIDGET_HEIGHT;
                    widgetsHeight += widgetHeight;
                });

                // Set starting Y position after widgets
                const startY = widgetsHeight + 15; // Adjust padding as needed
                const spacing = 30; // Spacing between lights

                // Draw Per-Light Indicators
                this.properties.selectedLightIds.forEach((lightId, index) => {
                    if (!lightId) return; // Skip if no light is selected

                    const lightName = this.properties.selectedLightNames[index];
                    const lightState = this.perLightState[lightId];

                    if (!lightState) return;

                    const yPosition = startY + index * spacing;

                    // Draw light name (Left-justified)
                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "12px Arial";
                    ctx.textAlign = "left";
                    ctx.fillText(lightName, 10, yPosition);

                    // Draw On/Off Indicator (Circle) (Middle)
                    const onOffRadius = 10;
                    const onOffX = 150; // Fixed position
                    ctx.fillStyle = lightState.on ? "#00FF00" : "#FF0000";
                    ctx.beginPath();
                    ctx.arc(onOffX, yPosition - 5, onOffRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw border for On/Off Indicator
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Draw Color Box (Right-justified)
                    const colorBoxSize = 20;
                    const colorBoxX = this.size[0] - 70; // Position from the right

                    // Use perLightState values for color conversion
                    const hueNormalized = lightState.hue / 360; // 0-1
                    const saturationNormalized = lightState.saturation / 100; // 0-1
                    const brightnessNormalized = lightState.brightness / 254; // 0-1

                    const rgb = this.hsvToRgb(
                        hueNormalized,
                        saturationNormalized,
                        brightnessNormalized
                    );
                    const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
                    ctx.fillStyle = colorHex;
                    ctx.fillRect(colorBoxX, yPosition - (colorBoxSize / 2) - 5, colorBoxSize, colorBoxSize);

                    // Draw border for Color Box
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(colorBoxX, yPosition - (colorBoxSize / 2) - 5, colorBoxSize, colorBoxSize);
                });

                // Draw the color swatch at the bottom
                const swatchHeight = 20;
                ctx.fillStyle = this.boxcolor || "#000000";
                ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
            } catch (error) {
                console.error("KasaLightControlNode - Error in onDrawForeground:", error);
                this.updateStatus(`Error drawing foreground: ${error.message}`);
            }
        }

        /**
         * Handles mouse down events for interactivity.
         * Detects clicks on per-light indicators to toggle state or change color.
         * @param {object} event - The mouse event.
         */
        onMouseDown(event) {
            try {
                // Defensive Checks
                if (!this.graph || !this.graph.canvas || typeof this.graph.canvas.getMousePos !== 'function') {
                    console.warn("KasaLightControlNode - graph or canvas is not available.");
                    return;
                }

                const mousePos = this.graph.canvas.getMousePos(event);
                const x = mousePos.x - this.pos[0];
                const y = mousePos.y - this.pos[1];

                // Calculate the cumulative height of widgets
                let widgetsHeight = 0;
                this.widgets.forEach(widget => {
                    const widgetHeight = widget.computeSize
                        ? widget.computeSize(this.size[0])[1]
                        : LiteGraph.NODE_WIDGET_HEIGHT;
                    widgetsHeight += widgetHeight;
                });

                const startY = widgetsHeight + 15; // Starting Y position for the first light
                const spacing = 30; // Spacing between lights

                this.properties.selectedLightIds.forEach((lightId, index) => {
                    if (!lightId) return; // Skip if no light is selected

                    const lightName = this.properties.selectedLightNames[index];
                    const lightState = this.perLightState[lightId];

                    if (!lightState) return;

                    const yPosition = startY + index * spacing;

                    // Check if On/Off Indicator was clicked
                    const onOffX = 150;
                    const onOffY = yPosition - 5;
                    const onOffRadius = 10;
                    const distanceToOnOff = Math.sqrt(Math.pow(x - onOffX, 2) + Math.pow(y - onOffY, 2));
                    if (distanceToOnOff <= onOffRadius) {
                        // Toggle the light's state
                        const newState = !lightState.on;
                        if (window.KasaDeviceManager && typeof window.KasaDeviceManager.setLightState === 'function') {
                            window.KasaDeviceManager.setLightState(lightId, newState)
                                .then(() => {
                                    console.log(`KasaLightControlNode - Toggled state for Light ID ${lightId} to ${newState ? "On" : "Off"}.`);
                                    this.perLightState[lightId].on = newState;
                                    // Update status
                                    this.updateStatus(`Light "${lightName}" turned ${newState ? "On" : "Off"}.`);
                                    this.setDirtyCanvas(true);
                                })
                                .catch(error => {
                                    console.error(`KasaLightControlNode - Error toggling state for Light ID ${lightId}:`, error);
                                    this.updateStatus(`Error toggling Light "${lightName}": ${error.message}`);
                                });
                        } else {
                            console.error("KasaLightControlNode - KasaDeviceManager is not available or does not have setLightState method.");
                            this.updateStatus(`Error: Cannot set state for Light "${lightId}".`);
                        }
                        return; // Exit after handling click
                    }

                    // Check if Color Box was clicked
                    const colorBoxX = this.size[0] - 70;
                    const colorBoxY = yPosition - 15; // Centered vertically
                    const colorBoxSize = 20;
                    if (
                        x >= colorBoxX &&
                        x <= colorBoxX + colorBoxSize &&
                        y >= colorBoxY &&
                        y <= colorBoxY + colorBoxSize
                    ) {
                        // Cycle hue by 30 degrees
                        const newHue = (lightState.hue + 30) % 360;
                        if (window.KasaDeviceManager && typeof window.KasaDeviceManager.setColor === 'function') {
                            window.KasaDeviceManager.setColor(lightId, {
                                hue: newHue,
                                saturation: lightState.saturation,
                                brightness: lightState.brightness
                            })
                                .then(() => {
                                    console.log(`KasaLightControlNode - Updated color for Light ID ${lightId} to hue=${newHue}.`);
                                    this.perLightState[lightId].hue = newHue;
                                    // Update color swatch based on new color
                                    this.updateColorSwatch(
                                        newHue / 360,
                                        this.perLightState[lightId].saturation / 100,
                                        this.perLightState[lightId].brightness / 254
                                    );
                                    // Update status
                                    this.updateStatus(`Light "${lightName}" color updated.`);
                                    this.setDirtyCanvas(true);
                                })
                                .catch(error => {
                                    console.error(`KasaLightControlNode - Error updating color for Light ID ${lightId}:`, error);
                                    this.updateStatus(`Error updating color for Light "${lightName}": ${error.message}`);
                                });
                        } else {
                            console.error("KasaLightControlNode - KasaDeviceManager is not available or does not have setColor method.");
                            this.updateStatus(`Error: Cannot set color for Light "${lightId}".`);
                        }
                        return; // Exit after handling click
                    }
                });
            } catch (error) {
                console.error("KasaLightControlNode - Error in onMouseDown:", error);
                this.updateStatus(`Error handling mouse click: ${error.message}`);
            }
        }

        /**
         * Updates the status property and status widget.
         * @param {string} newStatus - The new status message.
         */
        updateStatus(newStatus) {
            try {
                this.properties.status = newStatus;
                if (this.statusWidget) {
                    this.statusWidget.value = this.properties.status;
                }
                this.setDirtyCanvas(true);
            } catch (error) {
                console.error("KasaLightControlNode - Error updating status:", error);
            }
        }

        /**
         * Handles external state changes from KasaDeviceManager.
         * @param {string} lightId - The ID of the device that changed.
         * @param {object} newState - The new state of the device.
         */
        handleExternalStateChange(lightId, newState) {
            try {
                if (this.properties.selectedLightIds.includes(lightId)) {
                    console.log(`KasaLightControlNode - Detected state change for device ${lightId}:`, newState);
                    this.fetchLightStateAndColor(lightId);
                    this.setDirtyCanvas(true);
                }
            } catch (error) {
                console.error("KasaLightControlNode - Error handling external state change:", error);
                this.updateStatus(`Error handling state change: ${error.message}`);
            }
        }

        /**
         * Updates the node's size based on the number of widgets and per-light indicators.
         */
        updateNodeSize() {
            try {
                // Base height accounting for initial widgets and padding
                let totalHeight = 200; // Starting with the initial height

                // Calculate the height of all widgets
                this.widgets.forEach(widget => {
                    const widgetHeight = widget.computeSize
                        ? widget.computeSize(this.size[0])[1]
                        : LiteGraph.NODE_WIDGET_HEIGHT;
                    totalHeight += widgetHeight;
                });

                // Add height for per-light indicators
                const perLightIndicatorHeight = this.properties.selectedLightIds.length * 30; // 30 pixels per light
                totalHeight += perLightIndicatorHeight;

                // Add space for the color swatch and bottom padding
                totalHeight += 40; // Swatch height and padding

                // Set the new size
                this.size[1] = totalHeight;
                this.setSize([this.size[0], this.size[1]]);
            } catch (error) {
                console.error("KasaLightControlNode - Error updating node size:", error);
                this.updateStatus(`Error updating node size: ${error.message}`);
            }
        }
    }

    // Register the node with LiteGraph under the "Lighting" category
    LiteGraph.registerNodeType("Lighting/KasaLightControlNode", KasaLightControlNode);
    console.log("KasaLightControlNode - Registered successfully under 'Lighting' category.");

    // Attach the node class to LiteGraph namespace to prevent re-registration
    LiteGraph.KasaLightControlNode = KasaLightControlNode;
}
// File: KasaLightControlNode.js

class KasaLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Kasa Light Control";
        // Do not set the size here; let it be managed dynamically

        // Internal state
        this.devices = []; // List of Kasa devices
        this.initialLoad = true; // Flag to track the initial load state
        this.deviceManagerReady = false; // Flag indicating if devices are loaded

        // Initialize lightSelectors before any method that may call computeSize
        this.lightSelectors = [];

        // Define properties
        this.properties = {
            selectedLightIds: [],
            selectedLightNames: [],
            status: "No action yet"
        };

        // Define inputs and outputs
        this.addInput("HSV Info", "hsv_info");   // Input to set color
        this.addInput("Trigger", "boolean");      // Input to toggle light On/Off
        this.addOutput("Light Info", "light_info"); // Output light info

        // Initialize widgets
        this.setupWidgets();

        // State tracking
        this.lastToggleState = null;
        this.lastHsvInfo = null;

        // Debounce timer for HSV inputs
        this.hsvDebounceTimer = null;
        this.HSV_DEBOUNCE_DELAY = 300; // milliseconds

        // Bind methods
        this.onAddLight = this.onAddLight.bind(this);
        this.onRemoveLight = this.onRemoveLight.bind(this);
        this.onLightSelected = this.onLightSelected.bind(this);
        this.fetchDevices = this.fetchDevices.bind(this);
        this.onDevicesReady = this.onDevicesReady.bind(this);
        this.onRefreshDevices = this.onRefreshDevices.bind(this);

        // Flag to indicate that light selectors need to be restored
        this.needsLightSelectorsRestore = false;

        // **New Properties for Indicators**
        this.boxcolor = "#000000"; // Default color (black)
        this.onState = false;       // Indicates if the lights are On or Off

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
            },
            {
                width: this.size[0] - 20 // Adjust width to fit the node
            }
        );

        // Button to remove the last light selection
        this.removeLightButton = this.addWidget(
            "button",
            "Remove Light",
            "Remove",
            () => {
                this.onRemoveLight();
            },
            {
                width: this.size[0] - 20 // Adjust width to fit the node
            }
        );

        // Button to refresh devices
        this.refreshDevicesButton = this.addWidget(
            "button",
            "Refresh Devices",
            "Refresh",
            () => {
                this.onRefreshDevices();
            },
            {
                width: this.size[0] - 20 // Adjust width to fit the node
            }
        );

        // Status display (readonly text widget) bound to 'status' property
        this.statusWidget = this.addWidget(
            "text",
            "Status",
            this.properties.status,
            null,
            {
                property: "status",
                readonly: true,
                width: this.size[0] - 20 // Adjust width to fit the node
            }
        );

        console.log("KasaLightControlNode - Widgets set up.");
    }

    /**
     * Called when the node is added to the graph.
     * Initiates device fetching.
     */
    onAdded() {
        // Do not reset the size here; it will be managed dynamically
        this.fetchDevices(); // Fetch devices when the node is added
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
            // Optionally, disable Add/Remove Light buttons if devices can't be fetched
            this.widgets.forEach(widget => {
                if (widget.name === "Add Light" || widget.name === "Remove Light" || widget.name === "Refresh Devices") {
                    widget.disabled = true;
                }
            });
            this.updateStatus(`Error fetching devices: ${error.message}`);
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
                        const lightName = device.alias || device.host; // Exclude device ID
                        const lightSelector = this.addWidget(
                            "combo",
                            `Select Light ${index + 1}`,
                            lightName,
                            (value) => {
                                this.onLightSelected(value, index);
                            },
                            {
                                values: ["Select Light", ...this.getLightOptions()],
                                width: this.size[0] - 20 // Adjust width to fit the node
                            }
                        );
                        this.lightSelectors.push(lightSelector);
                        // Adjust node size
                        this.size[0] = Math.max(this.size[0], 400);
                        this.size[1] = 200 + (this.lightSelectors.length * 50);
                        this.setSize(this.size);
                    }
                });
            }

            this.setDirtyCanvas(true);
        }
    }

    /**
     * Refreshes the list of Kasa devices.
     */
    async onRefreshDevices() {
        console.log("KasaLightControlNode - Refreshing Kasa devices...");
        await this.fetchDevices();
        console.log("KasaLightControlNode - Devices refreshed.");
    }

    /**
     * Retrieves available light options for dropdowns.
     */
    getLightOptions() {
        // Check if devices are loaded
        if (!this.devices || this.devices.length === 0) {
            return ["No Kasa Lights Found"];
        }

        // Map device names for the dropdown
        return this.devices.map(device => device.alias || device.host);
    }

    /**
     * Adds a new light selector dropdown.
     */
    onAddLight() {
        if (!this.deviceManagerReady) {
            console.warn("KasaLightControlNode - Device manager not ready.");
            this.updateStatus("Device manager not ready.");
            return;
        }

        // Limit the number of selectable lights if desired
        const MAX_LIGHTS = 10;
        if (this.lightSelectors.length >= MAX_LIGHTS) {
            console.warn(`KasaLightControlNode - Maximum of ${MAX_LIGHTS} lights reached.`);
            this.updateStatus(`Maximum of ${MAX_LIGHTS} lights reached.`);
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
            {
                values: ["Select Light", ...this.getLightOptions()],
                width: this.size[0] - 20 // Adjust width to fit the node
            }
        );

        // Add to the array of selectors
        this.lightSelectors.push(lightSelector);

        // Adjust node size
        this.size[0] = Math.max(this.size[0], 400);
        this.size[1] = 200 + (this.lightSelectors.length * 50);
        this.setSize(this.size);

        // Update the canvas
        this.setDirtyCanvas(true, true);

        console.log(`KasaLightControlNode - Added light selector ${this.lightSelectors.length}.`);
        this.updateStatus(`Added light selector ${this.lightSelectors.length}.`);
    }

    /**
     * Removes the last light selector dropdown.
     */
    onRemoveLight() {
        if (this.lightSelectors.length === 0) {
            console.warn("KasaLightControlNode - No light selectors to remove.");
            this.updateStatus("No light selectors to remove.");
            return;
        }

        const lightSelector = this.lightSelectors.pop(); // Remove the last selector reference

        // Remove the widget from the widgets array
        const index = this.widgets.indexOf(lightSelector);
        if (index > -1) {
            this.widgets.splice(index, 1);
        }

        // Remove the last selected light from the properties arrays
        this.properties.selectedLightIds.pop();
        this.properties.selectedLightNames.pop();

        // Adjust node size
        this.size[0] = Math.max(this.size[0], 400);
        this.size[1] = 200 + (this.lightSelectors.length * 50);
        this.setSize(this.size);

        // Update the canvas
        this.setDirtyCanvas(true, true);

        console.log(`KasaLightControlNode - Removed light selector ${this.lightSelectors.length + 1}.`);
        this.updateStatus(`Removed light selector ${this.lightSelectors.length + 1}.`);
    }

    /**
     * Callback when a light is selected from a dropdown.
     */
    onLightSelected(value, index) {
        console.log(`KasaLightControlNode - onLightSelected called with value: ${value} at index: ${index}`);

        if (value === "Select Light" || value === "No Kasa Lights Found") {
            // Remove the light from selected lists if deselected or no lights found
            this.properties.selectedLightIds.splice(index, 1);
            this.properties.selectedLightNames.splice(index, 1);
            this.updateColorSwatch();       // Update color swatch as selection changed
            this.updateOnOffIndicator();    // Update On/Off indicator
            this.setDirtyCanvas(true, true);
            this.updateStatus(`Deselected light at selector ${index + 1}.`);
            return;
        }

        // Find the device based on the selected name
        const device = this.devices.find(device => device.alias === value || device.host === value);
        if (device) {
            this.properties.selectedLightIds[index] = device.deviceId;
            this.properties.selectedLightNames[index] = device.alias || device.host;

            console.log(`KasaLightControlNode - Selected light at index ${index}: ${device.alias || device.host}`);

            // **Fetch Current State and Color of the Selected Light**
            this.fetchLightStateAndColor(device.deviceId);

            // Update status
            this.updateStatus(`Selected light: ${device.alias || device.host}`);
        } else {
            console.error("KasaLightControlNode - Unable to find device.");
            this.properties.selectedLightIds.splice(index, 1);
            this.properties.selectedLightNames.splice(index, 1);
            this.updateColorSwatch();       // Update color swatch as selection changed
            this.updateOnOffIndicator();    // Update On/Off indicator
            this.setDirtyCanvas(true, true);
            this.updateStatus(`Invalid selection at selector ${index + 1}.`);
        }
    }


    /**
     * Fetches the current state and color of a selected light.
     * Updates the color swatch and On/Off indicator accordingly.
     * @param {string} lightId - The ID of the light to fetch.
     */
    async fetchLightStateAndColor(lightId) {
        try {
            const lightState = await window.KasaDeviceManager.getLightState(lightId);
            console.log(`KasaLightControlNode - Fetched state for Light ID ${lightId}:`, lightState);

            const state = lightState.on_off === 1; // Convert Kasa's state to a boolean: 1 is "on", 0 is "off"
            const hue = lightState.hue / 360; // Normalize hue (0-360) to 0-1
            const saturation = lightState.saturation / 100; // Normalize saturation (0-100) to 0-1
            const brightness = (lightState.brightness / 254) * 100; // Normalize brightness to 0-100

            // **Update On/Off State**
            this.onState = state;
            this.updateOnOffIndicator();

            // **Update Color Swatch**
            this.updateColorSwatch(hue, saturation, brightness);

            // Optionally, update status
            const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
            this.properties.status = `Light ${lightName} is ${state ? "On" : "Off"}`;
            if (this.statusWidget) {
                this.statusWidget.value = this.properties.status;
            }
            this.setDirtyCanvas(true);
        } catch (error) {
            console.error(`KasaLightControlNode - Error fetching state and color for Light ID ${lightId}:`, error);
            this.updateStatus(`Error fetching Light ${lightId}: ${error.message}`);
        }
    }




    /**
     * Handles incoming HSV Info input.
     * @param {object} hsv - Object containing hue, saturation, and brightness.
     */
    handleHSVInput(hsv) {
        if (this.properties.selectedLightIds.length === 0) {
            console.warn("KasaLightControlNode - No lights selected. Cannot update HSV.");
            this.updateStatus("No lights selected. Cannot update HSV.");
            return;
        }

        if (typeof hsv !== 'object' || hsv === null) {
            console.error("KasaLightControlNode - Invalid HSV input:", hsv);
            this.updateStatus("Invalid HSV input.");
            return;
        }

        const { hue, saturation, brightness } = hsv;

        // Validate HSV values
        if (
            typeof hue !== 'number' ||
            typeof saturation !== 'number' ||
            typeof brightness !== 'number'
        ) {
            console.error("KasaLightControlNode - HSV values must be numbers:", hsv);
            this.updateStatus("HSV values must be numbers.");
            return;
        }

        // Check for changes in HSV values
        if (
            hue === this.lastHsvInfo?.hue &&
            saturation === this.lastHsvInfo?.saturation &&
            brightness === this.lastHsvInfo?.brightness
        ) {
            // No changes detected; do not send redundant commands
            return;
        }

        // Update lastHsvInfo
        this.lastHsvInfo = { hue, saturation, brightness };

        // **Update the Color Swatch**
        this.updateColorSwatch(hue, saturation, brightness);

        // Convert to Kasa's expected format
        const kasaHsv = {
            hue: Math.round(hue * 360),                // 0-360
            saturation: Math.round(saturation * 100),  // 0-100
            brightness: Math.round((brightness / 254) * 100) // 0-100
        };
        console.log("KasaLightControlNode - Converted HSV Info for Kasa:", kasaHsv);

        // Debounce the HSV input to prevent rapid API calls
        if (this.hsvDebounceTimer) {
            clearTimeout(this.hsvDebounceTimer);
        }

        this.hsvDebounceTimer = setTimeout(() => {
            // Iterate over all selected lights and set their colors
            this.properties.selectedLightIds.forEach(lightId => {
                window.KasaDeviceManager.setColor(lightId, kasaHsv)
                    .then(() => {
                        console.log(`KasaLightControlNode - Successfully set color for Light ID ${lightId}.`);
                        // Update status
                        const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                        this.properties.status = `Set color for Light ${lightName}: H:${kasaHsv.hue} S:${kasaHsv.saturation} B:${kasaHsv.brightness}`;
                        if (this.statusWidget) {
                            this.statusWidget.value = this.properties.status;
                        }
                        this.setDirtyCanvas(true);
                    })
                    .catch(error => {
                        console.error(`KasaLightControlNode - Error setting color for Light ID ${lightId}:`, error);
                        this.updateStatus(`Error setting color for Light ${lightId}: ${error.message}`);
                    });
            });
        }, this.HSV_DEBOUNCE_DELAY);
    }

    /**
     * Handles incoming Toggle input for On/Off commands.
     * @param {boolean} toggle - Toggle signal.
     */
    handleToggleInput(toggle) {
        // Only process if a light is selected
        if (this.properties.selectedLightIds.length === 0) {
            console.warn("KasaLightControlNode - No lights selected. Cannot toggle state.");
            this.updateStatus("No lights selected. Cannot toggle state.");
            return;
        }

        // Do not process toggle input if no explicit user input (i.e., on initial load or light selection)
        if (toggle === null || toggle === undefined) {
            console.log("KasaLightControlNode - No explicit toggle input. Skipping toggle processing.");
            return;
        }

        // Avoid sending redundant commands if toggle state hasn't changed
        if (toggle === this.lastToggleState) {
            console.log("KasaLightControlNode - Toggle state unchanged. No action taken.");
            return;
        }

        this.lastToggleState = toggle;
        console.log(`KasaLightControlNode - Processing Toggle input: ${toggle}`);

        // Iterate over all selected lights and set their states
        this.properties.selectedLightIds.forEach(lightId => {
            if (toggle) {
                window.KasaDeviceManager.turnOn(lightId)
                    .then(() => {
                        console.log(`KasaLightControlNode - Successfully turned On Light ID ${lightId}.`);
                        this.updateStatus(`Light ${lightId} turned On`);
                        // Fetch and update state after turning On
                        this.fetchLightStateAndColor(lightId);
                    })
                    .catch(error => {
                        console.error(`KasaLightControlNode - Error turning On Light ID ${lightId}:`, error);
                        this.updateStatus(`Error turning On Light ${lightId}: ${error.message}`);
                    });
            } else {
                window.KasaDeviceManager.turnOff(lightId)
                    .then(() => {
                        console.log(`KasaLightControlNode - Successfully turned Off Light ID ${lightId}.`);
                        this.updateStatus(`Light ${lightId} turned Off`);
                        // Fetch and update state after turning Off
                        this.fetchLightStateAndColor(lightId);
                    })
                    .catch(error => {
                        console.log(`KasaLightControlNode - Light ${lightId} already Off or couldn't be turned Off:`, error.message);
                        // Attempt to fetch state regardless of the outcome
                        this.fetchLightStateAndColor(lightId);
                        this.updateStatus(`Error turning Off Light ${lightId}: ${error.message}`);
                    });
            }
        });
    }




    /**
     * Executes the node's main functionality.
     * Triggered by LiteGraph.
     */
    onExecute() {
        const hsvInfo = this.getInputData(0); // "HSV Info" input
        let toggle = this.getInputData(1);    // "Trigger" input

        // If no lights are selected, display a message and skip execution
        if (this.properties.selectedLightIds.length === 0) {
            this.properties.status = "No light selected. Please choose a light.";
            if (this.statusWidget) {
                this.statusWidget.value = this.properties.status;
            }
            this.setDirtyCanvas(true);
            return; // Skip the rest of the execution
        }

        // Only send commands after the initial load is complete
        if (this.initialLoad) {
            this.initialLoad = false; // Reset the flag after the first execution
            return; // Skip execution on load
        }

        // Explicitly cast toggle to boolean to handle 'false' correctly
        toggle = Boolean(toggle);

        // Handle Toggle Input
        if (typeof toggle === 'boolean') {
            this.handleToggleInput(toggle);
        }

        // Handle HSV Info Input
        if (hsvInfo) {
            this.handleHSVInput(hsvInfo);
        }

        // Emit Light Info Downstream
        const lightData = {
            lights: this.properties.selectedLightIds.map(id => ({
                light_id: id,
                name: this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(id)],
                status: this.onState ? "On" : "Off"
            })),
            status: this.properties.status
        };

        this.setOutputData(0, lightData);
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
        data.onState = this.onState;      // Include onState in serialization
        data.boxcolor = this.boxcolor;    // Include boxcolor in serialization
        return data;
    }

    /**
     * Configures the node from serialized data.
     * @param {object} data Serialized data.
     */
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.lastToggleState = (data.lastToggleState !== undefined) ? data.lastToggleState : null;
        this.lastHsvInfo = data.lastHsvInfo || null;

        // Set a flag to restore light selectors after devices are ready
        this.needsLightSelectorsRestore = true;

        // **Restore Indicators from Serialized Data**
        this.onState = (data.onState !== undefined) ? data.onState : false;
        this.boxcolor = data.boxcolor || "#000000";

        // Restore status widget value
        if (this.statusWidget) {
            this.statusWidget.value = this.properties.status || "No action yet";
        }

        // Update indicators based on restored data
        this.updateOnOffIndicator();
        if (this.properties.selectedLightIds.length > 0) {
            // Fetch and update the state and color of the first selected light
            this.fetchLightStateAndColor(this.properties.selectedLightIds[0]);
        }

        console.log("KasaLightControlNode - Configured with properties:", this.properties);
        this.setDirtyCanvas(true);
    }


    /**
     * Clean up timers when the node is removed.
     */
    onRemoved() {
        if (this.hsvDebounceTimer) {
            clearTimeout(this.hsvDebounceTimer);
        }
    }

    /**
     * Updates the color swatch at the bottom of the node.
     * @param {number} [hue] - Hue value (0-1).
     * @param {number} [saturation] - Saturation value (0-1).
     * @param {number} [brightness] - Brightness value (0-254).
     */
    updateColorSwatch(hue = this.lastHsvInfo?.hue, saturation = this.lastHsvInfo?.saturation, brightness = this.lastHsvInfo?.brightness) {
        if (hue === null || hue === undefined || saturation === null || saturation === undefined || brightness === null || brightness === undefined) {
            this.boxcolor = "#000000"; // Default to black if values are incomplete
        } else {
            const rgb = this.hsvToRgb(hue, saturation, brightness / 254);
            const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
            this.boxcolor = colorHex;
        }

        // Redraw the node to update the color swatch
        if (this.graph && this.graph.canvas) {
            this.setDirtyCanvas(true, true);
        }
    }

    /**
     * Updates the node's On/Off indicator in the title bar.
     */
    updateOnOffIndicator() {
        if (this.onState) {
            this.color = "#00FF00"; // Green when On
        } else {
            this.color = "#FF0000"; // Red when Off
        }

        // Redraw the node to update the title bar color
        if (this.graph && this.graph.canvas) {
            this.setDirtyCanvas(true, true);
        }
    }


    /**
     * Converts HSV values to RGB.
     * @param {number} h - Hue (0-1).
     * @param {number} s - Saturation (0-1).
     * @param {number} v - Value/Brightness (0-1).
     * @returns {Array} [r, g, b] values (0-255).
     */
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

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * Converts RGB values to Hex color string.
     * @param {number} r - Red (0-255).
     * @param {number} g - Green (0-255).
     * @param {number} b - Blue (0-255).
     * @returns {string} Hex color string.
     */
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    /**
     * Draws the color swatch and On/Off indicator on the node's foreground.
     * @param {CanvasRenderingContext2D} ctx - The rendering context.
     */
    onDrawForeground(ctx) {
        // Ensure the parent class's method is called if it exists
        if (super.onDrawForeground) {
            super.onDrawForeground(ctx);
        }

        // Draw the color swatch
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || "#000000";
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);

        // Draw the On/Off indicator
        ctx.fillStyle = this.onState ? "#00FF00" : "#FF0000"; // Green for On, Red for Off
        ctx.beginPath();
        ctx.arc(this.size[0] - 25, 25, 10, 0, Math.PI * 2);
        ctx.fill();

        // Add text indicating On/Off state
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "14px Arial";
        ctx.textAlign = "right";
        ctx.fillText(this.onState ? "On" : "Off", this.size[0] - 35, 30);
    }

}

// Register the node with LiteGraph under the "Lighting" category
LiteGraph.registerNodeType("Lighting/KasaLightControlNode", KasaLightControlNode);
console.log("KasaLightControlNode - Registered successfully under 'Lighting' category.");

// Attach the node class to LiteGraph namespace to prevent re-registration
LiteGraph.KasaLightControlNode = KasaLightControlNode;
