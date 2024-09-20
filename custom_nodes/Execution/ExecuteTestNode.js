

//GTP 4.0 code
class ExecuteTestNode extends LiteGraph.LGraphNode {
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

        this.deviceHandlers = {
            "Govee": this.handleGoveeDevice.bind(this),
            "Hue": this.handleHueDevice.bind(this),
            "default": this.handleUnknownDevice  // Default handler for unsupported device types
        };
    }

    // Increment the API request count and update the label
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

    // Function to handle Govee light control with rate limiting
    handleGoveeDevice(device, state) {
        const light = device.lights[0];
        const color = light.color || { r: 255, g: 255, b: 255 };  // Default to white if color is missing
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        // Check if the new command is different from the last sent command
        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Govee light ${light.light_id}`);
            return;  // Skip if it's the same command as the last one
        }

        this.updateLog(`Queueing command to Govee API: ${JSON.stringify(bodyData)}`);

        // Add delay to avoid rate limiting (600ms delay between each call)
        const delay = (this.apiRequestCount % 10) * 600;

        setTimeout(() => {
            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': device.api_key
                },
                body: JSON.stringify(bodyData)
            })
            .then(response => {
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                    this.updateLog(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                    return Promise.reject({ retryAfter });
                }
                return response.json();
            })
            .then(responseData => {
                this.updateLog(`Govee Light ${light.light_id} - Command triggered successfully.`);
                this.lastSentCommand[device.device_type + light.light_id] = bodyData;  // Store last sent command
                this.incrementApiRequestCount();  // Increment the API request count when successful

                // Track API call in the API Call Tracker node
                const apiCallTrackerNode = this.graph.findNodesByType("Utility/api_call_tracker")[0];
                if (apiCallTrackerNode) {
                    apiCallTrackerNode.trackAPICall();
                }
            })
            .catch(error => {
                this.updateLog(`Error triggering command for Govee Light ${light.light_id}: ${error.message}`);
            });
        }, delay);  // Delay the request by a calculated amount of time
    }

    // Queue and process Govee light commands
    queueCommand(device, state, color) {
        const now = Date.now();

        // Check if enough time has passed since the last command (rate-limiting)
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            this.updateLog("Command blocked due to cooldown.");
            return;  // Block the command if cooldown hasn't passed
        }

        // Queue the command
        this.commandQueue.push({ device, state, color });
        
        // Set the last command timestamp to the current time
        this.lastCommandTimestamp = now;

        // Start processing the queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;  // No commands to process
        }

        this.isProcessing = true;
        const { device, state, color } = this.commandQueue.shift();  // Process the next command in the queue

        // Send commands to the device type
        if (device.device_type === "Govee") {
            this.sendGoveeCommand(device, state, color).then(() => {
                // Introduce a delay to prevent API overload (rate-limiting)
                setTimeout(() => {
                    this.processQueue();  // Process the next command in the queue after delay
                }, this.commandCooldown);  // Wait for cooldown before processing the next command
            });
        } else if (device.device_type === "Hue") {
            this.sendHueCommand(device, state).then(() => {
                // Introduce a delay for Hue as well, if needed
                setTimeout(() => {
                    this.processQueue();
                }, this.commandCooldown);
            });
        }
    }

    sendGoveeCommand(device, state, color) {
        const light = device.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        // Send the actual API command with rate-limit checks
        return fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': device.api_key
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                this.updateLog(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                return new Promise(resolve => setTimeout(resolve, retryAfter));
            }
            return response.json();
        })
        .then(responseData => {
            this.updateLog(`Govee Light ${light.light_id} - Command triggered successfully.`);
            this.lastSentCommand[device.device_type + light.light_id] = bodyData;  // Store last sent command
            this.incrementApiRequestCount();  // Increment the API request count when successful
        })
        .catch(error => {
            this.updateLog(`Error triggering command for Govee Light ${light.light_id}: ${error.message}`);
        });
    }

    sendHueCommand(device, state) {
        // Implement Hue command logic if needed
        return Promise.resolve();
    }

    handleUnknownDevice(device, state) {
        this.updateLog(`Unknown device type: ${device.device_type}`);
    }

    onExecute() {
        const lightInfo = this.getInputData(0);
        if (lightInfo && this.properties.enable) {
            const handler = this.deviceHandlers[lightInfo.device_type] || this.deviceHandlers["default"];
            handler(lightInfo, this.properties.state);
        }
    }



    // Check if state or color has changed
    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState || !this.lastColor || 
            color.r !== this.lastColor.r || 
            color.g !== this.lastColor.g || 
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

        // Modularized function to handle Hue light control
    handleHueDevice(device, state) {
        const light = device.lights[0];
        if (!light.hsv) {
            this.updateLog(`Skipping Hue light ${light.light_id}, missing HSV data.`);
            return;
        }

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

        const bodyData = {
            on: state,
            hue: Math.round(light.hsv.hue * 65535),
            sat: Math.round(light.hsv.saturation * 254),
            bri: Math.round(light.hsv.brightness)
        };

        // Check if the new command is different from the last sent command
        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Hue light ${light.light_id}`);
            return;  // Skip if it's the same command as the last one
        }

        this.updateLog(`Sending HTTP request to: ${url} with body: ${JSON.stringify(bodyData)}`);

        fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.updateLog(`Hue Light ${light.light_id} updated successfully with state: ${state ? "On" : "Off"}`);
            this.lastSentCommand[device.device_type + light.light_id] = bodyData;  // Store last sent command
            this.incrementApiRequestCount();  // Increment the API request count when successful
        })
        .catch(error => {
            this.updateLog(`Error updating Hue light ${light.light_id}: ${error.message}`);
        });
    }



    onExecute() {
        const now = Date.now();

        // Throttle the log messages to only appear every 5 seconds
        if (now - this.lastLogTimestamp < 5000) {
            return;
        }

        this.lastLogTimestamp = now;  // Update the last log time

        if (!this.properties.enable) {
            return;  // Skip if node is disabled
        }

        const lightInfo = this.getInputData(0);  // Get light info

        // Log the data received from the Trigger node for inspection
        this.updateLog(`Data received from Trigger node: ${JSON.stringify(lightInfo)}`);

        if (!lightInfo || !Array.isArray(lightInfo.devices) || lightInfo.devices.length === 0) {
            return;  // Skip logging for invalid or empty devices
        }

        clearTimeout(this.debounceTimeout);  // Reset debounce timeout

        // Delay the execution of changes by debounce delay (500ms)
        this.debounceTimeout = setTimeout(() => {
            lightInfo.devices.forEach((device) => {
                // Log the full device object to inspect it
                this.updateLog(`Full device info: ${JSON.stringify(device)}`);

                // Identify Govee lights or Hue lights
                if (device.model && device.model.startsWith('H6008')) {  
                    // Check explicitly for Govee model H6008
                    device.device_type = 'Govee';  
                } else if (device.bridge_ip && device.api_key) {  
                    // If it has bridge_ip and api_key, assume it's Hue
                    device.device_type = 'Hue';  
                } else if (!device.device_type) {
                    device.device_type = 'Govee';  // Default to Govee for now, based on your previous logic
                }

                this.updateLog(`Device type after detection: ${device.device_type}`);

                if (!device.lights || device.lights.length === 0) {
                    return;  // Skip logging for invalid or empty lights
                }

                const state = device.command === 'turn_on';

                // Handle device commands based on the device type
                if (this.deviceHandlers[device.device_type]) {
                    this.deviceHandlers[device.device_type].call(this, device, state);
                } else {
                    this.updateLog(`Unsupported or unknown device type: ${device.device_type}`);
                    this.deviceHandlers["default"].call(this, device, state);
                }
            });
        }, this.debounceDelay);  // Apply debounce delay

        // Continuously update the API call count output
        this.setOutputData(0, this.apiRequestCount);  // Ensure output is updated on each execute
    }
}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);




