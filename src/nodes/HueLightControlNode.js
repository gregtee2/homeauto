// File: src/nodes/HueLightControlNode.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Lighting/HueLightControlNode"]) {
    class HueLightControlNode extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Hue Light Control";
            this.size = [400, 200]; // Initial size with fixed width
            this.resizable = false; // Prevent manual resizing

            // Define properties
            this.properties = {
                selectedLightIds: [],    // Array to hold multiple Hue light IDs
                selectedLightNames: [],  // Array to hold multiple Hue light names
                status: "No action yet"  // Status message
            };

            // Initialize lightSelectors
            this.lightSelectors = [];

            // Add widgets
            this.setupWidgets();

            // Define inputs and outputs
            this.addInput("HSV Info", "hsv_info");        // Input to set color
            this.addInput("Trigger", "boolean");          // Input to toggle light On/Off
            this.addOutput("Light Info", "light_info");   // Output light info

            // Internal state
            this.devices = [];               // List of Hue devices
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

            console.log("HueLightControlNode - Initialized.");

            // Bind methods
            this.onAddLight = this.onAddLight.bind(this);
            this.onRemoveLight = this.onRemoveLight.bind(this);
            this.onLightSelected = this.onLightSelected.bind(this);
            this.fetchDevices = this.fetchDevices.bind(this);
            this.onDevicesReady = this.onDevicesReady.bind(this);
            this.onRefreshDevices = this.onRefreshDevices.bind(this);
            this.handleExternalStateChange = this.handleExternalStateChange.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.handleSelectedLightChange = this.handleSelectedLightChange.bind(this); // New binding

            // Register callbacks with HueDeviceManager
            if (window.HueDeviceManager) {
                // Listen for state changes
                if (typeof window.HueDeviceManager.onStateChange === 'function') {
                    window.HueDeviceManager.onStateChange(this.handleExternalStateChange);
                } else {
                    console.error("HueLightControlNode - HueDeviceManager does not have onStateChange method.");
                }

                // Listen for selected light changes
                if (typeof window.HueDeviceManager.onSelectedLightChange === 'function') {
                    window.HueDeviceManager.onSelectedLightChange(this.handleSelectedLightChange);
                } else {
                    console.error("HueLightControlNode - HueDeviceManager does not have onSelectedLightChange method.");
                }
            } else {
                console.error("HueLightControlNode - HueDeviceManager is not available.");
            }
        }

        /**
         * Handles updates when the selected lights change in HueDeviceManager.
         * @param {Array<object>} selectedLights - Array of selected light objects.
         */
        handleSelectedLightChange(selectedLights) {
            try {
                console.log("HueLightControlNode - Selected lights updated:", selectedLights);

                // Clear existing selections
                this.properties.selectedLightIds = [];
                this.properties.selectedLightNames = [];

                // Remove existing light selectors
                this.lightSelectors.forEach(selector => {
                    const index = this.widgets.indexOf(selector);
                    if (index > -1) {
                        this.widgets.splice(index, 1);
                    }
                });
                this.lightSelectors = [];

                // Re-add light selectors based on selectedLights
                selectedLights.forEach((light, index) => {
                    const lightSelector = this.addWidget(
                        "combo",
                        `Select Light ${index + 1}`,
                        `${light.name} (ID: ${light.light_id})`,
                        (value) => {
                            this.onLightSelected(value, index);
                        },
                        {
                            values: ["Select Light", ...this.getLightOptions()],
                            width: this.size[0] - 20
                        }
                    );
                    this.lightSelectors.push(lightSelector);

                    // Update properties
                    this.properties.selectedLightIds.push(light.light_id);
                    this.properties.selectedLightNames.push(light.name);

                    // Initialize perLightState if not already present
                    if (!this.perLightState[light.light_id]) {
                        this.perLightState[light.light_id] = {
                            on: false,
                            hue: 0,
                            saturation: 0,
                            brightness: 0
                        };
                    }
                });

                // Update the node's size based on the number of selectors
                this.updateNodeSize();

                // Refresh the canvas to reflect changes
                this.setDirtyCanvas(true);

                // Optionally, fetch the state and color for each selected light
                selectedLights.forEach(light => {
                    this.fetchLightStateAndColor(light.light_id);
                });

                this.updateStatus("Selected lights updated.");
            } catch (error) {
                console.error("HueLightControlNode - Error in handleSelectedLightChange:", error);
                this.updateStatus(`Error updating selected lights: ${error.message}`);
            }
        }

        /**
         * Ensures the node's width stays at 400 pixels.
         */
        onResize(size) {
            size[0] = 400; // Enforce width of 400
            return size;
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

                console.log("HueLightControlNode - Widgets set up.");
            } catch (error) {
                console.error("HueLightControlNode - Error setting up widgets:", error);
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
                console.error("HueLightControlNode - Error in onAdded:", error);
                this.updateStatus(`Error in onAdded: ${error.message}`);
            }
        }

        /**
         * Fetches Hue devices asynchronously.
         */
        async fetchDevices() {
            console.log("HueLightControlNode - Fetching Hue devices...");
            try {
                if (window.HueDeviceManager && typeof window.HueDeviceManager.getDevices === 'function') {
                    const devices = await window.HueDeviceManager.getDevices();
                    console.log("HueLightControlNode - Devices fetched:", devices);

                    if (devices && Array.isArray(devices) && devices.length > 0) {
                        this.devices = devices;
                        this.deviceManagerReady = true;
                        console.log(`HueLightControlNode - Retrieved devices: ${devices.length}`);
                        this.onDevicesReady();
                    } else {
                        throw new Error("No Hue Light devices found.");
                    }
                } else {
                    throw new Error("HueDeviceManager is not available or does not have getDevices method.");
                }
            } catch (error) {
                console.error("HueLightControlNode - Error fetching devices:", error);
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
                            const device = this.devices.find(device => device.light_id === lightId);
                            if (device) {
                                const lightName = `${device.name} (ID: ${device.light_id})`;
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
                            }
                        });
                    }
                    // Recalculate the node's size
                    this.updateNodeSize();
                    this.setDirtyCanvas(true);
                    this.updateStatus("Light selectors restored.");
                }
            } catch (error) {
                console.error("HueLightControlNode - Error in onDevicesReady:", error);
                this.updateStatus(`Error in onDevicesReady: ${error.message}`);
            }
        }

        /**
         * Refreshes the list of Hue devices.
         */
        async onRefreshDevices() {
            console.log("HueLightControlNode - Refreshing Hue devices...");
            try {
                await this.fetchDevices();
                console.log("HueLightControlNode - Devices refreshed.");
                this.updateStatus("Devices refreshed.");
            } catch (error) {
                console.error("HueLightControlNode - Error refreshing devices:", error);
                this.updateStatus(`Error refreshing devices: ${error.message}`);
            }
        }

        /**
         * Retrieves available light options for dropdowns.
         */
        getLightOptions() {
            return this.devices.map(device => `${device.name} (ID: ${device.light_id})`);
        }

        /**
         * Adds a new light selector dropdown.
         */
        onAddLight() {
            if (!this.deviceManagerReady) {
                console.warn("HueLightControlNode - Device manager not ready.");
                this.updateStatus("Device manager not ready.");
                return;
            }

            // Limit the number of selectable lights if desired
            const MAX_LIGHTS = 20;
            if (this.lightSelectors.length >= MAX_LIGHTS) {
                console.warn(`HueLightControlNode - Maximum of ${MAX_LIGHTS} lights reached.`);
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

                console.log(`HueLightControlNode - Added light selector ${this.lightSelectors.length}.`);
                this.updateStatus(`Added light selector ${this.lightSelectors.length}.`);
            } catch (error) {
                console.error("HueLightControlNode - Error adding light selector:", error);
                this.updateStatus(`Error adding light selector: ${error.message}`);
            }
        }

        /**
         * Removes the last light selector dropdown.
         */
        onRemoveLight() {
            if (this.lightSelectors.length === 0) {
                console.warn("HueLightControlNode - No light selectors to remove.");
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

                console.log(`HueLightControlNode - Removed light selector ${this.lightSelectors.length + 1}.`);
                this.updateStatus(`Removed light selector ${this.lightSelectors.length + 1}.`);
            } catch (error) {
                console.error("HueLightControlNode - Error removing light selector:", error);
                this.updateStatus(`Error removing light selector: ${error.message}`);
            }
        }

        /**
         * Updates the node's size based on the number of widgets and per-light indicators.
         */
        updateNodeSize() {
            // Base height accounting for initial widgets and padding
            let totalHeight = 150; // Initial height for fixed widgets and padding

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
        }

        /**
         * Callback when a light is selected from a dropdown.
         * @param {string} value - Selected value from the dropdown.
         * @param {number} index - Index of the selector in the lightSelectors array.
         */
        onLightSelected(value, index) {
            try {
                console.log(`HueLightControlNode - onLightSelected called with value: ${value} at index: ${index}`);

                // Check if value is a string
                if (typeof value !== 'string') {
                    console.error("HueLightControlNode - Selected value is not a string:", value);
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

                // Extract device ID from the selected value using regex
                const match = value.match(/\(ID:\s*(\d+)\)/);
                if (match && match[1]) {
                    const lightId = match[1]; // Keep as string to match HueDeviceManager's light_id
                    const lightName = value.split(" (ID:")[0];

                    // Prevent Duplicate Selections
                    if (this.properties.selectedLightIds.includes(lightId)) {
                        console.warn(`HueLightControlNode - Light ID ${lightId} is already selected.`);
                        this.updateStatus(`Light ID ${lightId} is already selected.`);

                        // Reset the dropdown to "Select Light"
                        this.lightSelectors[index].value = "Select Light";
                        this.properties.selectedLightIds[index] = null;
                        this.properties.selectedLightNames[index] = null;
                        return;
                    }

                    // Update properties
                    this.properties.selectedLightIds[index] = lightId;
                    this.properties.selectedLightNames[index] = lightName;

                    console.log(`HueLightControlNode - Light selected at index ${index}: ${value}`);

                    // Fetch Current State and Color of the Selected Light
                    this.fetchLightStateAndColor(lightId);

                    // Update HueDeviceManager's selected lights
                    const selectedLight = this.devices.find(light => light.light_id === lightId);
                    if (selectedLight) {
                        window.HueDeviceManager.addSelectedLight(selectedLight);
                    }
                } else {
                    console.error("HueLightControlNode - Unable to extract Light ID.");
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
                console.error("HueLightControlNode - Error in onLightSelected:", error);
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
                if (window.HueDeviceManager && typeof window.HueDeviceManager.getLightState === 'function') {
                    const lightState = await window.HueDeviceManager.getLightState(lightId);
                    console.log(`HueLightControlNode - Fetched state for Light ID ${lightId}:`, lightState);

                    const state = lightState.state.on; // Boolean: true is "on", false is "off"
                    const hue = (typeof lightState.state.hue === 'number') ? lightState.state.hue : 0;
                    const saturation = (typeof lightState.state.sat === 'number') ? lightState.state.sat : 0;
                    const brightness = (typeof lightState.state.bri === 'number') ? lightState.state.bri : 0;

                    // **Correct Hue Normalization**
                    const normalizedHue = (hue / 65535) * 360; // Scale hue to 0-360

                    // **Correct Saturation and Brightness Normalization**
                    const normalizedSaturation = saturation / 254;  // Scale saturation to 0-1
                    const normalizedBrightness = brightness / 254;  // Scale brightness to 0-1

                    // Update Per-light State
                    this.perLightState[lightId] = {
                        on: state,
                        hue: normalizedHue,
                        saturation: normalizedSaturation * 100,  // Store saturation as percentage (0-100)
                        brightness: normalizedBrightness * 254  // Store brightness in 0-254 range
                    };

                    // **Update the Color Swatch with normalized values**
                    this.updateColorSwatch(normalizedHue / 360, normalizedSaturation, normalizedBrightness);

                    // Update Status
                    const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                    this.updateStatus(`Light ${lightName} is ${state ? "On" : "Off"}`);
                } else {
                    throw new Error("HueDeviceManager is not available or does not have getLightState method.");
                }
            } catch (error) {
                console.error(`HueLightControlNode - Error fetching state and color for Light ID ${lightId}:`, error);
                this.updateStatus(`Error fetching Light ${lightId}: ${error.message}`);
            }
        }

        /**
         * Handles incoming HSV Info input.
         * @param {object} hsv - Object containing hue, saturation, and brightness.
         */
        handleHSVInput(hsv) {
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("HueLightControlNode - No lights selected. Cannot update HSV.");
                this.updateStatus("No lights selected. Cannot update HSV.");
                return;
            }

            if (typeof hsv !== 'object' || hsv === null) {
                console.error("HueLightControlNode - Invalid HSV input:", hsv);
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
                console.error("HueLightControlNode - HSV values must be numbers:", hsv);
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

            // **Normalize HSV values to expected ranges**
            // Assuming hue, saturation, brightness are in 0-1 range
            const normalizedHue = hue * 360; // Hue: 0-360 degrees
            const normalizedSaturation = saturation * 100; // Saturation: 0-100%
            const normalizedBrightness = brightness; // Brightness: 0-254

            // Debounce the HSV input to prevent rapid API calls
            if (this.hsvDebounceTimer) {
                clearTimeout(this.hsvDebounceTimer);
            }

            this.hsvDebounceTimer = setTimeout(() => {
                // Iterate over all selected lights and set their colors
                this.properties.selectedLightIds.forEach(lightId => {
                    if (lightId && window.HueDeviceManager && typeof window.HueDeviceManager.setLightColor === 'function') {
                        window.HueDeviceManager.setLightColor(lightId, {
                            hue: normalizedHue,
                            saturation: normalizedSaturation,
                            brightness: normalizedBrightness
                        })
                            .then(() => {
                                console.log(`HueLightControlNode - Set HSV for Light ID ${lightId}:`, {
                                    hue: normalizedHue,
                                    saturation: normalizedSaturation,
                                    brightness: normalizedBrightness
                                });
                                // Update perLightState
                                if (this.perLightState[lightId]) {
                                    this.perLightState[lightId].hue = normalizedHue;
                                    this.perLightState[lightId].saturation = normalizedSaturation;
                                    this.perLightState[lightId].brightness = normalizedBrightness;
                                }
                                // Update status
                                const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                                this.updateStatus(`Set color for Light ${lightName}.`);
                            })
                            .catch(error => {
                                console.error(`HueLightControlNode - Error setting HSV for Light ID ${lightId}:`, error);
                                this.updateStatus(`Error setting color for Light ${lightId}: ${error.message}`);
                            });
                    } else {
                        console.error("HueLightControlNode - HueDeviceManager is not available or does not have setLightColor method.");
                        this.updateStatus(`Error: Cannot set color for Light ${lightId}.`);
                    }
                });
            }, this.HSV_DEBOUNCE_DELAY);
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
                    // Use hue, saturation, brightness directly as they are in 0-1 range
                    const rgb = this.hsvToRgb(hue, saturation, brightness);
                    const colorHex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
                    this.boxcolor = colorHex;
                }

                // Redraw the node to update the color swatch
                if (this.graph && this.graph.canvas) {
                    this.setDirtyCanvas(true, true);
                }
            } catch (error) {
                console.error("HueLightControlNode - Error updating color swatch:", error);
                this.updateStatus(`Error updating color swatch: ${error.message}`);
            }
        }

        /**
         * Handles incoming Trigger input for On/Off commands.
         * @param {boolean} trigger - Trigger signal.
         */
        handleTrigger(trigger) {
            if (this.properties.selectedLightIds.length === 0) {
                console.warn("HueLightControlNode - No lights selected. Cannot toggle state.");
                this.updateStatus("No lights selected. Cannot toggle state.");
                return;
            }

            // Ensure desiredState is always a valid boolean
            const desiredState = Boolean(trigger);

            // Check if the desired state is different from the previous state
            if (desiredState === this.lastToggleInput) {
                // No change in trigger; do not send redundant commands
                return;
            }

            // Update previous toggle state
            this.lastToggleInput = desiredState;

            console.log(`HueLightControlNode - handleTrigger: Setting state to ${desiredState ? "On" : "Off"} for lights`);
            this.updateStatus(`Setting lights to ${desiredState ? "On" : "Off"}.`);

            // Iterate over all selected lights and set their states
            this.properties.selectedLightIds.forEach(lightId => {
                if (lightId && window.HueDeviceManager && typeof window.HueDeviceManager.setLightState === 'function') {
                    window.HueDeviceManager.setLightState(lightId, desiredState)
                        .then(() => {
                            console.log(`HueLightControlNode - Set state for Light ID ${lightId} to ${desiredState ? "On" : "Off"}.`);
                            // Update perLightState
                            if (this.perLightState[lightId]) {
                                this.perLightState[lightId].on = desiredState;
                            }
                            // Update status
                            const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                            this.updateStatus(`Light ${lightName} turned ${desiredState ? "On" : "Off"}.`);
                            this.setDirtyCanvas(true);
                        })
                        .catch(error => {
                            console.error(`HueLightControlNode - Error setting state for Light ID ${lightId}:`, error);
                            // Optionally, update status with error
                            const lightName = this.properties.selectedLightNames[this.properties.selectedLightIds.indexOf(lightId)];
                            this.updateStatus(`Error turning ${desiredState ? "On" : "Off"} Light ${lightName}: ${error.message}`);
                        });
                } else {
                    console.error("HueLightControlNode - HueDeviceManager is not available or does not have setLightState method.");
                    this.updateStatus(`Error: Cannot set state for Light ${lightId}.`);
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
                    this.handleTrigger(triggerInput);
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
                console.error("HueLightControlNode - Error in onExecute:", error);
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
                console.error("HueLightControlNode - Error in serialize:", error);
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

                console.log("HueLightControlNode - Configured with properties:", this.properties);
                this.setDirtyCanvas(true);
            } catch (error) {
                console.error("HueLightControlNode - Error in configure:", error);
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
                console.error("HueLightControlNode - Error in onRemoved:", error);
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
                const startY = widgetsHeight + 85; // Adjust padding as needed

                // Draw the color swatch at the bottom
                const swatchHeight = 20;
                ctx.fillStyle = this.boxcolor || "#000000";
                ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);

                // Draw Per-Light Indicators
                const spacing = 30; // Spacing between lights

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

                    // Draw On/Off Indicator (Circle) (Right-justified)
                    const onOffRadius = 10;
                    const onOffX = this.size[0] - 70; // Position from the right
                    ctx.fillStyle = lightState.on ? "#00FF00" : "#FF0000";
                    ctx.beginPath();
                    ctx.arc(onOffX, yPosition - 5, onOffRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw border for On/Off Indicator
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Draw Color Box (Right-justified, next to On/Off Indicator)
                    const colorBoxSize = 20;
                    const colorBoxX = this.size[0] - 40; // Position from the right

                    // Normalize hue, saturation, brightness for color conversion
                    const hueNormalized = (lightState.hue % 360) / 360;
                    const saturationNormalized = lightState.saturation / 100;
                    const brightnessNormalized = lightState.brightness / 254;

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
            } catch (error) {
                console.error("HueLightControlNode - Error in onDrawForeground:", error);
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
                    console.warn("HueLightControlNode - graph or canvas is not available.");
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

                const startY = widgetsHeight + 85; // Starting Y position for the first light
                const spacing = 30; // Spacing between lights

                this.properties.selectedLightIds.forEach((lightId, index) => {
                    if (!lightId) return; // Skip if no light is selected

                    const lightName = this.properties.selectedLightNames[index];
                    const lightState = this.perLightState[lightId];

                    if (!lightState) return;

                    const yPosition = startY + index * spacing;

                    // Check if On/Off Indicator was clicked
                    const onOffX = this.size[0] - 70;
                    const onOffY = yPosition - 5;
                    const onOffRadius = 10;
                    const distanceToOnOff = Math.sqrt(Math.pow(x - onOffX, 2) + Math.pow(y - onOffY, 2));
                    if (distanceToOnOff <= onOffRadius) {
                        // Toggle the light's state
                        const newState = !lightState.on;
                        if (window.HueDeviceManager && typeof window.HueDeviceManager.setLightState === 'function') {
                            window.HueDeviceManager.setLightState(lightId, newState)
                                .then(() => {
                                    console.log(`HueLightControlNode - Toggled state for Light ID ${lightId} to ${newState ? "On" : "Off"}.`);
                                    this.perLightState[lightId].on = newState;
                                    // Update status
                                    this.updateStatus(`Light ${lightName} turned ${newState ? "On" : "Off"}.`);
                                    this.setDirtyCanvas(true);
                                })
                                .catch(error => {
                                    console.error(`HueLightControlNode - Error toggling state for Light ID ${lightId}:`, error);
                                    this.updateStatus(`Error toggling Light ${lightName}: ${error.message}`);
                                });
                        } else {
                            console.error("HueLightControlNode - HueDeviceManager is not available or does not have setLightState method.");
                            this.updateStatus(`Error: Cannot set state for Light ${lightId}.`);
                        }
                        return; // Exit after handling click
                    }

                    // Check if Color Box was clicked
                    const colorBoxX = this.size[0] - 40;
                    const colorBoxY = yPosition - 15; // Centered vertically
                    const colorBoxSize = 20;
                    if (
                        x >= colorBoxX &&
                        x <= colorBoxX + colorBoxSize &&
                        y >= colorBoxY &&
                        y <= colorBoxY + colorBoxSize
                    ) {
                        // For simplicity, we'll cycle hue by 30 degrees
                        const newHue = (lightState.hue + 30) % 360;
                        if (window.HueDeviceManager && typeof window.HueDeviceManager.setLightColor === 'function') {
                            window.HueDeviceManager.setLightColor(lightId, {
                                hue: newHue,
                                saturation: lightState.saturation,
                                brightness: lightState.brightness
                            })
                                .then(() => {
                                    console.log(`HueLightControlNode - Updated color for Light ID ${lightId} to hue=${newHue}.`);
                                    this.perLightState[lightId].hue = newHue;
                                    // Update status
                                    this.updateStatus(`Light ${lightName} color updated.`);
                                    this.setDirtyCanvas(true);
                                })
                                .catch(error => {
                                    console.error(`HueLightControlNode - Error updating color for Light ID ${lightId}:`, error);
                                    this.updateStatus(`Error updating color for Light ${lightName}: ${error.message}`);
                                });
                        } else {
                            console.error("HueLightControlNode - HueDeviceManager is not available or does not have setLightColor method.");
                            this.updateStatus(`Error: Cannot set color for Light ${lightId}.`);
                        }
                        return; // Exit after handling click
                    }
                });
            } catch (error) {
                console.error("HueLightControlNode - Error in onMouseDown:", error);
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
                console.error("HueLightControlNode - Error updating status:", error);
            }
        }

        /**
         * Handles external state changes from HueDeviceManager.
         * @param {string} lightId - The ID of the device that changed.
         * @param {object} newState - The new state of the device.
         */
        handleExternalStateChange(lightId, newState) {
            try {
                if (this.properties.selectedLightIds.includes(lightId)) {
                    console.log(`HueLightControlNode - Detected state change for device ${lightId}:`, newState);
                    this.fetchLightStateAndColor(lightId);
                    this.setDirtyCanvas(true);
                }
            } catch (error) {
                console.error("HueLightControlNode - Error handling external state change:", error);
                this.updateStatus(`Error handling state change: ${error.message}`);
            }
        }
    }

    // Register the node with LiteGraph under the "Lighting" category
    LiteGraph.registerNodeType("Lighting/HueLightControlNode", HueLightControlNode);
    console.log("HueLightControlNode - Registered successfully under 'Lighting' category.");

    // Attach the node class to LiteGraph namespace to prevent re-registration
    LiteGraph.HueLightControlNode = HueLightControlNode;
} 

