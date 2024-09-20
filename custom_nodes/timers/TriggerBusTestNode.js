//GTP4 code
class TriggerBusTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Trigger Bus Test";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean");
        this.addInput("Time-based Trigger", "boolean");

        // Add device inputs: Label them as "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info");
        }

        // Output to send data to Execute Node
        this.addOutput("Out", "object");

        // Track last sent data to avoid sending duplicates
        this.lastSentData = null;

        // Initialize the rate limiter properties for Govee lights
        this.commandQueue = [];
        this.isProcessing = false;
        this.commandCooldown = 6000;  // Default 6 seconds between commands
    }

    // Queue all commands to multiple Govee devices
    queueCommands(deviceList, state, color) {
        deviceList.forEach(device => {
            this.commandQueue.push({ device, state, color });
        });

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue(deviceList.length);
        }
    }

    // Process the command queue while respecting the rate limit for Govee devices
    processQueue(deviceCount) {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;  // Stop processing when queue is empty
        }

        this.isProcessing = true;

        // Get the first command in the queue
        const { device, state, color } = this.commandQueue.shift();

        // Simulated Govee API call for a device
        this.sendGoveeCommand(device, state, color)
            .then(() => {
                // If there's only 1 device, skip the cooldown
                const delay = (deviceCount > 1) ? this.commandCooldown : 0;

                // Wait for the cooldown period before processing the next command
                setTimeout(() => this.processQueue(deviceCount), delay);
            })
            .catch(err => {
                console.error(`Error sending command to device ${device.device_id}:`, err);
                setTimeout(() => this.processQueue(deviceCount), this.commandCooldown);  // Continue processing even after an error
            });
    }

    // Simulated Govee API call for a device
    sendGoveeCommand(device, state, color) {
        return new Promise((resolve, reject) => {
            const url = `https://developer-api.govee.com/v1/devices/control`;
            const bodyData = {
                device: device.device_id,
                model: device.model,
                cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
            };

            fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Govee-API-Key": device.api_key
                },
                body: JSON.stringify(bodyData)
            })
                .then(response => {
                    if (response.status === 429) {
                        const retryAfter = parseInt(response.headers.get("retry-after") || 1, 10) * 1000;
                        console.error(`Rate limit exceeded, retrying after ${retryAfter} ms`);
                        setTimeout(() => this.processQueue(this.commandQueue.length), retryAfter);
                        reject(`Rate limited, retry after ${retryAfter} ms`);
                    }
                    return response.json();
                })
                .then(() => {
                    console.log(`Command sent to device ${device.device_id}: state=${state}`);
                    resolve();
                })
                .catch(error => {
                    console.error(`Failed to send command to Govee device: ${error}`);
                    reject(error);
                });
        });
    }

    // Check if the new data is different from the last sent data
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false;  // No change detected
        }
        return true;  // Data has changed
    }

    onExecute() {
        let trigger = false;
        let triggerType = "";

        // Check triggers
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
        }

        const timeBasedTrigger = this.getInputData(1);
        if (timeBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "time-based";
        }

        if (!trigger) {
            return;
        }

        // Collect device data from inputs
        let devices = [];
        for (let i = 2; i < this.inputs.length; i++) {
            const deviceData = this.getInputData(i);
            if (deviceData && deviceData.lights) {
                let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                              (triggerType === "time-based" && timeBasedTrigger)
                              ? "turn_on" : "turn_off";

                devices.push({
                    ...deviceData,
                    command: command
                });
            }
        }

        if (devices.length === 0) {
            console.log("No devices detected in Trigger Bus Node.");
            return;
        }

        // Prepare the output data
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Only send if the data has changed
        if (this.hasDataChanged(outputData)) {
            // Process the Govee devices using the rate limiter
            const goveeDevices = devices.filter(device => device.model && device.model.startsWith("H"));
            if (goveeDevices.length > 0) {
                this.queueCommands(goveeDevices, true, { r: 255, g: 255, b: 255 });  // Example: Turn Govee devices on with white color
            }

            // Send commands to Hue devices directly (no rate limiting)
            const hueDevices = devices.filter(device => device.device_type === "Hue");
            hueDevices.forEach(device => {
                console.log(`Sending command to Hue device ${device.device_id}: state=${device.command}`);
                // Here you would call the actual Hue API, no rate limiting needed
            });

            // Send the output data to the next node
            this.setOutputData(0, outputData);
            this.lastSentData = outputData;  // Update last sent data
        } else {
            //console.log("No change detected, skipping output.");
        }
    }
}

LiteGraph.registerNodeType("Timers/trigger_bus_test", TriggerBusTestNode);