//GTP o1 Preview Code

/*class ExecuteTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Test";
        this.size = [400, 650];
        this.properties = { enable: false };

        this.addInput("Light Info", "object");
        this.addOutput("API Call Count", "number");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        this.lastSentCommand = {};
        this.apiRequestCount = 0;

        this.deviceHandlers = {
            "Govee": this.sendGoveeCommand.bind(this),
            "Hue": this.sendHueCommand.bind(this),
        };
    }

    // Increment API request count
    incrementApiRequestCount() {
        this.apiRequestCount++;
        this.setOutputData(0, this.apiRequestCount);
    }

    // Send command to Hue devices
    sendHueCommand(device) {
        return new Promise((resolve, reject) => {
            const light = device.lights[0];
            const bodyData = {
                on: device.command === "turn_on",
                hue: Math.round(light.hsv.hue * 65535),
                sat: Math.round(light.hsv.saturation * 254),
                bri: Math.round(light.hsv.brightness)
            };

            // Compare current and last sent commands for Hue
            const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
            if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
                //console.log(`Skipping duplicate command for Hue light ${light.light_id}`);
                resolve();
                return;
            }

            const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

            fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                console.log(`Hue Light ${light.light_id} updated successfully with state: ${device.command}`);
                this.lastSentCommand[device.device_type + light.light_id] = bodyData;
                this.incrementApiRequestCount();
                resolve();
            })
            .catch(error => {
                console.error(`Error updating Hue light ${light.light_id}: ${error.message}`);
                resolve();  // Continue processing
            });
        });
    }

    // Send command to Govee devices
    sendGoveeCommand(device) {
        return new Promise((resolve, reject) => {
            const light = device.lights[0];
            const bodyData = {
                device: device.device_id,
                model: device.model,
                cmd: device.command === "turn_on" ? 
                     { name: "color", value: light.color } : 
                     { name: "turn", value: "off" }
            };

            // Compare current and last sent commands for Govee
            const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
            if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
                console.log(`Skipping duplicate command for Govee light ${light.light_id}`);
                resolve();
                return;
            }

            const url = `https://developer-api.govee.com/v1/devices/control`;

            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': device.api_key
                },
                body: JSON.stringify(bodyData)
            })
            .then(response => {
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10) * 1000;
                    console.log(`Rate limit exceeded, retrying after ${retryAfter} ms`);
                    setTimeout(() => {
                        this.sendGoveeCommand(device);
                    }, retryAfter);
                    reject(`Rate limited, retry after ${retryAfter} ms`);
                } else if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                console.log(`Govee device ${light.light_id} updated successfully with state: ${device.command}`);
                this.lastSentCommand[device.device_type + light.light_id] = bodyData;
                this.incrementApiRequestCount();
                resolve();
            })
            .catch(error => {
                console.error(`Failed to send command to Govee device: ${error}`);
                resolve();  // Continue processing
            });
        });
    }

    onExecute() {
        if (!this.properties.enable) {
            return;
        }

        const lightInfo = this.getInputData(0);
        if (lightInfo && lightInfo.devices) {
            lightInfo.devices.forEach(device => {
                const handler = this.deviceHandlers[device.device_type];
                if (handler) {
                    handler(device);
                } else {
                    console.error(`Unknown device type: ${device.device_type}`);
                }
            });
        }

        // Update the API call count
        this.setOutputData(0, this.apiRequestCount);
    }
}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);






/*
// Complete working version for both lights
class ExecuteTestNode extends LiteGraph.LGraphNode {
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

        this.deviceHandlers = {
            "Govee": this.handleGoveeDevice.bind(this),
            "Hue": this.handleHueDevice.bind(this),
            "default": this.handleUnknownDevice  // Default handler for unsupported device types
        };
    }

    // Increment the API request count and update the label
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

    // Function to handle Govee light control with rate limiting
    handleGoveeDevice(device, state) {
        const light = device.lights[0];
        const color = light.color || { r: 255, g: 255, b: 255 };  // Default to white if color is missing
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        // Check if the new command is different from the last sent command
        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Govee light ${light.light_id}`);
            return;  // Skip if it's the same command as the last one
        }

        this.updateLog(`Queueing command to Govee API: ${JSON.stringify(bodyData)}`);

        // Add delay to avoid rate limiting (600ms delay between each call)
        const delay = (this.apiRequestCount % 10) * 600;

        setTimeout(() => {
            fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Govee-API-Key': device.api_key
                },
                body: JSON.stringify(bodyData)
            })
            .then(response => {
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                    this.updateLog(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                    return Promise.reject({ retryAfter });
                }
                return response.json();
            })
            .then(responseData => {
                this.updateLog(`Govee Light ${light.light_id} - Command triggered successfully.`);
                this.lastSentCommand[device.device_type + light.light_id] = bodyData;  // Store last sent command
                this.incrementApiRequestCount();  // Increment the API request count when successful

                // Track API call in the API Call Tracker node
                const apiCallTrackerNode = this.graph.findNodesByType("Utility/api_call_tracker")[0];
                if (apiCallTrackerNode) {
                    apiCallTrackerNode.trackAPICall();
                }
            })
            .catch(error => {
                this.updateLog(`Error triggering command for Govee Light ${light.light_id}: ${error.message}`);
            });
        }, delay);  // Delay the request by a calculated amount of time
    }



    // Modularized function to handle Hue light control
    handleHueDevice(device, state) {
        const light = device.lights[0];
        if (!light.hsv) {
            this.updateLog(`Skipping Hue light ${light.light_id}, missing HSV data.`);
            return;
        }

        const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

        const bodyData = {
            on: state,
            hue: Math.round(light.hsv.hue * 65535),
            sat: Math.round(light.hsv.saturation * 254),
            bri: Math.round(light.hsv.brightness)
        };

        // Check if the new command is different from the last sent command
        const lastCommand = this.lastSentCommand[device.device_type + light.light_id];
        if (lastCommand && JSON.stringify(lastCommand) === JSON.stringify(bodyData)) {
            this.updateLog(`Skipping duplicate command for Hue light ${light.light_id}`);
            return;  // Skip if it's the same command as the last one
        }

        this.updateLog(`Sending HTTP request to: ${url} with body: ${JSON.stringify(bodyData)}`);

        fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.updateLog(`Hue Light ${light.light_id} updated successfully with state: ${state ? "On" : "Off"}`);
            this.lastSentCommand[device.device_type + light.light_id] = bodyData;  // Store last sent command
            this.incrementApiRequestCount();  // Increment the API request count when successful
        })
        .catch(error => {
            this.updateLog(`Error updating Hue light ${light.light_id}: ${error.message}`);
        });
    }

    // Check if state or color has changed
    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState || !this.lastColor || 
            color.r !== this.lastColor.r || 
            color.g !== this.lastColor.g || 
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

    // Queue and process Govee light commands
    queueCommand(device, state, color) {
        const now = Date.now();

        // Only allow a command every 1 second (rate-limiting)
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            this.updateLog("Command blocked due to cooldown.");
            return;  // Block the command if cooldown hasn't passed
        }

        this.lastCommandTimestamp = now;

        this.commandQueue.push({ device, state, color });
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { device, state, color } = this.commandQueue.shift();  // Process first in queue

        if (device.device_type === "Govee") {
            this.sendGoveeCommand(device, state, color).then(() => {
                this.processQueue();  // Process next in queue
            });
        } else if (device.device_type === "Hue") {
            this.sendHueCommand(device, state).then(() => {
                this.processQueue();  // Process next in queue
            });
        }

        this.debounceTimeout = null;  // Reset debounce timeout
    }

    onExecute() {
        const now = Date.now();

        // Throttle the log messages to only appear every 5 seconds
        if (now - this.lastLogTimestamp < 5000) {
            return;
        }

        this.lastLogTimestamp = now;  // Update the last log time

        if (!this.properties.enable) {
            return;  // Skip if node is disabled
        }

        const lightInfo = this.getInputData(0);  // Get light info

        // Log the data received from the Trigger node for inspection
        this.updateLog(`Data received from Trigger node: ${JSON.stringify(lightInfo)}`);

        if (!lightInfo || !Array.isArray(lightInfo.devices) || lightInfo.devices.length === 0) {
            return;  // Skip logging for invalid or empty devices
        }

        clearTimeout(this.debounceTimeout);  // Reset debounce timeout

        // Delay the execution of changes by debounce delay (500ms)
        this.debounceTimeout = setTimeout(() => {
            lightInfo.devices.forEach((device) => {
                // Log the full device object to inspect it
                this.updateLog(`Full device info: ${JSON.stringify(device)}`);

                // Identify Govee lights or Hue lights
                if (device.model && device.model.startsWith('H6008')) {  
                    // Check explicitly for Govee model H6008
                    device.device_type = 'Govee';  
                } else if (device.bridge_ip && device.api_key) {  
                    // If it has bridge_ip and api_key, assume it's Hue
                    device.device_type = 'Hue';  
                } else if (!device.device_type) {
                    device.device_type = 'Govee';  // Default to Govee for now, based on your previous logic
                }

                this.updateLog(`Device type after detection: ${device.device_type}`);

                if (!device.lights || device.lights.length === 0) {
                    return;  // Skip logging for invalid or empty lights
                }

                const state = device.command === 'turn_on';

                // Handle device commands based on the device type
                if (this.deviceHandlers[device.device_type]) {
                    this.deviceHandlers[device.device_type].call(this, device, state);
                } else {
                    this.updateLog(`Unsupported or unknown device type: ${device.device_type}`);
                    this.deviceHandlers["default"].call(this, device, state);
                }
            });
        }, this.debounceDelay);  // Apply debounce delay

        // Continuously update the API call count output
        this.setOutputData(0, this.apiRequestCount);  // Ensure output is updated on each execute
    }
}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);





















//working version with Hue
//ExecuteTestNode
class ExecuteTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Test";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "object");  // Input must match "object"

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        // Initialize logging area and state tracking
        this.logArea = document.getElementById('log-panel');

        this.lastState = null;  // To track the last state
        this.lastHsvs = {};  // Track last HSV values per light

        // Only Hue for now
        this.deviceHandlers = {
            "Hue": this.handleHueDevice
        };
    }

    updateLog(message) {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${message}`;
        
        if (this.logArea) {
            this.logArea.innerHTML += `${logMessage}<br>`;
            this.logArea.scrollTop = this.logArea.scrollHeight; // Auto-scroll to the bottom
        }
        console.log(logMessage);  // Log to console for easier inspection
    }

    // Modularized function to handle Hue light control
    handleHueDevice(device, state) {
        device.lights.forEach(light => {
            if (light.light_id && device.bridge_ip && device.api_key) {
                const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

                const bodyData = {
                    on: state,  // Use the mapped state (true for On, false for Off)
                    hue: Math.round(light.hsv.hue * 65535),
                    sat: Math.round(light.hsv.saturation * 254),
                    bri: Math.round(light.hsv.brightness)
                };

                this.updateLog(`Sending HTTP request to: ${url} with body: ${JSON.stringify(bodyData)}`);

                fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.updateLog(`Light ${light.light_id} updated successfully with state: ${state ? "On" : "Off"}`);
                })
                .catch(error => {
                    this.updateLog(`Error updating Hue light ${light.light_id}: ${error.message}`);
                });
            } else {
                this.updateLog(`Missing bridge_ip or api_key for Hue light ${light.light_id}`);
            }
        });
    }

    onExecute() {
        if (!this.properties.enable) {
            return;  // Skip if node is disabled
        }

        const lightInfo = this.getInputData(0);  // Get light info

        if (!lightInfo || !Array.isArray(lightInfo.devices) || lightInfo.devices.length === 0) {
            return;  // Skip logging for invalid or empty devices
        }

        const device = lightInfo.devices[0];  // Assume one device for now
        if (!device.lights || device.lights.length === 0) {
            return;  // Skip logging for invalid or empty lights
        }

        const state = device.command === 'turn_on';

        let shouldUpdate = false;
        device.lights.forEach(light => {
            const lastHsv = this.lastHsvs[light.light_id] || {};
            const hsvChanged =
                light.hsv.hue !== lastHsv.hue ||
                light.hsv.saturation !== lastHsv.saturation ||
                light.hsv.brightness !== lastHsv.brightness;

            if (hsvChanged || state !== this.lastState) {
                this.lastHsvs[light.light_id] = { ...light.hsv };
                this.lastState = state;
                shouldUpdate = true;
            }
        });

        // If no changes, skip further actions
        if (!shouldUpdate) {
            return;
        }

        // Handle device commands
        if (this.deviceHandlers[device.device_type]) {
            this.deviceHandlers[device.device_type].call(this, device, state);
        } else {
            this.updateLog(`Unsupported device type: ${device.device_type}`);
        }
    }

    configure(data) {
        super.configure(data);
        this.properties.enable = false;
    }
}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);






//Where we were before we got the Govee only working
class ExecuteTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Test";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "object");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        // Initialize logging area and state tracking
        this.logArea = document.getElementById('log-panel');
        this.lastState = null;
        this.lastHsvs = {};
        this.lastLogTimestamp = 0;

        this.deviceHandlers = {
            "Hue": this.handleHueDevice,
            "Govee": this.handleGoveeDevice,
            "default": this.handleUnknownDevice  // Optional default handler for unsupported device types
        };
    }

    updateLog(message) {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${message}`;

        if (this.logArea) {
            this.logArea.innerHTML += `${logMessage}<br>`;
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }
        console.log(logMessage);
    }

    // Modularized function to handle Govee light control
    handleGoveeDevice(device, state) {
        device.lights.forEach(light => {
            let color = { r: 255, g: 255, b: 255 };  // Default white

            // Use color data for Govee lights (since Govee uses RGB, not HSV)
            if (light.color && light.color.r !== undefined && light.color.g !== undefined && light.color.b !== undefined) {
                color = light.color;
                this.updateLog(`Using RGB color for Govee light ${light.light_id}: r=${color.r}, g=${color.g}, b=${color.b}`);
            } else {
                this.updateLog(`Missing RGB color data for Govee light ${light.light_id}, using default white.`);
            }

            // Log the state and the calculated color
            this.updateLog(`Processing Govee light ${light.light_id} with state: ${state ? "On" : "Off"} and color: r=${color.r}, g=${color.g}, b=${color.b}`);

            // Only send the command if the state or color has changed
            if (this.hasStateOrColorChanged(state, color)) {
                const command = {
                    light_id: light.light_id,
                    color: color,  // Send the calculated color
                    state: state
                };

                // Log the command that is being sent
                this.updateLog(`Sending command to Govee API: ${JSON.stringify(command)}`);

                // Simulate the command being sent (Replace with actual API call if needed)
                this.queueCommand(device, state, color);
            } else {
                this.updateLog(`No change detected for Govee light ${light.light_id}, skipping update.`);
            }
        });
    }




    // Check if state or color has changed for Govee
    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState || !this.lastColor ||
            color.r !== this.lastColor.r ||
            color.g !== this.lastColor.g ||
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

    // Queue and process Govee light commands
    queueCommand(device, state, color) {
        const now = Date.now();

        // Only allow a command every 1 second (rate-limiting)
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            this.updateLog("Command blocked due to cooldown.");
            return;  // Block the command if cooldown hasn't passed
        }

        this.lastCommandTimestamp = now;

        this.commandQueue.push({ device, state, color });
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { device, state, color } = this.commandQueue.shift();

        this.sendGoveeCommand(device, state, color)
            .then(() => {
                this.isProcessing = false;
                if (this.retryTimeout) clearTimeout(this.retryTimeout);
                this.processQueue();
            })
            .catch((error) => {
                if (error.retryAfter) {
                    this.retryTimeout = setTimeout(() => {
                        this.isProcessing = false;
                        this.processQueue();
                    }, error.retryAfter);
                }
            });
    }

    sendGoveeCommand(device, state, color) {
        const light = device.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        this.updateLog(`Sending command to API: ${JSON.stringify(bodyData)}`);

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': device.api_key
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                this.updateLog(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                return Promise.reject({ retryAfter });
            }
            return response.json();
        })
        .then(responseData => {
            this.updateLog(`Govee Light ${light.light_id} - Command triggered successfully.`);
        })
        .catch(error => {
            if (error.retryAfter) {
                this.updateLog(`Govee Light ${light.light_id} - Rate limited, retrying in ${error.retryAfter}ms.`);
            } else {
                this.updateLog(`Govee Light ${light.light_id} - Error triggering command: ${error.message}`);
            }
        });
    }

    // HSV to RGB conversion, specific for Govee
    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    // Modularized function to handle Hue light control
    handleHueDevice(device, state) {
        device.lights.forEach(light => {
            const lastHsv = this.lastHsvs[light.light_id] || {};
            const hsvChanged =
                light.hsv.hue !== lastHsv.hue ||
                light.hsv.saturation !== lastHsv.saturation ||
                light.hsv.brightness !== lastHsv.brightness;

            if (hsvChanged || state !== this.lastState) {
                this.lastHsvs[light.light_id] = { ...light.hsv };
                this.lastState = state;

                if (light.light_id && device.bridge_ip && device.api_key) {
                    const url = `http://${device.bridge_ip}/api/${device.api_key}/lights/${light.light_id}/state`;

                    const bodyData = {
                        on: state,
                        hue: Math.round(light.hsv.hue * 65535),
                        sat: Math.round(light.hsv.saturation * 254),
                        bri: Math.round(light.hsv.brightness)
                    };

                    this.updateLog(`Sending HTTP request to: ${url} with body: ${JSON.stringify(bodyData)}`);

                    fetch(url, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bodyData)
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        this.updateLog(`Light ${light.light_id} updated successfully with state: ${state ? "On" : "Off"}`);
                    })
                    .catch(error => {
                        this.updateLog(`Error updating Hue light ${light.light_id}: ${error.message}`);
                    });
                } else {
                    this.updateLog(`Missing bridge_ip or api_key for Hue light ${light.light_id}`);
                }
            } else {
                this.updateLog(`No change detected for Hue light ${light.light_id}, skipping update.`);
            }
        });
    }

    // Default handler for unknown or unsupported devices
    handleUnknownDevice(device, state) {
        this.updateLog(`Unknown device type. No actions taken for device: ${device.device_name || device.model}`);

    }

    onExecute() {
        const now = Date.now();

        // Throttle the log messages to only appear every 5 seconds
        if (now - this.lastLogTimestamp < 5000) {
            return;
        }

        this.lastLogTimestamp = now;  // Update the last log time

        if (!this.properties.enable) {
            return;  // Skip if node is disabled
        }

        const lightInfo = this.getInputData(0);  // Get light info

        if (!lightInfo || !Array.isArray(lightInfo.devices) || lightInfo.devices.length === 0) {
            return;  // Skip logging for invalid or empty devices
        }

        const device = lightInfo.devices[0];  // Assume one device for now

        // Log the full device object to inspect it
        this.updateLog(`Full device info: ${JSON.stringify(device)}`);

        // Identify Govee lights or Hue lights
        if (device.device_name && device.device_name.includes('Govee')) {
            device.device_type = 'Govee';  // Set the type to 'Govee' for Govee lights
        } else if (device.model && device.model.startsWith('H6008')) {  // Explicitly check for Govee model H6008
            device.device_type = 'Govee';  // Set the type to 'Govee' for Govee models
        } else if (!device.device_type) {
            device.device_type = 'Hue';  // Default to Hue if no type is provided
        }

        this.updateLog(`Device type after detection: ${device.device_type}`);


        if (!device.lights || device.lights.length === 0) {
            return;  // Skip logging for invalid or empty lights
        }

        const state = device.command === 'turn_on';

        // Handle device commands based on the device type, use default handler if type not recognized
        if (this.deviceHandlers[device.device_type]) {
            this.deviceHandlers[device.device_type].call(this, device, state);
        } else {
            this.updateLog(`Unsupported or unknown device type: ${device.device_type}`);
            this.deviceHandlers["default"].call(this, device, state);
        }
    }

}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);






//working Govee only code
class ExecuteTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Execute Test";
        this.size = [400, 650];
        this.properties = { state: true, enable: false };

        this.addInput("Light Info", "object");

        this.addWidget("toggle", "Enable", this.properties.enable, (value) => {
            this.properties.enable = value;
        });

        // Initialize logging area and state tracking
        this.logArea = document.getElementById('log-panel');
        this.lastState = null;
        this.lastColor = {};
        this.lastLogTimestamp = 0;
        this.commandCooldown = 1000;  // 1-second cooldown
        this.lastCommandTimestamp = 0;
        this.commandQueue = [];
        this.isProcessing = false;

        this.deviceHandlers = {
            "Govee": this.handleGoveeDevice.bind(this), // Only Govee logic remains for now
            "default": this.handleUnknownDevice.bind(this)  // Default handler for unsupported device types
        };
    }

    updateLog(message) {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${message}`;

        if (this.logArea) {
            this.logArea.innerHTML += `${logMessage}<br>`;
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }
        console.log(logMessage);
    }

    // Modularized function to handle Govee light control
    handleGoveeDevice(device, state) {
        device.lights.forEach(light => {
            let color = { r: 255, g: 255, b: 255 };  // Default white

            // Use color data for Govee lights (Govee uses RGB, not HSV)
            if (light.color && light.color.r !== undefined && light.color.g !== undefined && light.color.b !== undefined) {
                color = light.color;
                this.updateLog(`Using RGB color for Govee light ${light.light_id}: r=${color.r}, g=${color.g}, b=${color.b}`);
            } else {
                this.updateLog(`Missing RGB color data for Govee light ${light.light_id}, using default white.`);
            }

            // Log the state and the calculated color
            this.updateLog(`Processing Govee light ${light.light_id} with state: ${state ? "On" : "Off"} and color: r=${color.r}, g=${color.g}, b=${color.b}`);

            // Only send the command if the state or color has changed
            if (this.hasStateOrColorChanged(state, color)) {
                const command = {
                    light_id: light.light_id,
                    color: color,  // Send the calculated color
                    state: state
                };

                // Log the command that is being sent
                this.updateLog(`Sending command to Govee API: ${JSON.stringify(command)}`);

                // Simulate the command being sent (Replace with actual API call if needed)
                this.queueCommand(device, state, color);
            } else {
                this.updateLog(`No change detected for Govee light ${light.light_id}, skipping update.`);
            }
        });
    }

    // Check if state or color has changed for Govee
    hasStateOrColorChanged(state, color) {
        if (state !== this.lastState ||
            color.r !== this.lastColor.r ||
            color.g !== this.lastColor.g ||
            color.b !== this.lastColor.b) {
            this.lastState = state;
            this.lastColor = color;
            return true;
        }
        return false;
    }

    // Queue and process Govee light commands
    queueCommand(device, state, color) {
        const now = Date.now();

        // Only allow a command every 1 second (rate-limiting)
        if (now - this.lastCommandTimestamp < this.commandCooldown) {
            this.updateLog("Command blocked due to cooldown.");
            return;  // Block the command if cooldown hasn't passed
        }

        this.lastCommandTimestamp = now;
        this.commandQueue.push({ device, state, color });

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { device, state, color } = this.commandQueue.shift();

        this.sendGoveeCommand(device, state, color)
            .then(() => {
                this.isProcessing = false;
                if (this.retryTimeout) clearTimeout(this.retryTimeout);
                this.processQueue();
            })
            .catch((error) => {
                if (error.retryAfter) {
                    this.retryTimeout = setTimeout(() => {
                        this.isProcessing = false;
                        this.processQueue();
                    }, error.retryAfter);
                }
            });
    }

    sendGoveeCommand(device, state, color) {
        const light = device.lights[0];
        const url = `https://developer-api.govee.com/v1/devices/control`;

        const bodyData = {
            device: light.light_id,
            model: light.model,
            cmd: state ? { name: "color", value: color } : { name: "turn", value: "off" }
        };

        this.updateLog(`Sending command to API: ${JSON.stringify(bodyData)}`);

        return fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': device.api_key
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => {
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || 1, 10) * 1000;
                this.updateLog(`Rate limit exceeded, retrying after ${retryAfter}ms.`);
                return Promise.reject({ retryAfter });
            }
            return response.json();
        })
        .then(responseData => {
            this.updateLog(`Govee Light ${light.light_id} - Command triggered successfully.`);
        })
        .catch(error => {
            if (error.retryAfter) {
                this.updateLog(`Govee Light ${light.light_id} - Rate limited, retrying in ${error.retryAfter}ms.`);
            } else {
                this.updateLog(`Govee Light ${light.light_id} - Error triggering command: ${error.message}`);
            }
        });
    }

    // Default handler for unknown or unsupported devices
    handleUnknownDevice(device, state) {
        this.updateLog(`Unknown device type. No actions taken for device: ${device.device_name || device.model}`);
    }

    onExecute() {
        const now = Date.now();

        // Throttle the log messages to only appear every 5 seconds
        if (now - this.lastLogTimestamp < 5000) {
            return;
        }

        this.lastLogTimestamp = now;  // Update the last log time

        if (!this.properties.enable) {
            return;  // Skip if node is disabled
        }

        const lightInfo = this.getInputData(0);  // Get light info

        // Log the data received from the Trigger node for inspection
        this.updateLog(`Data received from Trigger node: ${JSON.stringify(lightInfo)}`);

        if (!lightInfo || !Array.isArray(lightInfo.devices) || lightInfo.devices.length === 0) {
            return;  // Skip logging for invalid or empty devices
        }

        const device = lightInfo.devices[0];  // Assume one device for now

        // Log the full device object to inspect it
        this.updateLog(`Full device info: ${JSON.stringify(device)}`);

        // Identify Govee lights or Hue lights
        if (device.model && device.model.startsWith('H6008')) {  // Explicitly check for Govee model H6008
            device.device_type = 'Govee';  // Set the type to 'Govee' for Govee models
        } else if (!device.device_type) {
            device.device_type = 'Govee';  // Default to Govee for now, remove Hue logic
        }

        this.updateLog(`Device type after detection: ${device.device_type}`);

        if (!device.lights || device.lights.length === 0) {
            return;  // Skip logging for invalid or empty lights
        }

        const state = device.command === 'turn_on';

        // Handle device commands based on the device type
        if (this.deviceHandlers[device.device_type]) {
            this.deviceHandlers[device.device_type].call(this, device, state);
        } else {
            this.updateLog(`Unsupported or unknown device type: ${device.device_type}`);
            this.deviceHandlers["default"].call(this, device, state);
        }
    }

}

LiteGraph.registerNodeType("Execution/execute_test", ExecuteTestNode);















*/
