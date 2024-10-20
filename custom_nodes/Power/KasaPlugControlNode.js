// File: KasaPlugControlNode.js

class KasaPlugControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Kasa Plug Control";
        this.size = [200, 150];

        // Internal state
        this.plugs = [];
        this.initialLoad = true;
        this.deviceManagerReady = false;

        // Define properties
        this.properties = {
            selectedPlugIds: [],
            selectedPlugNames: [],
            status: "No action yet"
        };

        // Define inputs and outputs
        this.addInput("Trigger", "boolean"); // Input to toggle plug On/Off
        this.addOutput("Plug Info", "plug_info"); // Output plug info
        this.addOutput("Energy Data", "energy_data"); // Output energy data

        // Initialize widgets
        this.setupWidgets();

        // State tracking
        this.lastToggleState = null;

        // Bind methods
        this.onAddPlug = this.onAddPlug.bind(this);
        this.onRemovePlug = this.onRemovePlug.bind(this);
        this.onPlugSelected = this.onPlugSelected.bind(this);
        this.fetchPlugs = this.fetchPlugs.bind(this);
        this.onPlugsReady = this.onPlugsReady.bind(this);
        this.onRefreshPlugs = this.onRefreshPlugs.bind(this);

        // Flag to indicate that plug selectors need to be restored
        this.needsPlugSelectorsRestore = false;

        // **Properties for Indicators**
        this.boxcolor = "#000000"; // Default color (black)
        this.onState = false;       // Indicates if the plugs are On or Off

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

        // Status display (readonly text widget) bound to 'status' property
        this.statusWidget = this.addWidget(
            "text",
            "Status",
            this.properties.status,
            null,
            {
                property: "status",
                readonly: true,
                width: this.size[0] - 20
            }
        );

        console.log("KasaPlugControlNode - Widgets set up.");
    }

    /**
     * Called when the node is added to the graph.
     * Initiates plug fetching.
     */
    onAdded() {
        this.fetchPlugs();
    }

    /**
     * Fetches Kasa smart plugs asynchronously.
     */
    async fetchPlugs() {
        console.log("KasaPlugControlNode - Fetching Kasa smart plugs...");
        try {
            const plugs = await window.KasaDeviceManager.fetchPlugs();
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
                        this.size[1] = 200 + (this.plugSelectors.length * 50);
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
            return;
        }

        // Limit the number of selectable plugs if desired
        const MAX_PLUGS = 10;
        if (this.plugSelectors.length >= MAX_PLUGS) {
            console.warn(`KasaPlugControlNode - Maximum of ${MAX_PLUGS} plugs reached.`);
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
        this.size[1] = 200 + (this.plugSelectors.length * 50);
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
            return;
        }

        const plugSelector = this.plugSelectors.pop(); // Remove the last selector reference

        // Remove the widget from the widgets array
        const index = this.widgets.indexOf(plugSelector);
        if (index > -1) {
            this.widgets.splice(index, 1);
        }

        // Remove the last selected plug from the properties arrays
        this.properties.selectedPlugIds.pop();
        this.properties.selectedPlugNames.pop();

        // Adjust node size
        this.size[0] = Math.max(this.size[0], 400);
        this.size[1] = 200 + (this.plugSelectors.length * 50);
        this.setSize(this.size);

        // Update the canvas
        this.setDirtyCanvas(true, true);

        console.log(`KasaPlugControlNode - Removed plug selector ${this.plugSelectors.length + 1}.`);
    }

    /**
     * Callback when a plug is selected from a dropdown.
     */
    onPlugSelected(value, index) {
        console.log(`KasaPlugControlNode - onPlugSelected called with value: ${value} at index: ${index}`);

        if (value === "Select Plug" || value === "No Kasa Plugs Found") {
            // Remove the plug from selected lists if deselected or no plugs found
            this.properties.selectedPlugIds.splice(index, 1);
            this.properties.selectedPlugNames.splice(index, 1);
            this.updateStatus(); // Update status as selection changed
            return;
        }

        // Find the plug based on the selected name
        const plug = this.plugs.find(plug => plug.alias === value || plug.host === value);
        if (plug) {
            this.properties.selectedPlugIds[index] = plug.deviceId;
            this.properties.selectedPlugNames[index] = plug.alias || plug.host;

            console.log(`KasaPlugControlNode - Selected plug at index ${index}: ${plug.alias || plug.host}`);

            // **Fetch Current Energy Data of the Selected Plug**
            this.fetchPlugEnergyData(plug.deviceId);
        } else {
            console.error("KasaPlugControlNode - Unable to find plug.");
            this.properties.selectedPlugIds.splice(index, 1);
            this.properties.selectedPlugNames.splice(index, 1);
            this.updateStatus(); // Update status as selection changed
        }
    }

    /**
     * Fetches the current energy data of a selected plug.
     * @param {string} plugId - The ID of the plug to fetch.
     */
    async fetchPlugEnergyData(plugId) {
        try {
            const energyData = await window.KasaDeviceManager.getPlugEnergyUsage(plugId);
            console.log(`KasaPlugControlNode - Fetched energy data for Plug ID ${plugId}:`, energyData);

            // Update energy data in the state store or directly emit it
            this.setOutputData(1, { deviceId: plugId, energy: energyData });

            // Optionally, update status
            const plugName = this.properties.selectedPlugNames[this.properties.selectedPlugIds.indexOf(plugId)];
            this.properties.status = `Plug ${plugName}: ${energyData.power} W`;
            this.statusWidget.value = this.properties.status;
            this.setDirtyCanvas(true);
        } catch (error) {
            console.error(`KasaPlugControlNode - Error fetching energy data for Plug ID ${plugId}:`, error);
        }
    }

    /**
     * Handles incoming Toggle input for On/Off commands.
     * @param {boolean} toggle - Toggle signal.
     */
    handleToggleInput(toggle) {
        // Only process if a plug is selected
        if (this.properties.selectedPlugIds.length === 0) {
            console.warn("KasaPlugControlNode - No plugs selected. Cannot toggle state.");
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
            if (toggle) {
                window.KasaDeviceManager.turnOnPlug(plugId)
                    .then(() => {
                        console.log(`KasaPlugControlNode - Successfully turned On Plug ID ${plugId}.`);
                        this.updateStatus(`Plug ${plugId} turned On`);
                        // Fetch and update energy data after turning On
                        this.fetchPlugEnergyData(plugId);
                    })
                    .catch(error => {
                        console.error(`KasaPlugControlNode - Error turning On Plug ID ${plugId}:`, error);
                    });
            } else {
                window.KasaDeviceManager.turnOffPlug(plugId)
                    .then(() => {
                        console.log(`KasaPlugControlNode - Successfully turned Off Plug ID ${plugId}.`);
                        this.updateStatus(`Plug ${plugId} turned Off`);
                        // Fetch and update energy data after turning Off
                        this.fetchPlugEnergyData(plugId);
                    })
                    .catch(error => {
                        console.log(`KasaPlugControlNode - Plug ${plugId} already Off or couldn't be turned Off:`, error.message);
                        // Attempt to fetch state regardless of the outcome
                        this.fetchPlugEnergyData(plugId);
                    });
            }
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
            this.properties.status = "No plug selected. Please choose a plug.";
            this.statusWidget.value = this.properties.status;
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

        // Only process toggle if it has changed
        if (toggle !== this.lastToggleInput) {
            this.lastToggleInput = toggle;
            if (typeof toggle === 'boolean') {
                this.handleToggleInput(toggle);
            }
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
    configure(data) {
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

        // Update indicators based on restored data
        this.updateOnOffIndicator();
        if (this.properties.selectedPlugIds.length > 0) {
            // Fetch and update the energy data of the first selected plug
            this.fetchPlugEnergyData(this.properties.selectedPlugIds[0]);
        }

        console.log("KasaPlugControlNode - Configured with properties:", this.properties);
        this.setDirtyCanvas(true);
    }

    /**
     * Clean up timers when the node is removed.
     */
    onRemoved() {
        // Implement if you have any timers or listeners to clean up
    }

    /**
     * Updates the node's status.
     * @param {string} message - Status message.
     */
    updateStatus(message) {
        this.properties.status = message;
        this.statusWidget.value = this.properties.status;
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

// Register the node with LiteGraph under the "Power" category
LiteGraph.registerNodeType("Power/KasaPlugControlNode", KasaPlugControlNode);
console.log("KasaPlugControlNode - Registered successfully under 'Power' category.");

// Attach the node class to LiteGraph namespace to prevent re-registration
LiteGraph.KasaPlugControlNode = KasaPlugControlNode;
