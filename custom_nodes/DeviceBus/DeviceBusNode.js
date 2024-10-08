//GTP o1 mini code, unified data approach
class DeviceBusNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Device Bus Node";
        this.size = [350, 300];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean"); // Input0
        this.addInput("Time-based Trigger", "boolean"); // Input1

        // Add device inputs: "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "object"); // Inputs2-9
        }

        // Add output for triggering connected nodes if needed
        this.addOutput("Event Published", "void"); // Output0

        // Track last sent data to avoid sending duplicates
        this.lastSentData = null;

        // Initialize logging throttling variables
        this.lastIncompleteLogTime = null;
        this.lastDeviceLogTime = null;
        this.deviceLogInterval = 5000; // 5 seconds throttle for device logs

        // Bind methods
        this.onExecute = this.onExecute.bind(this);
        this.hasDataChanged = this.hasDataChanged.bind(this);
        this.logDeviceThrottled = this.logDeviceThrottled.bind(this);
    }

    // Deep comparison to check if data has changed
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false; // No change detected
        }
        return true; // Data has changed
    }

    // Throttled logging to prevent console clutter
    logDeviceThrottled(message) {
        const currentTime = Date.now();
        if (!this.lastDeviceLogTime || (currentTime - this.lastDeviceLogTime) > this.deviceLogInterval) {
            console.log(`[DeviceBusNode]: ${message}`);
            this.lastDeviceLogTime = currentTime;
        }
    }

    onExecute() {
        let trigger = false;
        let triggerType = "";

        // Check PushButton Trigger (Input0)
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
            this.logDeviceThrottled("PushButton Trigger activated.");
        }

        // Check Time-based Trigger (Input1)
        const timerBasedTrigger = this.getInputData(1);
        if (timerBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "timer-based";
            this.logDeviceThrottled("Time-based Trigger activated.");
        }

        if (!trigger) {
            // No trigger detected; avoid unnecessary processing
            return;
        }

        // Collect device data from inputs, starting from Input2 (Device Flow1)
        let devices = [];
        let incompleteFlows = [];

        for (let i = 2; i < this.inputs.length; i++) {  // Inputs2 to Inputs9
            const deviceData = this.getInputData(i);
            if (deviceData) {  // Check if there's data connected
                console.log(`[DeviceBusNode]: Received data from ${this.inputs[i].name}:`, deviceData);

                // Handle Philips Hue data structure with 'lights' array
                if (deviceData.lights && Array.isArray(deviceData.lights)) {
                    console.log(`[DeviceBusNode]: Parsing Hue data from ${this.inputs[i].name}`);
                    deviceData.lights.forEach((light, index) => {
                        if (light.light_id && light.hsv && deviceData.bridge_ip && deviceData.api_key && typeof deviceData.state === 'boolean') {
                            devices.push({
                                device_id: light.light_id,
                                model: "HueModelX", // Default model if not provided
                                api_key: deviceData.api_key,
                                device_type: "hue",
                                control_details: {
                                    hsv: light.hsv,
                                    on: deviceData.state
                                },
                                state: deviceData.state,
                                command: deviceData.state ? "turn_on" : "turn_off"
                            });
                            this.logDeviceThrottled(`Added Hue device ${light.light_id} with command ${devices[devices.length - 1].command}`);
                        } else {
                            incompleteFlows.push(`Flow ${i - 1} - Light ${index + 1}`);
                        }
                    });
                }
                // Handle Govee data structure with 'device_type'
                else if (deviceData.device_type === "govee") {
                    console.log(`[DeviceBusNode]: Parsing Govee data from ${this.inputs[i].name}`);
                    if (deviceData.device_id && deviceData.model && deviceData.api_key && typeof deviceData.state === 'boolean') {
                        devices.push({
                            device_id: deviceData.device_id,
                            model: deviceData.model,
                            api_key: deviceData.api_key,
                            device_type: "govee",
                            control_details: {
                                color: deviceData.color || { r: 255, g: 255, b: 255 }, // Default white
                                brightness: deviceData.brightness || 100
                            },
                            state: deviceData.state,
                            command: deviceData.command || (deviceData.state ? "turn_on" : "turn_off")
                        });
                        this.logDeviceThrottled(`Added Govee device ${deviceData.device_id} with command ${deviceData.state ? "turn_on" : "turn_off"}`);
                    } else {
                        incompleteFlows.push(`Flow ${i - 1} (Govee)`);
                    }
                }
                else {
                    incompleteFlows.push(`Flow ${i - 1} (Unrecognized structure)`);
                }
            }
        }

        // Log incomplete flows if any
        if (incompleteFlows.length > 0) {
            const currentTime = Date.now();
            if (!this.lastIncompleteLogTime || (currentTime - this.lastIncompleteLogTime) > 5000) { // 5 seconds throttle
                console.warn(`[DeviceBusNode]: Incomplete or unrecognized data for device(s) at flow(s): ${incompleteFlows.join(', ')}`);
                this.lastIncompleteLogTime = currentTime;
            }
        }

        // Prepare the data to be published to Event Bus
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Log the full data being published
        console.log("[DeviceBusNode]: Preparing to publish event data:", outputData);

        // Only send if the data has changed
        if (this.hasDataChanged(outputData)) {
            // Publish the data to Event Bus
            if (window.EventBus && typeof window.EventBus.publish === 'function') {
                window.EventBus.publish("light_settings", outputData); // Ensure event name matches ExecuteEventNode's subscription
                console.log("[DeviceBusNode]: Published 'light_settings' event to EventBus:", outputData);
                this.setOutputData(0, null); // Trigger the output for connected nodes
            } else {
                console.error("[DeviceBusNode]: window.EventBus.publish is not defined or not a function");
            }

            this.lastSentData = outputData;  // Update last sent data
        } else {
            // Data has not changed since the last event. Skipping publish.
            // No log to reduce clutter.
        }
    }
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("Device/Bus/device_bus_node", DeviceBusNode);


















