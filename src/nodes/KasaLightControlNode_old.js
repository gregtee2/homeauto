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
