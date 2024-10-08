//GTP 01 mini code unified data approach
class ExecuteEventNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event Node";
        this.size = [300, 150];
        this.properties = {
            enable: true,
            commandCooldown: 1000 // in milliseconds
        };

        // Inputs
        this.addInput("Event Data", "object"); // Input0

        // Outputs
        this.addOutput("API Call Count", "number"); // Output0

        // Internal state
        this.apiRequestCount = 0;
        this.lastCommandTime = 0;
        this.DEBUG = true; // Enable debugging

        // Initialize logging throttling variables
        this.lastLogTime = 0;
        this.logInterval = 5000; // 5 seconds throttle for logs
    }

    onExecute() {
        // Check if the node is enabled before proceeding
        if (!this.properties.enable) {
            this.logDebug("Node is disabled. Ignoring event.");
            return;
        }

        const eventData = this.getInputData(0); // Retrieve data from "Event Data" input

        // Add this line for debugging
        console.log("ExecuteEventNode - Received event data:", eventData);

        if (!eventData || typeof eventData.trigger_event === 'undefined' || !Array.isArray(eventData.devices) || eventData.devices.length === 0) {
            this.logError("Invalid or empty event data received.");
            return;
        }

        // Iterate through each device and process accordingly
        eventData.devices.forEach(device => {
            if ((device.device_type === "hue" && device.control_details && typeof device.state === 'boolean') ||
                (device.device_type === "govee" && device.control_details && typeof device.state === 'boolean')) {
                this.logDebug(`Processing device ${device.device_id} (${device.device_type}):`, device.control_details);
                this.sendCommandToLight(device, device.state, device.control_details);
            } else {
                this.logError("Missing required properties in device data:", device);
            }
        });

        // Update the API Call Count output
        this.setOutputData(0, this.apiRequestCount);
    }

    async sendCommandToLight(device, state, controlDetails) {
        if (!this.canSendCommand()) return;

        try {
            if (device.device_type === "hue") {
                // Process Hue device
                await this.sendHueCommand(device, state, controlDetails);
            }
            else if (device.device_type === "govee") {
                // Process Govee device
                await this.sendGoveeCommand(device, state, controlDetails);
            }
            else {
                this.logError(`Unsupported device_type '${device.device_type}' for device.`);
            }
        } catch (error) {
            this.logError(`Error sending command to device ${device.device_id}:`, error);
        }
    }

    async sendHueCommand(device, state, controlDetails) {
        // Example Hue API call
        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${device.device_id}/state`;
        const payload = {
            on: state,
            bri: controlDetails.hsv.brightness,
            hue: controlDetails.hsv.hue * 65535, // Convert to Hue's scale
            sat: controlDetails.hsv.saturation * 254 // Convert to Hue's scale
        };

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.apiRequestCount += 1;
            this.logDebug(`Hue device ${device.device_id} updated successfully.`);
        } catch (error) {
            this.logError(`Error updating Hue light ${device.device_id}:`, error);
            throw error; // Re-throw to be caught in sendCommandToLight
        }
    }

    async sendGoveeCommand(device, state, controlDetails) {
        // Example Govee API call
        const url = `https://developer-api.govee.com/v1/devices/control`;
        const payload = {
            device: device.device_id,
            model: device.model,
            cmd: {
                name: "turn",
                value: state ? "on" : "off"
            }
        };

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': device.api_key
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.apiRequestCount += 1;
            this.logDebug(`Govee device ${device.device_id} updated successfully.`);
        } catch (error) {
            this.logError(`Error updating Govee device ${device.device_id}:`, error);
            throw error; // Re-throw to be caught in sendCommandToLight
        }
    }

    canSendCommand() {
        const currentTime = Date.now();
        if ((currentTime - this.lastCommandTime) < this.properties.commandCooldown) {
            this.logDebug("Command cooldown active. Skipping command.");
            return false;
        }
        this.lastCommandTime = currentTime;
        return true;
    }

    logDebug(message, ...optionalParams) {
        if (this.DEBUG) {
            const currentTime = Date.now();
            if ((currentTime - this.lastLogTime) > this.logInterval) { // Throttle logs
                console.log(`[ExecuteEventNode]: ${message}`, ...optionalParams);
                this.lastLogTime = currentTime;
            }
        }
    }

    logError(message, ...optionalParams) {
        console.error(`[ExecuteEventNode]: ${message}`, ...optionalParams);
    }

    serialize() {
        const data = super.serialize();
        data.properties = { ...this.properties };  // Clone properties
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = { ...data.properties };  // Clone properties
    }
}