//refactored version 
/*class DeviceBusNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Device Bus Node";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean"); // Input0
        this.addInput("Time-based Trigger", "boolean"); // Input1

        // Add device inputs: "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info"); // Inputs2-9
        }

        // Track last sent data to avoid sending duplicates
        this.lastSentData = null;

        // Initialize lastIncompleteLogTime for throttled logging
        this.lastIncompleteLogTime = null;

        // Initialize log throttling for device additions
        this.lastDeviceLogTime = null;
        this.deviceLogInterval = 5000; // 5 seconds throttle for device logs
    }

    // Define the hasDataChanged method using deep comparison
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false;  // No change detected
        }
        return true;  // Data has changed
    }

    // Throttled logging method for device logs
    logDeviceThrottled(message) {
        const currentTime = Date.now();
        if (!this.lastDeviceLogTime || (currentTime - this.lastDeviceLogTime) > this.deviceLogInterval) {
            console.log(message);
            this.lastDeviceLogTime = currentTime;
        }
    }

    onExecute() {
        if (typeof this.hasDataChanged !== 'function') {
            console.error("DeviceBusNode: hasDataChanged method is not defined");
            return;
        }

        let trigger = false;
        let triggerType = "";

        // Check PushButton Trigger (Input0)
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
            console.log("DeviceBusNode: PushButton Trigger activated.");
        }

        // Check Time-based Trigger (Input1)
        const timerBasedTrigger = this.getInputData(1);
        if (timerBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "timer-based";
            console.log("DeviceBusNode: Time-based Trigger activated.");
        }

        if (!trigger) {
            // No trigger detected; avoid logging to reduce clutter
            return;
        }

        // Collect device data from inputs, starting from Input2 (Device Flow1)
        let devices = [];
        let incompleteFlows = [];

        for (let i = 2; i < this.inputs.length; i++) {  // Inputs2 to Inputs9
            const deviceData = this.getInputData(i);
            if (deviceData) {  // Check if there's data connected
                console.log(`DeviceBusNode: Received data from Device Flow ${i - 1}:`, deviceData);
                if (deviceData.lights && Array.isArray(deviceData.lights)) {
                    // Handle multiple lights within a single flow
                    deviceData.lights.forEach((light, index) => {
                        if (light.light_id && light.hsv) {
                            let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                                          (triggerType === "timer-based" && timerBasedTrigger)
                                          ? "turn_on" : "turn_off";

                            // Set 'state' based on 'command' instead of 'deviceData.state'
                            let state = (command === "turn_on") ? true : false;

                            devices.push({
                                light_id: light.light_id,
                                hsv: light.hsv,
                                bridge_ip: deviceData.bridge_ip,
                                api_key: deviceData.api_key,
                                state: state,  // Corrected state assignment
                                command: command
                            });

                            // Use throttled logging for device addition
                            this.logDeviceThrottled(`DeviceBusNode: Adding device ${light.light_id} with command ${command}`);
                        } else {
                            // Log incomplete data for this specific light
                            incompleteFlows.push(`Flow ${i - 1} - Light ${index + 1}`);
                        }
                    });
                } else if (deviceData.light_id && deviceData.hsv) {
                    // Handle single device data
                    let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                                  (triggerType === "timer-based" && timerBasedTrigger)
                                  ? "turn_on" : "turn_off";

                    // Set 'state' based on 'command' instead of 'deviceData.state'
                    let state = (command === "turn_on") ? true : false;

                    devices.push({
                        light_id: deviceData.light_id,
                        hsv: deviceData.hsv,
                        bridge_ip: deviceData.bridge_ip,
                        api_key: deviceData.api_key,
                        state: state,  // Corrected state assignment
                        command: command
                    });

                    // Use throttled logging for device addition
                    this.logDeviceThrottled(`DeviceBusNode: Adding device ${deviceData.light_id} with command ${command}`);
                } else {
                    // Data is incomplete and doesn't match expected structure
                    incompleteFlows.push(`Flow ${i - 1}`);
                }
            } else {
                console.log(`DeviceBusNode: No data connected to Device Flow ${i - 1}`);
            }
        }

        // Implement throttled logging for incomplete data
        if (incompleteFlows.length > 0) {
            const currentTime = Date.now();
            if (!this.lastIncompleteLogTime || (currentTime - this.lastIncompleteLogTime) > 5000) { // 5 seconds throttle
                console.warn(`DeviceBusNode: Incomplete data for device(s) at flow(s) ${incompleteFlows.join(', ')}`);
                this.lastIncompleteLogTime = currentTime;
            }
        }

        if (devices.length === 0) {
            // No valid devices detected; avoid logging to reduce clutter
            console.log("DeviceBusNode: No valid devices to process.");
            return;
        }

        // Prepare the data to be published to Event Bus
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Only send if the data has changed
        if (this.hasDataChanged(outputData)) {
            // Log the full data being published
            console.log("DeviceBusNode: Full event data being published:", outputData);

            // Publish the data to Event Bus
            if (window.EventBus && typeof window.EventBus.publish === 'function') {
                window.EventBus.publish("light_settings", outputData);  // Ensure event name matches EventBusHandlerNode's subscription
                console.log("DeviceBusNode: Published 'light_settings' event data to EventBus", outputData);
            } else {
                console.error("DeviceBusNode: window.EventBus.publish is not defined or not a function");
            }

            this.lastSentData = outputData;  // Update last sent data
        } else {
            console.log("DeviceBusNode: Data has not changed since the last event. Skipping publish.");
        }
        // Do not log "Data unchanged" to reduce clutter
    }
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("Device/Bus/device_bus_node", DeviceBusNode);*/





