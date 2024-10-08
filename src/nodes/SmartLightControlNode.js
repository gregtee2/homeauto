// File: src/nodes/SmartLightControlNode.js

class SmartLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Smart Light Control";
        this.size = [300, 250]; // Adjusted size for widgets

        // Define properties with default values
        this.properties = {
            device_ids: [], // Array of selected device IDs
            action: "turnOn", // Options: turnOn, turnOff, setColor, setBrightness
            hsv: { hue: 0.10, saturation: 0.17, brightness: 128 },
            brightness: 128,
            statusText: "Idle"
        };

        // Define inputs and outputs
        this.addInput("Trigger", "trigger"); // Trigger input to execute action
        this.addInput("HSV Info", "hsv_info"); // Input from HSVControlNode
        this.addOutput("Status", "status");  // Output to emit current status

        // Add widgets for user interaction
        // Using the custom MultiComboWidget for device selection
        this.addWidget("combo/multi_combo", "Devices", [], this.onDeviceInput.bind(this), { values: [] });

        this.addWidget("combo", "Action", this.properties.action, this.onActionSelected.bind(this), { values: ["turnOn", "turnOff", "setColor", "setBrightness"] });
        this.addWidget("hsv", "Color", this.properties.hsv, this.onColorChanged.bind(this));
        this.addWidget("slider", "Brightness", this.properties.brightness, this.onBrightnessChanged.bind(this), { min: 0, max: 254 });

        // Add a status display widget bound to 'statusText' property
        this.addWidget("text", "Status", this.properties.statusText, () => {});

        // Internal variables for managing state
        this.currentDeviceIds = [];

        // Fetch and populate devices when DeviceManager is ready
        this.fetchAndPopulateDevices();

        console.log("SmartLightControlNode - Initialized.");
    }

    /**
     * Fetches devices from DeviceManager and populates the Devices widget when ready.
     */
    fetchAndPopulateDevices() {
        // Ensure that DeviceManager is available
        if (!window.deviceManager) {
            console.error("SmartLightControlNode - DeviceManager not available.");
            this.widgets[0].value = "DeviceManager not initialized";
            this.widgets[0].disabled = true;
            this.properties.statusText = "DeviceManager not initialized";
            this.setDirtyCanvas(true);
            return;
        }

        // Register callback to populate devices when DeviceManager is ready
        window.deviceManager.onReady(() => {
            const devices = window.deviceManager.getAllHueDevices();
            console.log(`SmartLightControlNode - Fetching devices. Total found: ${devices.length}`);
            if (devices.length === 0) {
                console.error("SmartLightControlNode - No Hue devices found.");
                this.widgets[0].value = "No Devices Found";
                this.widgets[0].disabled = true;
                this.properties.statusText = "No Devices Found";
                this.setDirtyCanvas(true);
                return;
            }

            // Populate the widget's values with device information
            const widget = this.widgets[0];
            widget.values = devices.map(device => ({ id: device.light_id, name: device.name }));
            widget.selected = this.properties.device_ids.slice(); // Initialize with existing selections
            widget.value = this.properties.device_ids.join(", ");

            // Update tooltip with available devices
            widget.tooltip = devices.map(device => `${device.light_id}: ${device.name}`).join(", ");

            // Attach onChange handler
            widget.onChange = this.onDeviceSelectionChanged.bind(this);

            this.setDirtyCanvas(true);

            console.log("SmartLightControlNode - Devices fetched and widget populated.");
        });
    }

    /**
     * Handles device selection changes from the MultiComboWidget.
     * @param {string} selectedValues - Comma-separated string of selected device IDs.
     */
    onDeviceInput(selectedValues) {
        console.log(`SmartLightControlNode - Devices selected: ${selectedValues}`);
        // Parse device_ids from selectedValues
        const device_ids = selectedValues
            .split(",")
            .map(id => id.trim())
            .filter(id => id !== "");

        // Validate device IDs
        const valid_device_ids = device_ids.filter(id => {
            const device = window.deviceManager.getDevice(id);
            if (!device) {
                console.warn(`SmartLightControlNode - Invalid device ID: ${id}`);
                return false;
            }
            return true;
        });

        this.properties.device_ids = valid_device_ids;
        this.currentDeviceIds = valid_device_ids;

        // Unsubscribe from previous device state updates
        if (this.previousDeviceIds && this.previousDeviceIds.length > 0) {
            this.previousDeviceIds.forEach(id => {
                window.stateStore.unsubscribe(id, this.onStateUpdate);
            });
            console.log(`SmartLightControlNode - Unsubscribed from previous device IDs: ${this.previousDeviceIds.join(", ")}`);
        }

        // Subscribe to new device state updates
        if (valid_device_ids.length > 0) {
            valid_device_ids.forEach(id => {
                window.stateStore.subscribe(id, this.onStateUpdate);
            });
            console.log(`SmartLightControlNode - Subscribed to new device IDs: ${valid_device_ids.join(", ")}`);
        }

        this.previousDeviceIds = valid_device_ids;

        if (valid_device_ids.length === 0) {
            this.properties.statusText = "No valid devices selected";
        } else {
            this.properties.statusText = "Devices Selected";
        }
        this.setDirtyCanvas(true);
    }

    /**
     * Handles changes to device selection from the widget's onChange event.
     * @param {string} selectedValues - Comma-separated string of selected device IDs.
     */
    onDeviceSelectionChanged(selectedValues) {
        this.onDeviceInput(selectedValues);
    }

    /**
     * Handles action selection changes.
     * @param {string} selectedAction - Selected action.
     */
    onActionSelected(selectedAction) {
        console.log(`SmartLightControlNode - Action selected: ${selectedAction}`);
        this.properties.action = selectedAction;
        this.setDirtyCanvas(true);
    }

    /**
     * Handles HSV color changes.
     * @param {object} hsv - HSV color object.
     */
    onColorChanged(hsv) {
        console.log(`SmartLightControlNode - HSV changed to: ${JSON.stringify(hsv)}`);
        this.properties.hsv = hsv;
        this.setDirtyCanvas(true);
    }

    /**
     * Handles brightness slider changes.
     * @param {number} brightness - Brightness level.
     */
    onBrightnessChanged(brightness) {
        console.log(`SmartLightControlNode - Brightness changed to: ${brightness}`);
        this.properties.brightness = brightness;
        this.setDirtyCanvas(true);
    }

    /**
     * Called when the node is executed via a trigger.
     */
    async onExecute() {
        console.log("SmartLightControlNode - Execution started.");
        // Handle HSV Info input if available
        const hsvInput = this.getInputData(1); // Assuming 'HSV Info' is the second input
        if (hsvInput) {
            console.log("SmartLightControlNode - Received HSV Info from HSVControlNode.");
            this.properties.hsv = hsvInput;
            this.setDirtyCanvas(true);
        }

        if (this.properties.device_ids.length === 0) {
            console.error("SmartLightControlNode - No device selected.");
            this.properties.statusText = "Error: No device selected";
            this.setDirtyCanvas(true);
            return;
        }

        // Fetch the devices from DeviceManager
        const devices = this.properties.device_ids.map(id => window.deviceManager.getDevice(id)).filter(device => device !== null);

        if (devices.length === 0) {
            console.error("SmartLightControlNode - No valid devices found.");
            this.properties.statusText = "Error: No valid devices found";
            this.setDirtyCanvas(true);
            return;
        }

        // Execute the selected action on each device sequentially to prevent overloading the Hue Bridge
        for (const device of devices) {
            try {
                switch (this.properties.action) {
                    case 'turnOn':
                        console.log(`SmartLightControlNode - Turning on device ID: ${device.light_id}`);
                        await device.turnOn();
                        this.properties.statusText = "Turning On";
                        break;
                    case 'turnOff':
                        console.log(`SmartLightControlNode - Turning off device ID: ${device.light_id}`);
                        await device.turnOff();
                        this.properties.statusText = "Turning Off";
                        break;
                    case 'setColor':
                        console.log(`SmartLightControlNode - Setting color for device ID: ${device.light_id}`);
                        await device.setColor(this.properties.hsv);
                        this.properties.statusText = "Setting Color";
                        break;
                    case 'setBrightness':
                        console.log(`SmartLightControlNode - Setting brightness for device ID: ${device.light_id}`);
                        await device.setBrightness(this.properties.brightness);
                        this.properties.statusText = "Setting Brightness";
                        break;
                    default:
                        console.error(`SmartLightControlNode - Unknown action: ${this.properties.action}`);
                        this.properties.statusText = "Error: Unknown action";
                }
            } catch (error) {
                console.error(`SmartLightControlNode - Action execution failed on device ID ${device.light_id}:`, error);
                this.properties.statusText = `Error: ${error.message}`;
            }
        }

        // Update the status display
        this.setDirtyCanvas(true);
        console.log("SmartLightControlNode - Execution finished.");

        // Optionally, emit the current state as output
        const allStates = {};
        this.properties.device_ids.forEach(id => {
            allStates[id] = window.stateStore.getState(id);
        });
        this.setOutputData(0, allStates);
    }

    /**
     * Updates the node's status based on the device's state.
     * @param {object} newState - The new state of the device.
     */
    updateStatus(newState) {
        console.log(`SmartLightControlNode - Updating status for device ID: ${newState.id}`);
        if (newState.on) {
            this.properties.statusText = "On";
        } else {
            this.properties.statusText = "Off";
        }

        if (this.properties.action === 'setColor' && newState.xy !== undefined && newState.bri !== undefined) {
            const rgb = this.convertXYtoRGB(newState.xy[0], newState.xy[1], newState.bri);
            this.properties.statusText = `Color: (${rgb.join(', ')})`;
        }

        if (this.properties.action === 'setBrightness' && newState.bri !== undefined) {
            this.properties.statusText = `Brightness: ${newState.bri}`;
        }

        // Update the status widget
        this.setDirtyCanvas(true);
        console.log(`SmartLightControlNode - Status updated: ${this.properties.statusText}`);
    }

    /**
     * Cleans up subscriptions when the node is removed from the graph.
     */
    onRemoved() {
        console.log("SmartLightControlNode - Removed from graph. Cleaning up subscriptions.");
        if (this.properties.device_ids.length > 0 && this.onStateUpdate) {
            this.properties.device_ids.forEach(id => {
                window.stateStore.unsubscribe(id, this.onStateUpdate);
            });
            console.log(`SmartLightControlNode - Unsubscribed from device IDs: ${this.properties.device_ids}`);
        }
    }

    /**
     * Utility function to convert XY to RGB.
     * @param {number} x 
     * @param {number} y 
     * @param {number} bri 
     * @returns {Array} [r, g, b]
     */
    convertXYtoRGB(x, y, bri) {
        let z = 1.0 - x - y;
        let Y = bri / 254.0;
        let X = (Y / y) * x;
        let Z = (Y / y) * z;

        // Convert to RGB using the CIE color space
        let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
        let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
        let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

        // Apply gamma correction
        const applyGamma = (color) => color <= 0.0031308 ? 12.92 * color : 1.055 * Math.pow(color, 1.0 / 2.4) - 0.055;
        r = applyGamma(r);
        g = applyGamma(g);
        b = applyGamma(b);

        // Clamp and convert to 0-255
        r = Math.round(Math.max(0, Math.min(1, r)) * 255);
        g = Math.round(Math.max(0, Math.min(1, g)) * 255);
        b = Math.round(Math.max(0, Math.min(1, b)) * 255);

        return [r, g, b];
    }

    /**
     * Converts RGB values to Hex.
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @returns {string} Hex color string
     */
    convertRGBtoHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    /**
     * Serializes the node's state.
     */
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    /**
     * Configures the node from serialized data.
     * @param {object} data 
     */
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.title = `Smart Light - ${this.properties.device_ids.length > 0 ? this.properties.device_ids.join(", ") : "Select"}`;
        if (!this.lightOptions) {
            this.fetchAndPopulateDevices();
        }
    }
}

// Register the node with LiteGraph under the "SmartLights" category for better organization
LiteGraph.registerNodeType("SmartLights/SmartLightControlNode", SmartLightControlNode);
console.log("SmartLightControlNode - Registered successfully under 'SmartLights' category.");
