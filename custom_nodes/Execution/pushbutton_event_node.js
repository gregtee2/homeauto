class PushButtonEventNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Push Button Event";
        this.size = [300, 150];
        this.properties = {
            state: false,
            eventType: "turn_on",
            selectedDevices: []
        };

        this.addWidget("toggle", "State", this.properties.state, (v) => {
            this.properties.state = v;
        });

        // Load available devices on node creation (both Govee and Hue)
        this.loadAvailableDevices();
    }

    // Load available devices: Govee from local storage, Hue from API
    async loadAvailableDevices() {
        this.availableDevices = [];
        const hueApiKey = localStorage.getItem("apiKey");
        const bridgeIp = localStorage.getItem("bridgeIp");
        const goveeDeviceList = JSON.parse(localStorage.getItem("goveeDeviceList"));
        const goveeApiKey = localStorage.getItem("govee_api_key");

        console.log("Hue API Key:", hueApiKey, "Bridge IP:", bridgeIp);  // Debugging log

        // Fetch Hue devices if the API key and bridge IP are available
        if (hueApiKey && bridgeIp) {
            try {
                const hueDevices = await this.fetchHueDevices(hueApiKey, bridgeIp);
                this.availableDevices.push(...hueDevices);
                console.log("Hue devices fetched:", hueDevices);  // Debugging log
            } catch (error) {
                console.error("Error fetching Hue devices:", error);
            }
        } else {
            console.error("Hue API key or Bridge IP not found in local storage.");
        }

        // Use Govee devices from local storage
        if (goveeDeviceList && goveeDeviceList.length > 0) {
            goveeDeviceList.forEach(device => {
                this.availableDevices.push({
                    device_id: device.id,
                    name: device.name,
                    device_type: "Govee",
                    model: device.model,
                    api_key: goveeApiKey
                });
            });
            console.log("Govee devices fetched:", goveeDeviceList);  // Debugging log
        }

        // Create toggle fields for each device
        this.availableDevices.forEach((device) => {
            this.addWidget("toggle", device.name, false, (value) => {
                if (value) {
                    console.log(`PushButtonNode: Selected device: ${device.name}`);
                    this.properties.selectedDevices.push(device);
                } else {
                    const index = this.properties.selectedDevices.findIndex(d => d.device_id === device.device_id);
                    if (index > -1) {
                        console.log(`PushButtonNode: Deselected device: ${device.name}`);
                        this.properties.selectedDevices.splice(index, 1);
                    }
                }
                console.log("PushButtonNode: Selected devices:", this.properties.selectedDevices);
            });
        });

        this.setDirtyCanvas(true);
    }

    onMouseDown(e, pos) {
        if (pos[0] >= 0 && pos[0] <= this.size[0] && pos[1] >= 0 && pos[1] <= this.size[1]) {
            this.properties.state = !this.properties.state;
            this.setDirtyCanvas(true);

            // Publish the event to the Event Bus
            const eventData = {
                state: this.properties.state,
                devices: this.properties.selectedDevices.map(device => {
                    return {
                        device_id: device.device_id,
                        device_type: device.device_type,
                        command: this.properties.state ? "turn_on" : "turn_off",
                        bridge_ip: localStorage.getItem("bridgeIp"),  // Adding bridge IP
                        api_key: localStorage.getItem("apiKey"),  // Adding API key
                        lights: [
                            {
                                light_id: device.device_id,
                                hsv: { hue: 0.1, saturation: 0.17, brightness: 128 }  // Example HSV values
                            }
                        ]
                    };
                }),
                timestamp: new Date().toISOString(),
                source: this.title
            };

            console.log("Publishing event with lights and bridge info:", eventData);  // Log the event with lights and bridge info
            window.EventBus.publish(this.properties.eventType, eventData);  // Publish event to EventBus

            return true;
        }
        return false;
    }

    // Fetch Hue devices from the Hue Bridge API
    async fetchHueDevices(apiKey, bridgeIp) {
        const response = await fetch(`http://${bridgeIp}/api/${apiKey}/lights`);
        const data = await response.json();
        return Object.keys(data).map(deviceId => ({
            device_id: deviceId,
            name: data[deviceId].name,
            device_type: "Hue",
            model: data[deviceId].modelid
        }));
    }

    onDrawForeground(ctx) {
        ctx.fillStyle = this.properties.state ? "#6c6" : "#c66";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.properties.state ? "ON" : "OFF", this.size[0] * 0.5, this.size[1] * 0.5 + 7);
    }

    onLoad() {
        this.properties.state = false;
        this.setDirtyCanvas(true);
    }
}

// Make sure the node type registration is correct and without conflicts
LiteGraph.registerNodeType("Triggers/PushButtonEvent", PushButtonEventNode);






/*
//prior pushbutton code before event handler inserts
class PushButtonNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Simple On/Off";
        this.size = [200, 60];
        this.properties = { state: false };
        this.lastState = null; // Keep track of the last state
        this.debounceTimeout = null; // Timeout for debouncing

        this.addOutput("State", "boolean");
    }

    onExecute() {
        // Ensure lastState is initialized properly if it's the first run
        if (typeof this.lastState === 'undefined') {
            this.lastState = this.properties.state;
        }

        // Only trigger the output if the state has changed
        if (this.properties.state !== this.lastState) {
            console.log(`PushButtonNode - State change detected, processing...`);
            this.lastState = this.properties.state; // Update the last known state
            
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => {
                this.setOutputData(0, this.properties.state);
                console.log(`PushButtonNode - Outputting new state: ${this.properties.state}`);
                this.triggerSlot(0); // Trigger the connected node
            }, 500); // Adjust debounce delay as necessary
        } else {
            // Add condition to throttle "no change" logs
            if (!this.skipNoChangeLog) {
                //console.log(`PushButtonNode - No state change, skipping output.`);
                this.skipNoChangeLog = true;
                setTimeout(() => { this.skipNoChangeLog = false; }, 5000); // Log only every 5 seconds
            }
        }
    }






    onMouseDown(e, pos) {
        if (pos[0] >= 0 && pos[0] <= this.size[0] && pos[1] >= 0 && pos[1] <= this.size[1]) {
            this.properties.state = !this.properties.state;
            this.setDirtyCanvas(true); // Redraw the canvas
            this.onExecute();
            return true;
        }
        return false;
    }

    onDrawForeground(ctx) {
        ctx.fillStyle = this.properties.state ? "#6c6" : "#c66";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.properties.state ? "ON" : "OFF", this.size[0] * 0.5, this.size[1] * 0.5 + 7);
    }

    onLoad() {
        this.properties.state = false; // Reset state to "Off" on load
        this.setOutputData(0, this.properties.state);
        this.setDirtyCanvas(true); // Redraw the canvas
    }
}

LiteGraph.registerNodeType("Execution/pushbutton", PushButtonNode);*/