// Register the node
LiteGraph.registerNodeType("Device/ExecuteEventNode", ExecuteEventNode);









//GTP 01 mini code prior to unified data approach
/*class ExecuteEventNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event";
        this.size = [400, 700];
        this.properties = {
            state: true,
            enable: false,  // Initially disabled
            commandCooldown: 1000 // 1 second cooldown
        };

        this.DEBUG = true;

        // Inputs and Outputs
        this.addInput("On Event", LiteGraph.ACTION);
        this.addOutput("API Call Count", "number");

        // Widget to control enabling/disabling the node
        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
            this.logDebug(`ExecuteEventNode: Enabled set to ${value}`);
            this.setDirtyCanvas(true);  // Force a re-render of the graph to update
        });

        // Slider for adjusting cooldown
        this.addWidget("slider", "Command Cooldown (ms)", this.properties.commandCooldown, (value) => {
            this.properties.commandCooldown = value;
            this.commandCooldown = value;
            this.logDebug(`ExecuteEventNode: Command cooldown set to ${value} ms`);
        }, { min: 500, max: 5000 });

        // Initialize other properties
        this.lastCommandTimestamp = 0;
        this.commandCooldown = this.properties.commandCooldown;
        this.apiRequestCount = 0;

        // Event listener
        this.eventListener = (data) => this.onAction(null, data);
        this.isEventBusAvailable = this.checkEventBusAvailability();
    }

    // Utility function to check if EventBus is available
    checkEventBusAvailability() {
        if (window.EventBus && typeof window.EventBus.subscribe === 'function' && typeof window.EventBus.unsubscribe === 'function') {
            return true;
        }
        this.logError("ExecuteEventNode: EventBus is not available.");
        return false;
    }

    // Subscribe when added to the graph
    onAdded() {
        if (this.isEventBusAvailable) {
            window.EventBus.subscribe("light_settings", this.eventListener);
            this.logDebug("ExecuteEventNode: Subscribed to 'light_settings'");
        }
    }

    // Unsubscribe when removed from the graph
    onRemoved() {
        if (this.isEventBusAvailable) {
            window.EventBus.unsubscribe("light_settings", this.eventListener);
            this.logDebug("ExecuteEventNode: Unsubscribed from 'light_settings'");
        }
    }

    // Cooldown logic to prevent spamming the APIs
    canSendCommand() {
        const currentTime = Date.now();
        if (currentTime - this.lastCommandTimestamp < this.commandCooldown) {
            this.logDebug("ExecuteEventNode: Command cooldown active. Skipping command.");
            return false;
        }
        this.lastCommandTimestamp = currentTime;
        return true;
    }

    // Send command to the light with retry logic
    async sendCommandToLight(device, state, hsvOrColor, retries = 3) {
        if (!this.canSendCommand()) return;

        if (device.device_type === "hue") {
            // Process Hue device
            await this.sendHueCommand(device, state, hsvOrColor, retries);
        }
        else if (device.device_type === "govee") {
            // Process Govee device
            await this.sendGoveeCommand(device, state, hsvOrColor, retries);
        }
        else {
            this.logError(`ExecuteEventNode: Unsupported device_type '${device.device_type}' for device.`);
        }
    }

    // Send command to Philips Hue lights
    async sendHueCommand(device, state, hsv, retries = 3) {
        const { light_id, bridge_ip, api_key } = device;
        const url = `http://${bridge_ip}/api/${api_key}/lights/${light_id}/state`;

        const bodyData = {
            hue: Math.round(hsv.hue * 65535),         // Convert hue to the 0-65535 range
            sat: Math.round(hsv.saturation * 254),    // Convert saturation to 0-254 range
            bri: Math.round(hsv.brightness),          // Use brightness in 0-254 range
            on: state
        };

        this.logDebug(`ExecuteEventNode: Sending Hue command to light ${light_id}:`, bodyData);
        this.apiRequestCount++;
        this.setOutputData(0, this.apiRequestCount);  // Update the API Call Count output

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                this.logDebug(`ExecuteEventNode: Hue light ${light_id} successfully updated with HSV data:`, bodyData);
            } else {
                const errorData = await response.json();
                this.logError(`ExecuteEventNode: Failed to update Hue light ${light_id}.`, errorData);
                if (retries > 0) {
                    this.logDebug(`ExecuteEventNode: Retrying Hue light ${light_id} (${retries} attempts left)`);
                    await this.delay(1000); // Wait 1 second before retry
                    this.sendCommandToLight(device, state, hsv, retries - 1);
                }
            }
        } catch (error) {
            this.logError(`ExecuteEventNode: Error updating Hue light ${light_id}:`, error);
            if (retries > 0) {
                this.logDebug(`ExecuteEventNode: Retrying Hue light ${light_id} (${retries} attempts left)`);
                await this.delay(1000); // Wait 1 second before retry
                this.sendCommandToLight(device, state, hsv, retries - 1);
            }
        }
    }

    // Send command to Govee lights
    async sendGoveeCommand(device, state, color, retries = 3) {
        const { device_id, model, control_type, api_key } = device;
        const url = `https://developer-api.govee.com/v1/devices/control`;

        // Construct the command payload based on control_type
        let bodyData = {
            device: device_id,
            model: model,
            cmd: {}
        };

        switch (control_type) {
            case "color":
                bodyData.cmd.name = "color";
                bodyData.cmd.value = `rgb(${color.r},${color.g},${color.b})`;
                break;
            case "brightness":
                bodyData.cmd.name = "brightness";
                bodyData.cmd.value = device.brightness;
                break;
            case "switch":
                bodyData.cmd.name = "turn";
                bodyData.cmd.value = state ? "on" : "off";
                break;
            // Add more control types as needed
            default:
                this.logError(`ExecuteEventNode: Unsupported control_type '${control_type}' for Govee device ${device_id}`);
                return;
        }

        const headers = {
            'Govee-API-Key': api_key,
            'Content-Type': 'application/json'
        };

        this.logDebug(`ExecuteEventNode: Sending Govee command to device ${device_id}:`, bodyData);
        this.apiRequestCount++;
        this.setOutputData(0, this.apiRequestCount);  // Update the API Call Count output

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(bodyData)
            });

            const responseData = await response.json();

            if (response.ok && responseData.status === "ok") {
                this.logDebug(`ExecuteEventNode: Successfully updated Govee device ${device_id}`);
            } else {
                this.logError(`ExecuteEventNode: Failed to update Govee device ${device_id}.`, responseData);
                if (retries > 0) {
                    this.logDebug(`ExecuteEventNode: Retrying Govee device ${device_id} (${retries} attempts left)`);
                    await this.delay(1000); // Wait 1 second before retry
                    this.sendCommandToLight(device, state, color, retries - 1);
                }
            }
        } catch (error) {
            this.logError(`ExecuteEventNode: Error updating Govee device ${device_id}:`, error);
            if (retries > 0) {
                this.logDebug(`ExecuteEventNode: Retrying Govee device ${device_id} (${retries} attempts left)`);
                await this.delay(1000); // Wait 1 second before retry
                this.sendCommandToLight(device, state, color, retries - 1);
            }
        }
    }

    // Utility method to create a delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Event processing when action is triggered
    onAction(action, param) {
        // Check if the node is enabled before proceeding
        if (!this.properties.enable) {
            this.logDebug("ExecuteEventNode: Node is disabled. Ignoring event.");
            return;
        }

        if (!param || !Array.isArray(param.devices)) {
            this.logError("ExecuteEventNode: Invalid event data received.");
            return;
        }

        param.devices.forEach(device => {
            if ((device.device_type === "hue" && device.hsv && typeof device.state === 'boolean') ||
                (device.device_type === "govee" && device.control_type && typeof device.state === 'boolean')) {
                this.logDebug(`ExecuteEventNode: Processing device ${device.device_type === "hue" ? device.light_id : device.device_id}:`, device.device_type === "hue" ? device.hsv : device.color);
                this.sendCommandToLight(device, device.state, device.hsv || device.color);
            } else {
                this.logError("ExecuteEventNode: Missing required properties in device data:", device);
            }
        });
    }

    // Logging functions for debugging and errors
    logDebug(message, ...optionalParams) {
        if (this.DEBUG) {
            console.log(message, ...optionalParams);
        }
    }

    logError(message, ...optionalParams) {
        console.error(message, ...optionalParams);
    }
}

// Register the node
LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEventNode);






//refactored code
/*class ExecuteEventNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event";
        this.size = [400, 650];
        this.properties = {
            state: true,
            enable: false,  // Initially disabled
            commandCooldown: 1000
        };

        this.DEBUG = true;

        // Inputs and Outputs
        this.addInput("On Event", LiteGraph.ACTION);
        this.addOutput("API Call Count", "number");

        // Widget to control enabling/disabling the node
        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
            this.logDebug(`ExecuteEventNode: Enabled set to ${value}`);
            this.setDirtyCanvas(true);  // Force a re-render of the graph to update
        });

        // Slider for adjusting cooldown
        this.addWidget("slider", "Command Cooldown (ms)", this.properties.commandCooldown, (value) => {
            this.properties.commandCooldown = value;
            this.commandCooldown = value;
            this.logDebug(`ExecuteEventNode: Command cooldown set to ${value} ms`);
        }, { min: 500, max: 5000 });

        // Initialize other properties
        this.lastCommandTimestamp = 0;
        this.commandCooldown = this.properties.commandCooldown;
        this.apiRequestCount = 0;

        // Event listener
        this.eventListener = (data) => this.onAction(null, data);
        this.isEventBusAvailable = this.checkEventBusAvailability();
    }

    // Utility function to check if EventBus is available
    checkEventBusAvailability() {
        if (window.EventBus && typeof window.EventBus.subscribe === 'function' && typeof window.EventBus.unsubscribe === 'function') {
            return true;
        }
        this.logError("ExecuteEventNode: EventBus is not available.");
        return false;
    }

    // Subscribe when added to the graph
    onAdded() {
        if (this.isEventBusAvailable) {
            window.EventBus.subscribe("light_settings", this.eventListener);
            this.logDebug("ExecuteEventNode: Subscribed to 'light_settings'");
        }
    }

    // Unsubscribe when removed from the graph
    onRemoved() {
        if (this.isEventBusAvailable) {
            window.EventBus.unsubscribe("light_settings", this.eventListener);
            this.logDebug("ExecuteEventNode: Unsubscribed from 'light_settings'");
        }
    }

    // Cooldown logic to prevent spamming the Hue Bridge
    canSendCommand() {
        const currentTime = Date.now();
        if (currentTime - this.lastCommandTimestamp < this.commandCooldown) {
            this.logDebug("ExecuteEventNode: Command cooldown active. Skipping command.");
            return false;
        }
        this.lastCommandTimestamp = currentTime;
        return true;
    }

    // Send command to the light with retry logic
    async sendCommandToLight(device, state, hsv, retries = 3) {
        if (!this.canSendCommand()) return;

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${device.light_id}/state`;
        const bodyData = {
            hue: Math.round(hsv.hue * 65535),
            sat: Math.round(hsv.saturation * 254),
            bri: Math.round(hsv.brightness < 1 ? 1 : hsv.brightness),  // Ensure brightness is at least 1
            on: state !== undefined ? state : true
        };

        this.logDebug("ExecuteEventNode: Sending updated bodyData to Hue Bridge:", bodyData);

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                this.logDebug(`ExecuteEventNode: Hue light ${device.light_id} successfully updated with HSV data:`, bodyData);
                this.apiRequestCount++;
                this.setOutputData(0, this.apiRequestCount);
            } else {
                const errorData = await response.json();
                this.logError("ExecuteEventNode: Failed to update the Hue light. Response status:", response.status, "Error:", errorData);
                if (retries > 0) {
                    this.logDebug(`Retrying... Attempts left: ${retries}`);
                    this.sendCommandToLight(device, state, hsv, retries - 1);
                }
            }
        } catch (error) {
            this.logError("ExecuteEventNode: Error sending command to Hue light:", error);
            if (retries > 0) {
                this.logDebug(`Retrying... Attempts left: ${retries}`);
                this.sendCommandToLight(device, state, hsv, retries - 1);
            }
        }
    }

    // Event processing when action is triggered
    onAction(action, param) {
        // Check if the node is enabled before proceeding
        if (!this.properties.enable) {
            this.logDebug("ExecuteEventNode: Node is disabled. Ignoring event.");
            return;
        }

        if (!param || !Array.isArray(param.devices)) {
            this.logError("ExecuteEventNode: Invalid event data received.");
            return;
        }

        param.devices.forEach(device => {
            if (device.hsv && typeof device.state === 'boolean') {
                this.logDebug(`ExecuteEventNode: Processing new HSV values for device ${device.light_id}:`, device.hsv);
                this.sendCommandToLight(device, device.state, device.hsv);
            } else {
                this.logError("ExecuteEventNode: Missing 'hsv' or 'state' in device data:", device);
            }
        });
    }

    // Logging functions for debugging and errors
    logDebug(message, ...optionalParams) {
        if (this.DEBUG) {
            console.log(message, ...optionalParams);
        }
    }

    logError(message, ...optionalParams) {
        console.error(message, ...optionalParams);
    }
}

// Register the node
LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEventNode);





//complete working code
/*class ExecuteEventNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event";
        this.size = [400, 650];
        this.properties = { state: true, enable: false }; // Ensure 'enable' is false by default

        // Adjusted inputs and outputs
        this.addInput("On Event", LiteGraph.ACTION);  // Input trigger
        this.addOutput("API Call Count", "number");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
            console.log(`ExecuteEventNode: Enabled set to ${value}`);
        });

        this.lastCommandTimestamp = 0; // Track the last time a command was sent
        this.commandCooldown = 1000;   // Cooldown time between requests in milliseconds
        this.apiRequestCount = 0;      // Count API requests

        // Define the event listener
        this.eventListener = (data) => {
            this.onAction(null, data);
        };

        // Subscribe to the EventBus when the node is added to the graph
        this.onAdded = () => {
            if (window.EventBus && typeof window.EventBus.subscribe === 'function') {
                window.EventBus.subscribe("light_settings", this.eventListener);
                console.log("ExecuteEventNode: Subscribed to 'light_settings'");
            } else {
                console.error("ExecuteEventNode: EventBus is not available.");
            }
        };

        // Unsubscribe from the EventBus when the node is removed from the graph
        this.onRemoved = () => {
            if (window.EventBus && typeof window.EventBus.unsubscribe === 'function') {
                window.EventBus.unsubscribe("light_settings", this.eventListener);
                console.log("ExecuteEventNode: Unsubscribed from 'light_settings'");
            }
        };
    }

    // Throttle requests to prevent flooding the Hue Bridge
    canSendCommand() {
        const currentTime = Date.now();
        if (currentTime - this.lastCommandTimestamp < this.commandCooldown) {
            console.log("ExecuteEventNode: Command cooldown active. Skipping command.");
            return false;
        }
        this.lastCommandTimestamp = currentTime; // Update the timestamp for the last command
        return true;
    }

    async sendCommandToLight(device, state, hsv) {
        // Always check if we can send a command
        if (!this.canSendCommand()) return;

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${device.light_id}/state`;

        // Build the command body
        const bodyData = {
            hue: Math.round(hsv.hue * 65535),         // Convert hue to the 0-65535 range
            sat: Math.round(hsv.saturation * 254),    // Convert saturation to 0-254 range
            bri: Math.round(hsv.brightness)           // Use brightness in 0-254 range
        };

        // Include the 'on' state based on the device's state
        if (state !== undefined) {
            bodyData.on = state;
        }

        // Ensure brightness is at least 1 (Hue API requirement)
        if (bodyData.bri < 1) bodyData.bri = 1;

        console.log("ExecuteEventNode: Sending updated bodyData to Hue Bridge:", bodyData);

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                console.log(`ExecuteEventNode: Hue light ${device.light_id} successfully updated with HSV data:`, bodyData);
                this.apiRequestCount++;
                this.setOutputData(0, this.apiRequestCount);  // Update the API Call Count output
            } else {
                const errorData = await response.json();
                console.error("ExecuteEventNode: Failed to update the Hue light. Response status:", response.status, "Error:", errorData);
            }
        } catch (error) {
            console.error("ExecuteEventNode: Error sending command to Hue light:", error);
        }
    }

    // Handle the action triggered by the EventBusHandlerNode
    onAction(action, param) {
        // Check if the node is enabled before processing
        if (!this.properties.enable) {
            console.log("ExecuteEventNode: Node is disabled. Ignoring event.");
            return;
        }

        const eventData = param;  // Renamed for clarity

        // Verify that eventData has 'devices' array
        if (!eventData || !Array.isArray(eventData.devices)) {
            console.error("ExecuteEventNode: Invalid event data received.");
            return;
        }

        eventData.devices.forEach(device => {
            if (device.hsv && typeof device.state === 'boolean') {  // Check for hsv and state
                console.log(`ExecuteEventNode: Processing new HSV values for device ${device.light_id}:`, device.hsv);
                this.sendCommandToLight(device, device.state, device.hsv);
            } else {
                console.log("ExecuteEventNode: Missing 'hsv' or 'state' in device data:", device);
            }
        });
    }
}

LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEventNode);*/






