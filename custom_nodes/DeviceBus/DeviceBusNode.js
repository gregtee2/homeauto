class DeviceBusNode extends LiteGraph.LGraphNode {
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
    }

    // Define the hasDataChanged method
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false;  // No change detected
        }
        return true;  // Data has changed
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

                            console.log(`DeviceBusNode: Adding device ${light.light_id} with command ${command}`);
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

                    console.log(`DeviceBusNode: Adding device ${deviceData.light_id} with command ${command}`);
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
LiteGraph.registerNodeType("Device/Bus/device_bus_node", DeviceBusNode);















/*class DeviceBusNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "DeviceBusNode";
        this.size = [250, 250];  // Adjust node size

        this.properties = { 
            devices: [],  // Store devices as objects
            bridge_ip: localStorage.getItem('bridgeIp') || "", 
            api_key: localStorage.getItem('apiKey') || "", 
            lights_fetched: false, 
            selected_light: "",
            hsv: { hue: 0, saturation: 0, brightness: 128 },  // Default HSV values
            light_on: true  // Default state for light (on)
        };

        this.addWidget("text", "Bridge IP", this.properties.bridge_ip, (value) => {
            this.properties.bridge_ip = value;
            localStorage.setItem('bridgeIp', value);  // Store in local storage
        });
        this.addWidget("text", "API Key", this.properties.api_key, (value) => {
            this.properties.api_key = value;
            localStorage.setItem('apiKey', value);  // Store in local storage
        });

        // Toggle for manual on/off
        this.addWidget("toggle", "Light On/Off", this.properties.light_on, (value) => {
            this.properties.light_on = value;
            this.sendToEventBus();  // Emit settings when toggled
        });

        this.addWidget("button", "Fetch Devices", "", this.fetchDevices.bind(this));

        this.deviceComboWidget = this.addWidget("combo", "Select Device", "", (selectedLight) => {
            this.properties.selected_light = selectedLight;
        }, { values: [] });

        this.addWidget("button", "Add Device", "", this.addDevice.bind(this));

        this.addInput("HSV Info", "hsv_info");

        this.updateNodeHeight();  // Adjust node height based on content
    }

    // Fetch devices from the Hue Bridge
    fetchDevices() {
        if (!this.properties.bridge_ip || !this.properties.api_key) {
            console.error("Bridge IP or API Key missing.");
            return;
        }

        const url = `http://${this.properties.bridge_ip}/api/${this.properties.api_key}/lights`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const deviceOptions = Object.entries(data).map(([id, light]) => ({
                    id: id,
                    name: light.name
                }));

                this.deviceComboWidget.options.values = deviceOptions.map(device => device.name);
                this.properties.lights_fetched = true;
            })
            .catch(error => {
                console.error("Error fetching lights:", error);
            });
    }

    // Add selected device to the list of devices
    addDevice() {
        const selectedLight = this.properties.selected_light;

        if (!this.properties.lights_fetched) {
            console.error("No lights have been fetched yet.");
            return;
        }

        // Ensure selected light is valid and not already added
        if (selectedLight && !this.properties.devices.some(device => device.light_id === selectedLight)) {
            const newDevice = {
                light_id: selectedLight,
                bridge_ip: this.properties.bridge_ip,
                api_key: this.properties.api_key,
                hsv: { hue: 0, saturation: 0, brightness: 128 },
                state: this.properties.light_on
            };

            this.properties.devices.push(newDevice);  // Store only device objects

            this.updateNodeHeight();  // Adjust node height based on the number of devices
            this.setDirtyCanvas(true);  // Redraw node to show updates
        } else {
            console.error("Selected light is already in the list or invalid.");
        }
    }



    // Emit device information to the EventBus
    sendToEventBus() {
        const eventBus = window.EventBus;
        if (eventBus) {
            // Ensure all devices are objects with a light_id
            const validDevices = this.properties.devices.filter(device => typeof device === 'object' && device.light_id);

            if (validDevices.length > 0) {
                eventBus.publish("light_settings", {
                    devices: validDevices,
                    hsv: this.properties.hsv,
                    state: this.properties.light_on,
                    timestamp: new Date().toISOString()
                });
                console.log("DeviceBusNode: Published event to Event Bus", validDevices, this.properties.hsv, this.properties.light_on);
            } else {
                console.error("No valid devices to send to the Event Bus.");
            }
        }
    }





    // Capture HSV Info from the HSVControlNode and apply to devices
    onExecute() {
        const hsvInfo = this.getInputData(0);  // Fetch HSV Info from the input (HSVControlNode)

        if (hsvInfo) {
            console.log("DeviceBusNode: Received HSV Info", hsvInfo);  // Log the HSV info
            this.properties.hsv = hsvInfo;  // Update the global HSV for devices
            this.properties.devices.forEach(device => {
                if (typeof device === 'object' && device.light_id) {
                    device.hsv = hsvInfo;  // Apply the HSV info to each device object
                } else {
                    console.error("Invalid device found in the devices array", device);
                }
            });

            this.sendToEventBus();  // Emit the event with updated HSV info
        } else {
            console.log("DeviceBusNode: No HSV input detected");
        }

        this.setOutputData(0, this.properties.devices);
    }



    // Custom rendering function to draw the list of devices as plain text
    onDrawForeground(ctx) {
        if (this.properties.devices.length === 0) {
            ctx.fillStyle = "#AAA";
            ctx.fillText("No devices selected", 10, 120);
        } else {
            ctx.fillStyle = "#000";  // Black text color
            ctx.font = "14px Arial";
            let yOffset = 140;  // Position below "Add Device"
            this.properties.devices.forEach(device => {
                ctx.fillText(device.light_id, 10, yOffset);
                yOffset += 20;  // Move down for each device
            });
        }
    }

    updateNodeHeight() {
        const baseHeight = 250;
        const additionalHeight = this.properties.devices.length * 20;
        this.size[1] = baseHeight + additionalHeight;
    }
}

LiteGraph.registerNodeType("DeviceBus/device_bus", DeviceBusNode);*/
