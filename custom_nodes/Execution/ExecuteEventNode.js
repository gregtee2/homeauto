






//complete working code
class ExecuteEventNode extends LiteGraph.LGraphNode {
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

LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEventNode);






/*
//working code
class ExecuteEvent extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        // Adjusted inputs and outputs
        this.addInput("On Event", LiteGraph.ACTION);  // Input trigger
        this.addOutput("API Call Count", "number");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.lastCommandTimestamp = 0; // Track the last time a command was sent
        this.commandCooldown = 1000;   // Cooldown time between requests in milliseconds
        this.apiRequestCount = 0;      // Count API requests
    }

    // Throttle requests to prevent flooding the Hue Bridge
    canSendCommand() {
        const currentTime = Date.now();
        if (currentTime - this.lastCommandTimestamp < this.commandCooldown) {
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
            hue: Math.round(hsv.hue * 65535),   // Convert hue to the 0-65535 range
            sat: Math.round(hsv.saturation * 254),   // Convert saturation to 0-254 range
            bri: Math.round(hsv.brightness)    // Use brightness in 0-254 range
        };

        // Include the 'on' state only if it changed or it's true (to ensure light stays on)
        if (state !== undefined) {
            bodyData.on = state;
        }

        // Ensure brightness is at least 1 (Hue API requirement)
        if (bodyData.bri < 1) bodyData.bri = 1;

        console.log("Sending updated bodyData to Hue Bridge:", bodyData);

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                console.log(`Hue light ${device.light_id} successfully updated with HSV data:`, bodyData);
                this.apiRequestCount++;
                this.setOutputData(0, this.apiRequestCount);  // Update the API Call Count output
            } else {
                console.error("Failed to update the Hue light. Response status:", response.status);
            }
        } catch (error) {
            console.error("Error sending command to Hue light:", error);
        }
    }


    // Handle the action triggered by the EventBusHandlerNode
    onAction(action, param) {
        const lightInfo = param;  // Use param instead of getInputData

        if (lightInfo && lightInfo.devices) {
            lightInfo.devices.forEach(device => {
                if (device.hsv) {  // Check if HSV data exists
                    console.log(`ExecuteEventNode: Processing new HSV values for device ${device.light_id}:`, device.hsv);
                    this.sendCommandToLight(device, lightInfo.state, device.hsv);
                } else {
                    console.log("ExecuteEventNode: HSV data is missing for device", device.light_id);
                }
            });
        } else {
            console.log("ExecuteEvent: Missing 'devices' field in the input data.");
        }
    }


}

LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEvent);





















/*class ExecuteEvent extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Event";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        // Adjusted inputs and outputs
        this.addInput("On Event", LiteGraph.ACTION);  // Input trigger
        this.addOutput("API Call Count", "number");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.lastCommandTimestamp = 0; // Track the last time a command was sent
        this.commandCooldown = 1000;   // Cooldown time between requests in milliseconds
        this.apiRequestCount = 0;      // Count API requests

        this.deviceStates = {}; // To keep track of last known states
    }

    // Throttle requests to prevent flooding the Hue Bridge
    canSendCommand() {
        const currentTime = Date.now();
        if (currentTime - this.lastCommandTimestamp < this.commandCooldown) {
            return false;
        }
        this.lastCommandTimestamp = currentTime; // Update the timestamp for the last command
        return true;
    }

    async sendCommandToLight(device, state, hsv) {
        if (!this.canSendCommand()) return;

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${device.light_id}/state`;

        // Build bodyData based on changes
        const bodyData = {};

        const deviceKey = `${device.bridge_ip}-${device.light_id}`;

        if (!this.deviceStates[deviceKey]) {
            this.deviceStates[deviceKey] = {
                state: null,
                hsv: {}
            };
        }

        const lastState = this.deviceStates[deviceKey];

        // Check if state has changed
        if (lastState.state !== state) {
            bodyData.on = state;
            lastState.state = state;
        }

        // Check if hsv values have changed
        if (
            lastState.hsv.hue !== hsv.hue ||
            lastState.hsv.saturation !== hsv.saturation ||
            lastState.hsv.brightness !== hsv.brightness
        ) {
            bodyData.hue = Math.round(hsv.hue * 65535);
            bodyData.sat = Math.round(hsv.saturation * 254);
            bodyData.bri = Math.round(hsv.brightness);

            // Ensure brightness is at least 1
            if (bodyData.bri < 1) bodyData.bri = 1;

            // Make a copy of hsv
            lastState.hsv = { ...hsv };
        }

        if (Object.keys(bodyData).length === 0) {
            // No changes to send
            return;
        }

        console.log('Sending bodyData:', bodyData);

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                console.log(`Hue light ${device.light_id} successfully updated with data:`, bodyData);
                this.apiRequestCount++;
                this.setOutputData(0, this.apiRequestCount);  // Update the API Call Count output
            } else {
                console.error("Failed to update the Hue light.");
            }
        } catch (error) {
            console.error("Error updating Hue light:", error);
        }
    }

    // Handle the action triggered by the EventBusHandlerNode
    onAction(action, param) {
        const lightInfo = param;  // Use param instead of getInputData
        console.log("ExecuteEventNode: Received light data via event", lightInfo);  // Log received data

        if (lightInfo && lightInfo.devices) {
            // Process the light data
            lightInfo.devices.forEach(device => {
                this.sendCommandToLight(device, lightInfo.state, device.hsv);
            });
        } else {
            console.log("ExecuteEvent: Missing 'devices' field in the input data.");
        }
    }
}

LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEvent);












//prior code 
class ExecuteEvent extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Test";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "object");
        this.addOutput("API Call Count", "number");  // Add an output for the API call count

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        // Initialize logging area and state tracking
        this.logArea = document.getElementById('log-panel');
        this.lastState = null;
        this.lastColor = {};
        this.lastSentCommand = {};  // Track last sent command per device
        this.lastHsvs = {};  // Hue-specific: Track HSV values for each light
        this.lastLogTimestamp = 0;
        this.commandQueue = [];
        this.isProcessing = false;
        this.commandCooldown = 1000;  // 1 second rate-limit for commands
        this.lastCommandTimestamp = 0;
        this.debounceDelay = 500; // 500ms delay after changes to prevent multiple rapid updates
        this.debounceTimeout = null;

        // API request counter
        this.apiRequestCount = 0;
        this.addWidget("label", "API Requests", this.apiRequestCount, { precision: 0 });

        // Device Handlers
        this.deviceHandlers = {
            "Govee": this.handleGoveeDevice.bind(this),
            "Hue": this.handleHueDevice.bind(this),
            "default": this.handleUnknownDevice.bind(this)  // Default handler for unsupported device types
        };

        // Subscribe to EventBus for device control events
        window.EventBus.subscribe("device_control", this.handleDeviceControl.bind(this));
    }

    incrementApiRequestCount() {
        this.apiRequestCount++;
        this.widgets[0].value = this.apiRequestCount; // Update the label in the UI
        this.setOutputData(0, this.apiRequestCount); // Send the API call count via the output
    }

    updateLog(message) {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${message}`;

        if (this.logArea) {
            this.logArea.innerHTML += `${logMessage}<br>`;
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }
    }

    // Event handler for device control events from EventBus
    handleDeviceControl(eventData) {
        console.log("Execute Event Node: Received event data", eventData);  // Log received events
        if (this.properties.enable) {
            const devices = eventData.devices;

            devices.forEach(device => {
                const state = device.command === "turn_on";
                console.log(`Execute Event Node: Processing device`, device);  // Log device being processed
                if (this.deviceHandlers[device.device_type]) {
                    this.deviceHandlers[device.device_type].call(this, device, state);
                } else {
                    this.deviceHandlers["default"].call(this, device, state);
                }
            });
        }
    }

    // Handle Govee devices with API calls
    handleGoveeDevice(device, state) {
        const light = device.lights[0];
        const color = light.color || { r: 255, g: 255, b: 255 };
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Govee light ${light.light_id}`);
            return;
        }

        this.updateLog(`Sending Govee command: ${JSON.stringify(bodyData)}`);

        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': device.api_key
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => response.json())
        .then(() => {
            this.updateLog(`Govee Light ${light.light_id} - Command sent.`);
            this.lastSentCommand[device.device_type + light.light_id] = bodyData;
            this.incrementApiRequestCount();
        })
        .catch(error => {
            this.updateLog(`Error sending command to Govee light ${light.light_id}: ${error.message}`);
        });
    }

    // Handle Hue devices with API calls
    async handleHueDevice(device, state) {
        const light = device.lights[0];  // Use the first light in the array

        const now = Date.now();
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            console.log(`Hue command throttled for light ${light.light_id}`);
            return;
        }
        this.lastCommandTimestamp = now;

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

        const bodyData = {
            on: state,
            hue: Math.round(light.hsv.hue * 65535),  // Convert hue to the 0-65535 range for Hue API
            sat: Math.round(light.hsv.saturation * 254),  // Convert saturation to 0-254 range
            bri: Math.round(light.hsv.brightness)  // Brightness should already be in 0-254 range
        };

        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Hue light ${light.light_id}`);
            return;
        }

        this.updateLog(`Sending Hue command: ${JSON.stringify(bodyData)}`);

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                console.log(`Hue light ${light.light_id} successfully updated with state: ${state ? "on" : "off"} and HSV: ${light.hsv}`);
                this.incrementApiRequestCount();
            } else {
                console.error("Failed to update the Hue light.");
            }
        } catch (error) {
            console.error("Error updating Hue light:", error);
        }

        this.lastSentCommand[device.device_type + light.light_id] = bodyData;
    }

    // Handle unknown devices
    handleUnknownDevice(device, state) {
        this.updateLog(`Unknown device type: ${device.device_type}`);
    }

    // Handle Execute logic on node
    onExecute() {
        const lightInfo = this.getInputData(0); // Get the data from the input

        if (lightInfo) {
            // Loop through devices and process them
            lightInfo.devices.forEach((device) => {
                if (device.device_type === 'Hue') {
                    this.handleHueDevice(device, lightInfo.state);
                } else if (device.device_type === 'Govee') {
                    this.handleGoveeDevice(device, lightInfo.state);
                } else {
                    this.handleUnknownDevice(device, lightInfo.state);
                }
            });
        } else {
            console.log("Execute Event Node: Light Info is undefined"); // Log if the data is missing
        }
    }

}

LiteGraph.registerNodeType("Execution/ExecuteEvent", ExecuteEvent);*/