//prior working version 
/*class DeviceBusNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Device Bus Node";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean"); // Input0
        this.addInput("Time-based Trigger", "boolean"); // Input1

        // Add device inputs: "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info"); // Inputs2-9
        }

        // Track last sent data to avoid sending duplicates
        this.lastSentData = null;

        // Initialize lastIncompleteLogTime for throttled logging
        this.lastIncompleteLogTime = null;

        // Initialize log throttling for device additions
        this.lastDeviceLogTime = null;
        this.deviceLogInterval = 5000; // 5 seconds throttle for device logs
    }

    // Define the hasDataChanged method
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false;  // No change detected
        }
        return true;  // Data has changed
    }

    // Throttled logging method for device logs
    logDeviceThrottled(message) {
        const currentTime = Date.now();
        if (!this.lastDeviceLogTime || (currentTime - this.lastDeviceLogTime) > this.deviceLogInterval) {
            console.log(message);
            this.lastDeviceLogTime = currentTime;
        }
    }

    onExecute() {
        if (typeof this.hasDataChanged !== 'function') {
            console.error("DeviceBusNode: hasDataChanged method is not defined");
            return;
        }

        let trigger = false;
        let triggerType = "";

        // Check PushButton Trigger (Input0)
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
        }

        // Check Time-based Trigger (Input1)
        const timerBasedTrigger = this.getInputData(1);
        if (timerBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "timer-based";
        }

        if (!trigger) {
            // No trigger detected; avoid logging to reduce clutter
            return;
        }

        // Collect device data from inputs, starting from Input2 (Device Flow1)
        let devices = [];
        let incompleteFlows = [];

        for (let i = 2; i < this.inputs.length; i++) {  // Inputs2 to Inputs9
            const deviceData = this.getInputData(i);
            if (deviceData) {  // Check if there's data connected
                if (deviceData.lights && Array.isArray(deviceData.lights)) {
                    // Handle multiple lights within a single flow
                    deviceData.lights.forEach((light, index) => {
                        if (light.light_id && light.hsv) {
                            let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                                          (triggerType === "timer-based" && timerBasedTrigger)
                                          ? "turn_on" : "turn_off";

                            // Set 'state' based on 'command' instead of 'deviceData.state'
                            let state = (command === "turn_on") ? true : false;

                            devices.push({
                                light_id: light.light_id,
                                hsv: light.hsv,
                                bridge_ip: deviceData.bridge_ip,
                                api_key: deviceData.api_key,
                                state: state,  // Corrected state assignment
                                command: command
                            });

                            // Use throttled logging for device addition
                            this.logDeviceThrottled(`DeviceBusNode: Adding device ${light.light_id} with command ${command}`);
                        } else {
                            // Log incomplete data for this specific light
                            incompleteFlows.push(`Flow ${i - 1} - Light ${index + 1}`);
                        }
                    });
                } else if (deviceData.light_id && deviceData.hsv) {
                    // Handle single device data
                    let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                                  (triggerType === "timer-based" && timerBasedTrigger)
                                  ? "turn_on" : "turn_off";

                    // Set 'state' based on 'command' instead of 'deviceData.state'
                    let state = (command === "turn_on") ? true : false;

                    devices.push({
                        light_id: deviceData.light_id,
                        hsv: deviceData.hsv,
                        bridge_ip: deviceData.bridge_ip,
                        api_key: deviceData.api_key,
                        state: state,  // Corrected state assignment
                        command: command
                    });

                    // Use throttled logging for device addition
                    this.logDeviceThrottled(`DeviceBusNode: Adding device ${deviceData.light_id} with command ${command}`);
                } else {
                    // Data is incomplete and doesn't match expected structure
                    incompleteFlows.push(`Flow ${i - 1}`);
                }
            }
            // Do not log anything if deviceData is undefined (i.e., flow is not connected)
        }

        // Implement throttled logging for incomplete data
        if (incompleteFlows.length > 0) {
            const currentTime = Date.now();
            if (!this.lastIncompleteLogTime || (currentTime - this.lastIncompleteLogTime) > 5000) { // 5 seconds throttle
                console.warn(`DeviceBusNode: Incomplete data for device(s) at flow(s) ${incompleteFlows.join(', ')}`);
                this.lastIncompleteLogTime = currentTime;
            }
        }

        if (devices.length === 0) {
            // No valid devices detected; avoid logging to reduce clutter
            return;
        }

        // Prepare the data to be published to Event Bus
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Only send if the data has changed
        if (this.hasDataChanged(outputData)) {
            // Log the full data being published
            console.log("DeviceBusNode: Full event data being published:", outputData);

            // Publish the data to Event Bus
            if (window.EventBus && typeof window.EventBus.publish === 'function') {
                window.EventBus.publish("light_settings", outputData);  // Ensure event name matches EventBusHandlerNode's subscription
                console.log("DeviceBusNode: Published 'light_settings' event data to EventBus", outputData);
            } else {
                console.error("DeviceBusNode: window.EventBus.publish is not defined or not a function");
            }

            this.lastSentData = outputData;  // Update last sent data
        }
        // Do not log "Data unchanged" to reduce clutter
    }
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("Device/Bus/device_bus_node", DeviceBusNode);*/
















