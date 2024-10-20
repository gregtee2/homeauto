// File: src/nodes/KasaPlugControlNode.js

class KasaPlugControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Kasa Plug Control";
        this.size = [400, 300]; // Increased size to accommodate additional widgets

        // Internal state
        this.plugs = [];
        this.plugSelectors = []; // Initialize plugSelectors array
        this.initialLoad = true;
        this.deviceManagerReady = false;

        // Define properties
        this.properties = {
            selectedPlugIds: [],
            selectedPlugNames: [],
            status: "No action yet"
        };

        // Define inputs and outputs
        this.addInput("Trigger", "boolean");          // Input to toggle plug On/Off
        //this.addOutput("Plug Info", "plug_info");     // Output plug info
        //this.addOutput("Energy Data", "energy_data"); // Output energy data

        // Initialize widgets
        this.setupWidgets();

        // State tracking
        this.lastToggleState = null;

        // Debounce timer for inputs
        this.toggleDebounceTimer = null;
        this.TOGGLE_DEBOUNCE_DELAY = 300; // milliseconds

        // Bind methods
        this.onAddPlug = this.onAddPlug.bind(this);
        this.onRemovePlug = this.onRemovePlug.bind(this);
        this.onPlugSelected = this.onPlugSelected.bind(this);
        this.fetchPlugs = this.fetchPlugs.bind(this);
        this.onPlugsReady = this.onPlugsReady.bind(this);
        this.onRefreshPlugs = this.onRefreshPlugs.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);

        // Flag to indicate that plug selectors need to be restored
        this.needsPlugSelectorsRestore = false;

        // **Properties for Indicators**
        this.boxcolor = "#000000"; // Default color (black)
        this.onState = false;       // Indicates if the plugs are On or Off

        // Initialize plugSelectors array
        this.plugSelectors = [];

        // **New Property to Track Energy Data for Each Plug**
        this.energyDataMap = new Map(); // Map to store energy data for each plug by deviceId
        this.updateTotalEnergyDebounce = null;
        this.UPDATE_DEBOUNCE_DELAY = 500; // 500 milliseconds

        // Subscribe to state changes if SmartPlugDeviceManager is loaded
        if (window.SmartPlugDeviceManager && typeof window.SmartPlugDeviceManager.onStateChange === 'function') {
            window.SmartPlugDeviceManager.onStateChange(this.handleStateChange);
            console.log("KasaPlugControlNode - Subscribed to SmartPlugDeviceManager state changes.");
        } else {
            console.warn("KasaPlugControlNode - SmartPlugDeviceManager is not loaded. State changes will not be tracked.");
        }

        console.log("KasaPlugControlNode - Initialized.");
    }

    /**
     * Sets up widgets with proper callbacks or property bindings.
     */
    setupWidgets() {
        // Button to add a new plug selection
        this.addPlugButton = this.addWidget(
            "button",
            "Add Plug",
            "Add",
            () => {
                this.onAddPlug();
            },
            {
                width: this.size[0] - 20
            }
        );

        // Button to remove the last plug selection
        this.removePlugButton = this.addWidget(
            "button",
            "Remove Plug",
            "Remove",
            () => {
                this.onRemovePlug();
            },
            {
                width: this.size[0] - 20
            }
        );

        // Button to refresh plugs
        this.refreshPlugsButton = this.addWidget(
            "button",
            "Refresh Plugs",
            "Refresh",
            () => {
                this.onRefreshPlugs();
            },
            {
                width: this.size[0] - 20
            }
        );

        // Power display (readonly text widget)
        this.powerWidget = this.addWidget(
            "text",
            "Power",
            "Power: N/A", // Default text until data is loaded
            null,
            {
                readonly: true,
                width: this.size[0] - 20
            }
        );

        // Total Energy display (readonly text widget)
        this.totalEnergyWidget = this.addWidget(
            "text",
            "Total Energy",
            "Total: N/A",
            null,
            {
                readonly: true,
                width: this.size[0] - 20
            }
        );

        // Current display (readonly text widget)
        this.currentWidget = this.addWidget(
            "text",
            "Current",
            "Current: N/A",
            null,
            {
                readonly: true,
                width: this.size[0] - 20
            }
        );

        // Voltage display (readonly text widget)
        this.voltageWidget = this.addWidget(
            "text",
            "Voltage",
            "Voltage: N/A",
            null,
            {
                readonly: true,
                width: this.size[0] - 20
            }
        );

        // Status display (readonly text widget) for overall status
        this.statusWidget = this.addWidget(
            "text",
            "Status",
            this.properties.status,
            null,
            {
                readonly: true,
                width: this.size[0] - 20,
                multiline: true,
                height: 50
            }
        );

        // On/Off Indicator Widget
        this.onOffWidget = this.addWidget(
            "text",
            "On/Off",
            this.onState ? "On" : "Off",
            null,
            {
                readonly: true,
                width: this.size[0] - 20
            }
        );

        // Redraw canvas after widgets are created
        this.setDirtyCanvas(true);

        console.log("KasaPlugControlNode - Widgets set up.");
    }

    /**
     * Called when the node is added to the graph.
     * Initiates plug fetching.
     */
    onAdded() {
        this.fetchPlugs().then(() => {
            // After fetching plugs, fetch energy data for all selected plugs
            this.properties.selectedPlugIds.forEach(async (plugId) => {
                try {
                    const energyData = await this.fetchPlugEnergyData(plugId);
                    if (energyData) {
                        this.energyDataMap.set(plugId, energyData.total_wh);
                    }
                } catch (error) {
                    console.warn(`KasaPlugControlNode - Unable to fetch energy data for Plug ID ${plugId} on add.`);
                }
            });
            this.updateTotalEnergy();
        });
    }

    /**
     * Fetches Kasa smart plugs asynchronously.
     */
    async fetchPlugs() {
        console.log("KasaPlugControlNode - Fetching Kasa smart plugs...");
        try {
            if (!window.SmartPlugDeviceManager || !window.SmartPlugDeviceManager.deviceManagerReady) {
                console.error("KasaPlugControlNode - SmartPlugDeviceManager is not ready. Deferring actions.");
                window.SmartPlugDeviceManager.onReady(() => {
                    console.log("KasaPlugControlNode - SmartPlugDeviceManager is ready now.");
                    this.fetchPlugs();
                });
                return;
            }


            const plugs = await window.SmartPlugDeviceManager.fetchDevices(); // Use SmartPlugDeviceManager
            console.log("KasaPlugControlNode - Plugs fetched:", plugs);

            if (plugs && Array.isArray(plugs) && plugs.length > 0) {
                this.plugs = plugs;
                this.deviceManagerReady = true;
                console.log(`KasaPlugControlNode - Retrieved plugs: ${plugs.length}`);
                this.onPlugsReady();
            } else {
                throw new Error("No Kasa smart plugs found.");
            }
        } catch (error) {
            console.error("KasaPlugControlNode - Error fetching smart plugs:", error);
            // Optionally, disable Add/Remove Plug buttons if plugs can't be fetched
            this.widgets.forEach(widget => {
                if (widget.name === "Add Plug" || widget.name === "Remove Plug" || widget.name === "Refresh Plugs") {
                    widget.disabled = true;
                }
            });
            this.updateStatus("Failed to fetch smart plugs.");
            this.setDirtyCanvas(true);
        }
    }

    /**
     * Called when plugs are ready.
     * Restores plug selectors if needed.
     */
    onPlugsReady() {
        // Restore the selected plugs if needed
        if (this.needsPlugSelectorsRestore) {
            this.needsPlugSelectorsRestore = false;
            if (this.properties.selectedPlugIds && this.properties.selectedPlugIds.length > 0) {
                this.properties.selectedPlugIds.forEach((plugId, index) => {
                    const plug = this.plugs.find(plug => plug.deviceId === plugId);
                    if (plug) {
                        const plugName = plug.alias || plug.host;
                        const plugSelector = this.addWidget(
                            "combo",
                            `Select Plug ${index + 1}`,
                            plugName,
                            (value) => {
                                this.onPlugSelected(value, index);
                            },
                            {
                                values: ["Select Plug", ...this.getPlugOptions()],
                                width: this.size[0] - 20
                            }
                        );
                        this.plugSelectors.push(plugSelector);
                        // Adjust node size
                        this.size[0] = Math.max(this.size[0], 400);
                        this.size[1] = 300 + (this.plugSelectors.length * 50); // Adjusted base height
                        this.setSize(this.size);
                    }
                });
            }

            this.setDirtyCanvas(true);
        }
    }

    /**
     * Refreshes the list of Kasa smart plugs.
     */
    async onRefreshPlugs() {
        console.log("KasaPlugControlNode - Refreshing Kasa smart plugs...");
        await this.fetchPlugs();
        console.log("KasaPlugControlNode - Plugs refreshed.");
    }

    /**
     * Retrieves available plug options for dropdowns.
     */
    getPlugOptions() {
        // Check if plugs are loaded
        if (!this.plugs || this.plugs.length === 0) {
            return ["No Kasa Plugs Found"];
        }

        // Map plug names for the dropdown
        return this.plugs.map(plug => plug.alias || plug.host);
    }

    /**
     * Adds a new plug selector dropdown.
     */
    onAddPlug() {
        if (!this.deviceManagerReady) {
            console.warn("KasaPlugControlNode - Device manager not ready.");
            this.updateStatus("Device manager not ready.");
            return;
        }

        // Limit the number of selectable plugs if desired
        const MAX_PLUGS = 10;
        if (this.plugSelectors.length >= MAX_PLUGS) {
            console.warn(`KasaPlugControlNode - Maximum of ${MAX_PLUGS} plugs reached.`);
            this.updateStatus(`Maximum of ${MAX_PLUGS} plugs reached.`);
            return;
        }

        // Create a new dropdown for plug selection
        const plugSelector = this.addWidget(
            "combo",
            `Select Plug ${this.plugSelectors.length + 1}`,
            "Select Plug",
            (value) => {
                this.onPlugSelected(value, this.plugSelectors.indexOf(plugSelector));
            },
            {
                values: ["Select Plug", ...this.getPlugOptions()],
                width: this.size[0] - 20
            }
        );

        // Add to the array of selectors
        this.plugSelectors.push(plugSelector);

        // Adjust node size
        this.size[0] = Math.max(this.size[0], 400);
        this.size[1] = 300 + (this.plugSelectors.length * 50); // Adjusted base height
        this.setSize(this.size);

        // Update the canvas
        this.setDirtyCanvas(true, true);

        console.log(`KasaPlugControlNode - Added plug selector ${this.plugSelectors.length}.`);
    }

    /**
     * Removes the last plug selector dropdown.
     */
    onRemovePlug() {
        if (this.plugSelectors.length === 0) {
            console.warn("KasaPlugControlNode - No plug selectors to remove.");
            this.updateStatus("No plug selectors to remove.");
            return;
        }

        const plugSelector = this.plugSelectors.pop(); // Remove the last selector reference

        // Remove the widget from the widgets array
        const index = this.widgets.indexOf(plugSelector);
        if (index > -1) {
            this.widgets.splice(index, 1);
        }

        // Remove the last selected plug from the properties arrays
        const removedPlugId = this.properties.selectedPlugIds.pop();
        const removedPlugName = this.properties.selectedPlugNames.pop();

        // **Remove energy data from the map**
        if (removedPlugId) {
            this.energyDataMap.delete(removedPlugId);
            this.updateTotalEnergy();
        }

        // Adjust node size
        this.size[0] = Math.max(this.size[0], 400);
        this.size[1] = 300 + (this.plugSelectors.length * 50); // Adjusted base height
        this.setSize(this.size);

        // Update the canvas
        this.setDirtyCanvas(true, true);

        console.log(`KasaPlugControlNode - Removed plug selector ${this.plugSelectors.length + 1}.`);
    }

    /**
     * Callback when a plug is selected from a dropdown.
     */
    async onPlugSelected(value, index) {
        console.log(`KasaPlugControlNode - onPlugSelected called with value: ${value} at index: ${index}`);

        if (value === "Select Plug" || value === "No Kasa Plugs Found") {
            // Remove the plug from selected lists if deselected or no plugs found
            const removedPlugId = this.properties.selectedPlugIds.splice(index, 1);
            const removedPlugName = this.properties.selectedPlugNames.splice(index, 1);

            // **Remove energy data from the map**
            if (removedPlugId && removedPlugId.length > 0) {
                this.energyDataMap.delete(removedPlugId[0]);
                this.updateTotalEnergy();
            }

            this.updateStatus("Plug deselected.");
            this.setDirtyCanvas(true);
            return;
        }

        // Find the plug based on the selected name
        const plug = this.plugs.find(plug => plug.alias === value || plug.host === value);
        if (plug) {
            this.properties.selectedPlugIds[index] = plug.deviceId;
            this.properties.selectedPlugNames[index] = plug.alias || plug.host;

            console.log(`KasaPlugControlNode - Selected plug at index ${index}: ${plug.alias || plug.host}`);

            // **Fetch Current Energy Data and State of the Selected Plug**
            await this.fetchPlugEnergyData(plug.deviceId);
        } else {
            console.error("KasaPlugControlNode - Unable to find plug.");
            this.properties.selectedPlugIds.splice(index, 1);
            this.properties.selectedPlugNames.splice(index, 1);

            // Remove energy data if plug not found
            if (this.properties.selectedPlugIds.length > index) {
                const removedPlugId = this.properties.selectedPlugIds[index];
                this.energyDataMap.delete(removedPlugId);
                this.updateTotalEnergy();
            }

            this.updateStatus("Selected plug not found.");
            this.setDirtyCanvas(true);
        }
    }

    /**
     * Handles state changes from SmartPlugDeviceManager.
     * @param {string} deviceId - The ID of the smart plug.
     * @param {object} newState - The new state of the smart plug.
     */
    async handleStateChange(deviceId, newState) {
        if (this.properties.selectedPlugIds.includes(deviceId)) {
            // Determine if the plug is On or Off
            const isOn = newState.on_off === 1; // Assuming 'on_off' is 1 for On, 0 for Off

            // Log the current state change
            console.log(`KasaPlugControlNode - Plug ${deviceId} state changed to: ${isOn ? "On" : "Off"}`);

            // Update On/Off Indicator
            this.onState = isOn;

            // Update On/Off Indicator Widget
            this.updateOnOffIndicator();

            // Fetch energy data after the state change
            try {
                console.log(`KasaPlugControlNode - Fetching energy data for Plug ID ${deviceId}...`);
                const energyData = await window.SmartPlugDeviceManager.fetchPlugEnergyUsage(deviceId);
                console.log(`KasaPlugControlNode - Successfully fetched energy data for Plug ID ${deviceId}:`, energyData);

                if (energyData) {
                    // **Store energy data in the map**
                    this.energyDataMap.set(deviceId, energyData.total_wh);

                    // **Update the total energy display**
                    this.updateTotalEnergy();

                    // Update the status with both the state and the energy data
                    const plugIndex = this.properties.selectedPlugIds.indexOf(deviceId);
                    const plugName = this.properties.selectedPlugNames[plugIndex];
                    const stateMessage = `Plug ${plugName} is ${isOn ? "On" : "Off"}`;
                    this.properties.status = `${stateMessage} | Power: ${(energyData.power_mw / 1000).toFixed(2)} W, Total: ${energyData.total_wh} Wh, Current: ${energyData.current_ma} mA, Voltage: ${(energyData.voltage_mv / 1000).toFixed(2)} V`;
                    console.log(`KasaPlugControlNode - Updated status: ${this.properties.status}`);

                    // Update the status widget
                    if (this.statusWidget) {
                        this.statusWidget.value = this.properties.status;
                    }

                    // Update the On/Off widget if it exists
                    if (this.onOffWidget) {
                        this.onOffWidget.value = this.onState ? "On" : "Off";
                    }

                    this.setDirtyCanvas(true); // Redraw the canvas to reflect the updated status
                } else {
                    console.error("KasaPlugControlNode - No energy data found.");
                    this.properties.status = `Plug ${deviceId} state updated, but no energy data available.`;

                    // Update the status widget
                    if (this.statusWidget) {
                        this.statusWidget.value = this.properties.status;
                    }

                    this.setDirtyCanvas(true);
                }
            } catch (error) {
                console.error(`KasaPlugControlNode - Error fetching energy data for Plug ID ${deviceId}:`, error);
                this.properties.status = `Error fetching energy data for Plug ${deviceId}.`;

                // Update the status widget
                if (this.statusWidget) {
                    this.statusWidget.value = this.properties.status;
                }

                this.setDirtyCanvas(true);
            }

            // Ensure that the canvas is redrawn after the update
            if (this.statusWidget) {
                this.statusWidget.value = this.properties.status;
            }
            this.setDirtyCanvas(true);
        }
    }

    /**
     * Fetches the current energy data and state of a selected plug.
     * @param {string} plugId - The ID of the plug to fetch.
     * @returns {object} energyData - The fetched energy data.
     */
    async fetchPlugEnergyData(plugId) {
        try {
            // Fetch energy usage first
            const energyData = await window.SmartPlugDeviceManager.fetchPlugEnergyUsage(plugId);
            
            // Check if valid energy data is received
            if (!energyData || !energyData.power_mw || !energyData.total_wh) {
                throw new Error(`No valid energy data returned for Plug ID ${plugId}.`);
            }

            console.log(`KasaPlugControlNode - Fetched energy data for Plug ID ${plugId}:`, energyData);

            // **Store energy data in the map**
            this.energyDataMap.set(plugId, energyData.total_wh);

            // **Update the total energy display**
            this.updateTotalEnergy();

            // Update individual plug widgets if needed
            this.powerWidget.value = `Power: ${(energyData.power_mw / 1000).toFixed(2)} W`;
            this.totalEnergyWidget.value = `Total: ${this.calculateTotalEnergy()} Wh`;
            this.currentWidget.value = `Current: ${energyData.current_ma} mA`;
            this.voltageWidget.value = `Voltage: ${(energyData.voltage_mv / 1000).toFixed(2)} V`;

            // Redraw the canvas to reflect the updated widgets
            this.setDirtyCanvas(true);

            // Return the fetched energy data for further use
            return energyData;

        } catch (error) {
            console.error(`KasaPlugControlNode - Error fetching energy data for Plug ID ${plugId}:`, error);
            this.updateStatus(`Error fetching energy data for Plug ${plugId}`);
            throw error; // Rethrow to handle it in the calling function
        }
    }

    /**
     * Calculates the total energy from all selected plugs.
     * @returns {number} totalEnergy - The sum of total_wh from all plugs.
     */
    calculateTotalEnergy() {
        let totalEnergy = 0;
        for (let energy of this.energyDataMap.values()) {
            totalEnergy += energy;
        }
        return totalEnergy;
    }

    /**
     * Updates the Total Energy widget with the aggregated value, using debounce.
     */
    updateTotalEnergy() {
        if (this.updateTotalEnergyDebounce) {
            clearTimeout(this.updateTotalEnergyDebounce);
        }

        this.updateTotalEnergyDebounce = setTimeout(() => {
            const totalEnergy = this.calculateTotalEnergy();
            this.totalEnergyWidget.value = `Total: ${totalEnergy} Wh`;
            console.log(`KasaPlugControlNode - Updated Total Energy: ${totalEnergy} Wh`);
            this.setDirtyCanvas(true);
        }, this.UPDATE_DEBOUNCE_DELAY);
    }

    /**
     * Removes the energy data for a specific plug and updates the total.
     * @param {string} plugId - The ID of the plug to remove from energyDataMap.
     */
    removePlugEnergyData(plugId) {
        if (this.energyDataMap.has(plugId)) {
            this.energyDataMap.delete(plugId);
            this.updateTotalEnergy();
        }
    }

    /**
     * Handles Toggle Input for On/Off commands.
     * @param {boolean} toggle - Toggle signal.
     */
    handleToggleInput(toggle) {
        // Only process if plugs are selected
        if (this.properties.selectedPlugIds.length === 0) {
            console.warn("KasaPlugControlNode - No plugs selected. Cannot toggle state.");
            this.updateStatus("No plug selected. Cannot toggle.");
            return;
        }

        // Avoid sending redundant commands if toggle state hasn't changed
        if (toggle === this.lastToggleState) {
            console.log("KasaPlugControlNode - Toggle state unchanged. No action taken.");
            return;
        }

        this.lastToggleState = toggle;
        console.log(`KasaPlugControlNode - Processing Toggle input: ${toggle}`);

        this.properties.selectedPlugIds.forEach(plugId => {
            const action = toggle ? "on" : "off";

            // Update the state and then fetch energy data
            window.SmartPlugDeviceManager.setDeviceState(plugId, action)
                .then(async () => {
                    console.log(`KasaPlugControlNode - Successfully turned ${action} Plug ID ${plugId}.`);

                    try {
                        // Fetch energy data after turning On/Off
                        const energyData = await this.fetchPlugEnergyData(plugId);

                        if (energyData) {
                            // Format the energy data for display
                            const formattedEnergyData = `Power: ${(energyData.power_mw / 1000).toFixed(2)} W, Total: ${energyData.total_wh} Wh, Current: ${energyData.current_ma} mA, Voltage: ${(energyData.voltage_mv / 1000).toFixed(2)} V`;

                            // Update the status with both the toggle state and the energy data
                            const plugName = this.properties.selectedPlugNames[this.properties.selectedPlugIds.indexOf(plugId)];
                            const stateMessage = `Plug ${plugName} is ${toggle ? "On" : "Off"}`;
                            this.updateStatus(`${stateMessage} | ${formattedEnergyData}`);

                            // Update the internal onState
                            this.onState = toggle;
                            this.updateOnOffIndicator();

                            // Update the On/Off widget if it exists
                            if (this.onOffWidget) {
                                this.onOffWidget.value = this.onState ? "On" : "Off";
                            }
                        } else {
                            // Handle case where energyData is undefined
                            this.updateStatus(`Plug ${plugId} is ${toggle ? "On" : "Off"}, but energy data is unavailable.`);
                        }
                    } catch (error) {
                        // Already handled in fetchPlugEnergyData, but can add additional handling here if needed
                        console.warn(`KasaPlugControlNode - Failed to fetch energy data after turning ${action} Plug ID ${plugId}.`);
                    }
                })
                .catch(error => {
                    console.error(`KasaPlugControlNode - Error turning ${action} Plug ID ${plugId}:`, error);
                    this.updateStatus(`Error turning ${action} Plug ${plugId}`);
                });
        });
    }

    /**
     * Executes the node's main functionality.
     * Triggered by LiteGraph.
     */
    onExecute() {
        let toggle = this.getInputData(0); // "Trigger" input

        // If no plugs are selected, display a message and skip execution
        if (this.properties.selectedPlugIds.length === 0) {
            this.updateStatus("No plug selected. Please choose a plug.");
            this.setDirtyCanvas(true);
            return; // Skip the rest of the execution
        }

        // Only send commands after the initial load is complete
        if (this.initialLoad) {
            this.initialLoad = false; // Reset the flag after the first execution
            return; // Skip execution on load
        }

        // Handle Toggle Input only if toggle is explicitly true or false
        if (typeof toggle === 'boolean') {
            this.handleToggleInput(toggle);
        }

        // Emit Plug Info Downstream
        const plugData = {
            plugs: this.properties.selectedPlugIds.map(id => ({
                plug_id: id,
                name: this.properties.selectedPlugNames[this.properties.selectedPlugIds.indexOf(id)],
                status: this.onState ? "On" : "Off"
            })),
            status: this.properties.status
        };

        this.setOutputData(0, plugData);
    }

    /**
     * Serializes the node's state for saving.
     * @returns {object} Serialized data.
     */
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        data.lastToggleState = this.lastToggleState;
        data.onState = this.onState;
        data.boxcolor = this.boxcolor;
        return data;
    }

    /**
     * Configures the node from serialized data.
     * @param {object} data Serialized data.
     */
    async configure(data) { // Made async to handle async operations
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.lastToggleState = (data.lastToggleState !== undefined) ? data.lastToggleState : null;

        // Set a flag to restore plug selectors after devices are ready
        this.needsPlugSelectorsRestore = true;

        // **Restore Indicators from Serialized Data**
        this.onState = (data.onState !== undefined) ? data.onState : false;
        this.boxcolor = data.boxcolor || "#000000";

        // Restore status widget value
        if (this.statusWidget) {
            this.statusWidget.value = this.properties.status || "No action yet";
        }

        // Restore energy data map
        if (this.properties.selectedPlugIds && this.properties.selectedPlugIds.length > 0) {
            for (let plugId of this.properties.selectedPlugIds) {
                const plug = this.plugs.find(plug => plug.deviceId === plugId);
                if (plug) {
                    const plugName = plug.alias || plug.host;
                    const index = this.properties.selectedPlugIds.indexOf(plugId);
                    const plugSelector = this.addWidget(
                        "combo",
                        `Select Plug ${index + 1}`,
                        plugName,
                        (value) => {
                            this.onPlugSelected(value, index);
                        },
                        {
                            values: ["Select Plug", ...this.getPlugOptions()],
                            width: this.size[0] - 20
                        }
                    );
                    this.plugSelectors.push(plugSelector);

                    // **Fetch and store energy data for each plug**
                    try {
                        const energyData = await this.fetchPlugEnergyData(plugId);
                        if (energyData) {
                            this.energyDataMap.set(plugId, energyData.total_wh);
                        }
                    } catch (error) {
                        console.warn(`KasaPlugControlNode - Unable to fetch energy data for Plug ID ${plugId} during configuration.`);
                    }
                }
            }
        }

        // Update total energy after restoring
        this.updateTotalEnergy();

        // Update the On/Off widget if it exists
        if (this.onOffWidget) {
            this.onOffWidget.value = this.onState ? "On" : "Off";
        }

        console.log("KasaPlugControlNode - Configured with properties:", this.properties);
        this.setDirtyCanvas(true);
    }

    /**
     * Clean up timers when the node is removed.
     */
    onRemoved() {
        if (this.toggleDebounceTimer) {
            clearTimeout(this.toggleDebounceTimer);
        }
        if (this.updateTotalEnergyDebounce) {
            clearTimeout(this.updateTotalEnergyDebounce);
        }
    }

    /**
     * Updates the node's status.
     * @param {string} message - Status message.
     */
    updateStatus(message) {
        if (message) {
            this.properties.status = message;
        } else {
            this.properties.status = "No action yet";
        }

        if (this.statusWidget) {  // Ensure statusWidget exists
            this.statusWidget.value = this.properties.status;
        }
        
        this.setDirtyCanvas(true);
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
     * Draws indicators on the node's foreground.
     * @param {CanvasRenderingContext2D} ctx - The rendering context.
     */
    onDrawForeground(ctx) {
        if (super.onDrawForeground) {
            super.onDrawForeground(ctx);
        }

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

/**
 * **Helper Methods Added:**
 * 
 * - `calculateTotalEnergy`: Calculates the sum of energy from all selected plugs.
 * - `updateTotalEnergy`: Updates the "Total Energy" widget with the aggregated value, using debounce.
 * - `removePlugEnergyData`: Removes energy data for a specific plug and updates the total.
 * 
 * **Modifications Made:**
 * 
 * - Added `energyDataMap` to track energy data for each plug.
 * - Updated `fetchPlugEnergyData` to store energy data and update the total.
 * - Modified `onPlugSelected` and `onRemovePlug` to manage `energyDataMap`.
 * - Updated `handleStateChange` to handle energy data updates.
 * - Modified `configure` and `onAdded` methods to ensure energy data is initialized correctly.
 * - Implemented debounce in `updateTotalEnergy` to optimize performance.
 */

// Register the node with LiteGraph under the "Power" category
LiteGraph.registerNodeType("Power/KasaPlugControlNode", KasaPlugControlNode);
console.log("KasaPlugControlNode - Registered successfully under 'Power' category.");

// Attach the node class to LiteGraph namespace to prevent re-registration
LiteGraph.KasaPlugControlNode = KasaPlugControlNode;