//working 01 preview code
/*class TriggerBusTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Trigger Bus Test";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean");
        this.addInput("Time-based Trigger", "boolean");

        // Add device inputs: Label them as "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info");
        }

        // Output to send data to Execute Node
        this.addOutput("Out", "object");

        // Track last sent data for each device to avoid sending duplicates
        this.lastSentDataPerDevice = {};

        // Initialize the rate limiter properties for Govee lights
        this.commandQueue = [];
        this.isProcessing = false;
        this.commandCooldown = 6000;  // Default 6 seconds between commands
    }

    // Track if a command has changed for each individual device
    hasDeviceDataChanged(device) {
        const lastData = this.lastSentDataPerDevice[device.device_id];
        if (lastData && JSON.stringify(lastData) === JSON.stringify(device)) {
            return false;  // No change detected for this device
        }
        return true;  // Data has changed for this device
    }

    // Queue all commands to multiple Govee devices
    queueCommands(deviceList, state, color) {
        deviceList.forEach(device => {
            this.commandQueue.push({ device, state, color });
        });

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue(deviceList.length);
        }
    }

    // Process the command queue while respecting the rate limit for Govee devices
    processQueue(deviceCount) {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;  // Stop processing when queue is empty
        }

        this.isProcessing = true;

        // Get the first command in the queue
        const { device, state, color } = this.commandQueue.shift();

        // Simulated Govee API call for a device
        this.sendGoveeCommand(device, state, color)
            .then(() => {
                // If there's only 1 device, skip the cooldown
                const delay = (deviceCount > 1) ? this.commandCooldown : 0;

                // Wait for the cooldown period before processing the next command
                setTimeout(() => this.processQueue(deviceCount), delay);
            })
            .catch(err => {
                console.error(`Error sending command to device ${device.device_id}:`, err);
                setTimeout(() => this.processQueue(deviceCount), this.commandCooldown);  // Continue processing even after an error
            });
    }

    // Simulated Govee API call for a device
    sendGoveeCommand(device, state, color) {
        return new Promise((resolve, reject) => {
            const url = `https://developer-api.govee.com/v1/devices/control`;
            const bodyData = {
                device: device.device_id,
                model: device.model,
                cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
            };

            fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Govee-API-Key": device.api_key
                },
                body: JSON.stringify(bodyData)
            })
                .then(response => {
                    if (response.status === 429) {
                        const retryAfter = parseInt(response.headers.get("retry-after") || 1, 10) * 1000;
                        console.error(`Rate limit exceeded, retrying after ${retryAfter} ms`);
                        setTimeout(() => this.processQueue(this.commandQueue.length), retryAfter);
                        reject(`Rate limited, retry after ${retryAfter} ms`);
                    }
                    return response.json();
                })
                .then(() => {
                    console.log(`Command sent to device ${device.device_id}: state=${state}`);
                    resolve();
                })
                .catch(error => {
                    console.error(`Failed to send command to Govee device: ${error}`);
                    reject(error);
                });
        });
    }

    // Updated function to check for changes per device
    onExecute() {
        let trigger = false;
        let triggerType = "";

        // Check triggers
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
        }

        const timeBasedTrigger = this.getInputData(1);
        if (timeBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "time-based";
        }

        if (!trigger) {
            return;
        }

        // Collect device data from inputs
        let devices = [];
        for (let i = 2; i < this.inputs.length; i++) {
            const deviceData = this.getInputData(i);
            if (deviceData && deviceData.lights) {
                let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                              (triggerType === "time-based" && timeBasedTrigger)
                              ? "turn_on" : "turn_off";

                const deviceWithCommand = {
                    ...deviceData,
                    command: command
                };

                // Check if the data has changed for this specific device
                if (this.hasDeviceDataChanged(deviceWithCommand)) {
                    devices.push(deviceWithCommand);
                }
            }
        }

        if (devices.length === 0) {
            console.log("No devices with state changes detected in Trigger Bus Node.");
            return;
        }

        // Prepare the output data
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Process the Govee devices using the rate limiter
        const goveeDevices = devices.filter(device => device.model && device.model.startsWith("H"));
        if (goveeDevices.length > 0) {
            this.queueCommands(goveeDevices, true, { r: 255, g: 255, b: 255 });  // Example: Turn Govee devices on with white color
        }

        // Send commands to Hue devices directly (no rate limiting)
        const hueDevices = devices.filter(device => device.device_type === "Hue");
        hueDevices.forEach(device => {
            console.log(`Sending command to Hue device ${device.device_id}: state=${device.command}`);
            // Here you would call the actual Hue API, no rate limiting needed
        });

        // Send the output data to the next node
        this.setOutputData(0, outputData);

        // Update last sent data for each device
        devices.forEach(device => {
            this.lastSentDataPerDevice[device.device_id] = device;
        });
    }
}

LiteGraph.registerNodeType("Timers/trigger_bus_test", TriggerBusTestNode);






//GTP 01

class TriggerBusTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Trigger Bus Test";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean");
        this.addInput("Time-based Trigger", "boolean");

        // Add device inputs: Label them as "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info");
        }

        // Output to send data to Execute Node
        this.addOutput("Out", "object");

        this.lastSentData = null;
    }

    onExecute() {
        let trigger = false;
        let triggerType = "";

        // Check triggers
        const pushButtonTrigger = this.getInputData(0);
        const timeBasedTrigger = this.getInputData(1);

        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
        } else if (timeBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "time-based";
        }

        if (!trigger) {
            return;
        }

        // Collect device data from inputs
        let devices = [];
        for (let i = 2; i < this.inputs.length; i++) {
            const deviceData = this.getInputData(i);

            // Ensure deviceData exists and has lights
            if (deviceData && deviceData.lights) {
                // Determine device type: Govee or Hue
                if (deviceData.bridge_ip) {
                    deviceData.device_type = "Hue";
                } else if (deviceData.api_key) {
                    deviceData.device_type = "Govee";
                } else {
                    deviceData.device_type = "Unknown";
                    console.error("Unknown device type for device:", deviceData);
                    continue;
                }

                // Set the command (turn_on/turn_off) based on trigger
                let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                              (triggerType === "time-based" && timeBasedTrigger)
                              ? "turn_on" : "turn_off";

                // Add device info to devices array
                devices.push({
                    ...deviceData,
                    command: command
                });
            }
        }

        // If no devices are found, stop execution
        if (devices.length === 0) {
            console.log("No devices detected in Trigger Bus Node.");
            return;
        }

        // Prepare the output data to be sent to the Execute Node
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Only send output if the command has changed to avoid redundant triggers
        if (JSON.stringify(outputData) !== JSON.stringify(this.lastSentData)) {
            this.setOutputData(0, outputData);
            this.lastSentData = outputData;  // Cache the last sent data to avoid duplicate outputs
        } else {
            //console.log("No change in trigger or device state, skipping output.");
        }
    }
}

LiteGraph.registerNodeType("Timers/trigger_bus_test", TriggerBusTestNode);





























/*
//Final working version before rate limiter added
class TriggerBusTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Trigger Bus Test";
        this.size = [150, 225];

        // Add trigger inputs: PushButton and Time-based trigger
        this.addInput("PushButton Trigger", "boolean");
        this.addInput("Time-based Trigger", "boolean");

        // Add device inputs: Label them as "Device Flow 1" to "Device Flow 8"
        for (let i = 1; i <= 8; i++) {
            this.addInput(`Device Flow ${i}`, "light_info");
        }

        // Output to send data to Execute Node
        this.addOutput("Out", "object");

        // Track last sent data to avoid sending duplicates
        this.lastSentData = null;

        // Modularized device handlers
        this.deviceHandlers = {
            "Hue": this.handleHueDevice,
            "Govee": this.handleGoveeDevice
        };
    }

    // Check if the new data is different from the last sent data
    hasDataChanged(newData) {
        if (this.lastSentData && JSON.stringify(this.lastSentData) === JSON.stringify(newData)) {
            return false;  // No change detected
        }
        return true;  // Data has changed
    }

    onExecute() {
        let trigger = false;
        let triggerType = "";

        // Check triggers
        const pushButtonTrigger = this.getInputData(0);
        if (pushButtonTrigger !== undefined) {
            trigger = true;
            triggerType = "pushbutton";
        }

        const timeBasedTrigger = this.getInputData(1);
        if (timeBasedTrigger !== undefined) {
            trigger = true;
            triggerType = "time-based";
        }

        if (!trigger) {
            return;
        }

        // Collect device data from inputs
        let devices = [];
        for (let i = 2; i < this.inputs.length; i++) {
            const deviceData = this.getInputData(i);
            if (deviceData && deviceData.lights) {
                // Ensure clear separation for Govee devices only
                if (deviceData.model && deviceData.model.startsWith("H")) {
                    deviceData.device_type = "Govee";  // Tag as Govee if the model starts with "H"
                }

                let command = (triggerType === "pushbutton" && pushButtonTrigger) ||
                              (triggerType === "time-based" && timeBasedTrigger)
                              ? "turn_on" : "turn_off";

                devices.push({
                    ...deviceData,
                    command: command
                });
            }
        }

        if (devices.length === 0) {
            console.log("No devices detected in Trigger Bus Node.");
            return;
        }

        // Prepare the output data
        const outputData = {
            trigger_event: {
                type: triggerType,
                status: true
            },
            devices: devices
        };

        // Only send if the data has changed
        if (this.hasDataChanged(outputData)) {
            this.setOutputData(0, outputData);
            this.lastSentData = outputData;  // Update last sent data
        } else {
            //console.log("No change detected, skipping output.");
        }
    }
}

LiteGraph.registerNodeType("Timers/trigger_bus_test", TriggerBusTestNode);








*/
