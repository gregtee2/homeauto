
//GTP 4.0 Code 
class GoveeLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Govee Light Plus";
        this.size = [336, 127];

        this.defaultColor = { r: 255, g: 223, b: 196 };

        // Initialize properties
        this.properties = {
            device_id: "",
            device_name: "Select Device",
            device_model: "",
            brightness: 100,
            color: this.defaultColor,
            api_key: localStorage.getItem("govee_api_key") || "",  // Load API key from localStorage
            devices_fetched: false,
            manual_state: true,
            last_hsv: null,
            force_command: false,
        };

        this.requestCount = 0;  // Initialize request counter
        this.requestQueue = [];  // Queue to hold requests when limit is reached
        this.requestInterval = 60000;  // 60 seconds (1 minute)
        this.apiRequestInProgress = false;  // Track if an API request is currently being made

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        // Add device selection and manual on/off widget
        this.deviceWidget = this.addWidget("combo", "Device", this.properties.device_name, this.onDeviceSelected.bind(this), { values: ["Select Device"] });
        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`GoveeLightControlNode - Manual state toggled to: ${value ? "On" : "Off"}`);
        });

        // Add refresh button to fetch new devices
        this.addWidget("button", "Refresh Devices", null, () => {
            localStorage.removeItem('goveeDeviceList'); // Clear cached device list
            this.scheduleApiRequest();  // Fetch new device list
        });

        // Check if API key is already stored
        const apiKeyRecorded = this.properties.api_key !== "";
        this.apiKeyWidget = this.addWidget("button", apiKeyRecorded ? "API Key Recorded" : "Enter API Key", "", this.onApiKeyEntry.bind(this));

        this.lastColor = this.defaultColor;
        this.lastHSV = null;
        this.debounceTimeout = null;

        this.updateColorSwatch = this.updateColorSwatch.bind(this);
        this.onDeviceSelected = this.onDeviceSelected.bind(this);

        // Start the rate limit timer
        this.startRateLimitTimer();

        // Fetch devices if the API key exists
        if (this.properties.api_key) {
            this.loadDevicesFromCache();
        } else {
            console.error("API Key is missing. Please enter the API key.");
        }
    }

    startRateLimitTimer() {
        setInterval(() => {
            console.log("Resetting request counter.");
            this.requestCount = 0;
            this.processQueue();  // Process any queued requests
        }, this.requestInterval);
    }

    processQueue() {
        while (this.requestQueue.length > 0 && this.requestCount < 10) {
            const request = this.requestQueue.shift();
            request();  // Execute the queued request
        }
    }

    addRequestToQueue(requestFunction) {
        if (this.requestCount < 10 && !this.apiRequestInProgress) {
            this.apiRequestInProgress = true;  // Mark that an API request is in progress
            requestFunction();  // Send request immediately
        } else {
            console.log("Rate limit exceeded, queuing request.");
            this.requestQueue.push(requestFunction);  // Queue the request
        }
    }

    scheduleApiRequest() {
        if (this.apiRequestInProgress) {
            console.log("API request already in progress, waiting...");
            setTimeout(() => this.scheduleApiRequest(), 1000);  // Retry in 1 second
        } else {
            this.fetchAndAddDeviceDropdown();
        }
    }

    // Load devices from cache first, fetch from API if not available
    loadDevicesFromCache() {
        let cachedDevices = localStorage.getItem('goveeDeviceList');
        if (cachedDevices) {
            this.deviceOptions = JSON.parse(cachedDevices);
            console.log("Using cached device list:", this.deviceOptions);
            this.populateDeviceDropdown(this.deviceOptions);

            // Auto-select the first device or use the previously saved one
            if (!this.properties.device_id && this.deviceOptions.length > 0) {
                this.onDeviceSelected(this.deviceOptions[0].name);
            } else if (this.properties.device_name) {
                this.onDeviceSelected(this.properties.device_name); // Auto-reselect saved device
            }
            return; // Skip API call if cache is available
        }
        // No cached data, fetch from API
        this.scheduleApiRequest();
    }

    // Fetch devices from API
    async fetchAndAddDeviceDropdown() {
        const url = `https://developer-api.govee.com/v1/devices`;
        console.log("Fetching devices from:", url);

        // Check if the last API call was too recent
        const lastCallTime = localStorage.getItem('lastGoveeAPICall');
        const now = new Date().getTime();

        if (lastCallTime && (now - lastCallTime) < 60000) {
            console.log("API call blocked to avoid too frequent requests.");
            return;
        }

        this.addRequestToQueue(async () => {
            try {
                this.requestCount++;
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Govee-API-Key": this.properties.api_key
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log("Fetched device data:", data);

                this.deviceOptions = data.data.devices.map(device => ({
                    id: device.device,
                    name: device.deviceName,
                    model: device.model
                }));

                if (this.deviceOptions.length === 0) {
                    console.error('No devices found');
                    return;
                }

                this.deviceWidget.options.values = this.deviceOptions.map(device => device.name);

                if (!this.properties.device_id) {
                    this.onDeviceSelected(this.deviceOptions[0].name);
                } else {
                    this.onDeviceSelected(this.properties.device_name);
                }

                // Cache the device list and update last call time
                localStorage.setItem('goveeDeviceList', JSON.stringify(this.deviceOptions)); // Save light names to cache
                localStorage.setItem('lastGoveeAPICall', now);
                this.properties.devices_fetched = true;
                this.apiRequestInProgress = false;

            } catch (error) {
                console.error('Error fetching devices:', error);
                this.apiRequestInProgress = false;
            }
        });
    }

    populateDeviceDropdown(devices) {
        let deviceOptions = devices.map(device => device.name);
        this.deviceWidget.options.values = deviceOptions;

        if (deviceOptions.length > 0) {
            this.properties.device_name = deviceOptions[0];
        }
    }

    // Handle device selection
    onDeviceSelected(selectedDevice) {
        if (!this.deviceOptions) {
            console.error("Device options not yet available.");
            return;
        }

        const selected = this.deviceOptions.find(device => device.name === selectedDevice);
        if (selected) {
            this.properties.device_id = selected.id;
            this.properties.device_name = selected.name;
            this.properties.device_model = selected.model;
            this.title = `Govee Light - ${this.properties.device_name}`;
            this.deviceWidget.value = this.properties.device_name;
            this.updateColorSwatch();
        } else {
            console.error("Selected device not found in device options.");
        }
    }

    // Function to handle API key entry from the user
    onApiKeyEntry() {
        const apiKey = prompt("Please enter your Govee API key:");
        if (apiKey) {
            this.properties.api_key = apiKey;
            localStorage.setItem("govee_api_key", apiKey);
            console.log("Govee API key stored in localStorage.");
            this.apiKeyWidget.name = "API Key Recorded";
            this.scheduleApiRequest();
        } else {
            console.error("API key input was cancelled or empty.");
        }
    }

    onExecute() {
        const now = Date.now();

        if (!this.properties.device_id || !this.properties.device_model) {
            console.error(`Missing device ID or model for Govee light.`);
            return;
        }

        let hsv = this.getInputData(0);
        if (hsv === undefined && this.lastHSV) {
            hsv = this.lastHSV;
            //console.log("Using last known HSV value:", hsv);
        }

        if (hsv !== undefined) {
            this.lastHSV = hsv;
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            const newColor = { r, g, b };

            if (JSON.stringify(newColor) !== JSON.stringify(this.lastColor)) {
                this.lastColor = newColor;

                if (this.debounceTimeout) {
                    clearTimeout(this.debounceTimeout);
                }

                this.debounceTimeout = setTimeout(() => {
                    this.properties.color = newColor;

                    let lightData = {
                        lights: [{
                            light_id: this.properties.device_id,
                            model: this.properties.device_model,
                            color: this.properties.color
                        }],
                        api_key: this.properties.api_key,
                        state: this.properties.manual_state,
                        force_command: true
                    };

                    this.setOutputData(0, lightData);
                    this.updateColorSwatch();
                }, 300);
            }
        }
    }

    updateColorSwatch() {
        if (!this.properties.device_id) {
            this.boxcolor = 'black';
            return;
        }

        const colorHex = this.rgbToHex(this.properties.color.r, this.properties.color.g, this.properties.color.b);
        this.boxcolor = colorHex;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

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

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    onDrawForeground(ctx) {
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }
}

LiteGraph.registerNodeType("govee/light_control", GoveeLightControlNode);




/*
//GTO o1 code
class GoveeLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Govee Light Control";
        this.size = [336, 127];
        this.defaultColor = { r: 255, g: 223, b: 196 };

        // Initialize properties
        this.properties = {
            device_id: "",
            device_name: "Select Device",
            device_model: "",
            brightness: 100,
            color: this.defaultColor,
            api_key: localStorage.getItem("govee_api_key") || "",
            devices_fetched: false,
            manual_state: true,
            last_hsv: null,
            force_command: false,
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        // UI Components: Device selection, Manual On/Off toggle, API key management
        this.deviceWidget = this.addWidget("combo", "Device", this.properties.device_name, this.onDeviceSelected.bind(this), { values: ["Select Device"] });
        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`Manual state toggled to: ${value ? "On" : "Off"}`);
        });
        this.addWidget("button", "Refresh Devices", null, () => {
            localStorage.removeItem('goveeDeviceList'); // Clear cache
            this.fetchDeviceList();
        });

        // Check API key presence
        this.apiKeyWidget = this.addWidget("button", this.properties.api_key ? "API Key Recorded" : "Enter API Key", "", this.promptApiKey.bind(this));

        // Load devices if API key exists
        if (this.properties.api_key) {
            this.loadDevicesFromCache();
        } else {
            console.error("API Key is missing. Please enter the API key.");
        }
    }

    // API Key prompt and storage
    promptApiKey() {
        const apiKey = prompt("Enter your Govee API key:");
        if (apiKey) {
            this.properties.api_key = apiKey;
            localStorage.setItem("govee_api_key", apiKey);
            this.apiKeyWidget.name = "API Key Recorded";
            this.fetchDeviceList();
        } else {
            console.error("API key input was canceled.");
        }
    }

    // Load devices from cache or fetch from API
    loadDevicesFromCache() {
        const cachedDevices = localStorage.getItem('goveeDeviceList');
        if (cachedDevices) {
            this.populateDeviceDropdown(JSON.parse(cachedDevices));
        } else {
            this.fetchDeviceList();
        }
    }

    async fetchDeviceList() {
        const url = `https://developer-api.govee.com/v1/devices`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Govee-API-Key": this.properties.api_key
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const devices = data.data.devices.map(device => ({
                id: device.device,
                name: device.deviceName,
                model: device.model
            }));

            localStorage.setItem('goveeDeviceList', JSON.stringify(devices));
            this.populateDeviceDropdown(devices);
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    }

    populateDeviceDropdown(devices) {
        this.deviceWidget.options.values = devices.map(device => device.name);
        this.onDeviceSelected(devices[0].name); // Auto-select first device
    }

    onDeviceSelected(deviceName) {
        const device = this.deviceWidget.options.values.find(d => d.name === deviceName);
        if (device) {
            this.properties.device_id = device.id;
            this.properties.device_name = device.name;
            this.properties.device_model = device.model;
        }
    }

    onExecute() {
        let hsv = this.getInputData(0);
        if (hsv) {
            this.last_hsv = hsv;
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            const lightData = {
                light_id: this.properties.device_id,
                model: this.properties.device_model,
                color: { r, g, b },
                brightness: hsv.brightness,
                state: this.properties.manual_state
            };
            this.setOutputData(0, lightData); // Send data to the Execute node
        }
    }

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
}

LiteGraph.registerNodeType("govee/light_control", GoveeLightControlNode);












//working backup
class GoveeLightControlNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Govee Light Plus";
        this.size = [336, 107];

        this.defaultColor = { r: 255, g: 223, b: 196 };

        this.properties = {
            device_id: "",
            device_name: "Select Device",
            device_model: "",
            brightness: 100,
            color: this.defaultColor,
            api_key: "36016e2f-60af-4306-9d64-cd12575ad464",
            devices_fetched: false,
            manual_state: true,
            last_hsv: null,
            force_command: false,
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Info", "light_info");

        this.deviceWidget = this.addWidget("combo", "Device", this.properties.device_name, this.onDeviceSelected.bind(this), { values: ["Select Device"] });
        this.addWidget("toggle", "Manual On/Off", this.properties.manual_state, (value) => {
            this.properties.manual_state = value;
            console.log(`GoveeLightControlNode - Manual state toggled to: ${value ? "On" : "Off"}`);
        });

        if (this.properties.api_key) {
            this.fetchAndAddDeviceDropdown();
        } else {
            console.error("API Key is missing. Please check your configuration.");
        }

        this.lastColor = this.defaultColor;
        this.lastHSV = null;  // Store the last HSV value received
        this.debounceTimeout = null;
        this.updateColorSwatch = this.updateColorSwatch.bind(this);
        this.onDeviceSelected = this.onDeviceSelected.bind(this);
    }

    onExecute() {
        const now = Date.now();

        if (!this.properties.device_id || !this.properties.device_model) {
            console.error(`Missing device ID or model for Govee light: ${this.properties.device_id}`);
            return;
        }

        // Fetch HSV input data
        let hsv = this.getInputData(0);

        // Use last known HSV if not receiving new data
        if (hsv === undefined && this.lastHSV) {
            hsv = this.lastHSV;
            console.log("GoveeLightControlNode - Using last known HSV value:", hsv);
        }

        if (hsv !== undefined) {
            // Update last HSV value
            this.lastHSV = hsv;

            // Convert HSV to RGB
            const [r, g, b] = this.hsvToRgb(hsv.hue, hsv.saturation, hsv.brightness / 255);
            const newColor = { r, g, b };

            // Check if color has changed
            if (JSON.stringify(newColor) !== JSON.stringify(this.lastColor)) {
                this.lastColor = newColor;

                // Debounce logic
                if (this.debounceTimeout) {
                    clearTimeout(this.debounceTimeout);
                }

                this.debounceTimeout = setTimeout(() => {
                    this.properties.color = newColor;

                    // Prepare light data for output
                    let lightData = {
                        lights: [{
                            light_id: this.properties.device_id,
                            model: this.properties.device_model,
                            color: this.properties.color
                        }],
                        api_key: this.properties.api_key,
                        state: this.properties.manual_state,
                        force_command: true
                    };

                    // Send the light data to the output
                    this.setOutputData(0, lightData);
                    this.updateColorSwatch();

                    // Log color update
                    if (now - this.properties.lastLogTime > this.properties.logInterval) {
                        this.logEvent(`Color updated after debounce: ${JSON.stringify(this.properties.color)}`);
                        this.properties.lastLogTime = now;
                    }

                }, 300); // Adjust the debounce delay as needed
            }
        } else {
            // Send the existing color if HSV is undefined
            let lightData = {
                lights: [{
                    light_id: this.properties.device_id,
                    model: this.properties.device_model,
                    color: this.properties.color
                }],
                api_key: this.properties.api_key,
                state: this.properties.manual_state
            };

            this.setOutputData(0, lightData);
        }
    }

    isSignificantChange(newHSV, lastHSV) {
        if (!lastHSV) return true;

        const deltaHue = Math.abs(newHSV.hue - lastHSV.hue);
        const deltaSaturation = Math.abs(newHSV.saturation - lastHSV.saturation);
        const deltaBrightness = Math.abs(newHSV.brightness - lastHSV.brightness);

        return (
            deltaHue > this.minChangeThreshold ||
            deltaSaturation > this.minChangeThreshold ||
            deltaBrightness > this.minChangeThreshold
        );
    }

    updateColorSwatch() {
        if (!this.properties.device_id) {
            this.boxcolor = 'black';
            return;
        }

        const colorHex = this.rgbToHex(this.properties.color.r, this.properties.color.g, this.properties.color.b);
        this.boxcolor = colorHex;

        if (this.graph && this.graph.canvas) {
            this.graph.canvas.draw(true, true);
        }
    }

    onDeviceSelected(selectedDevice) {
        const selected = this.deviceOptions.find(device => device.name === selectedDevice);
        if (selected) {
            this.properties.device_id = selected.id;
            this.properties.device_name = selected.name;
            this.properties.device_model = selected.model;
            this.title = `Govee Light - ${this.properties.device_name}`;
            console.log(`Device selected: ID = ${selected.id}, Name = ${selected.name}, Model = ${selected.model}`);
            this.deviceWidget.value = this.properties.device_name;
            this.updateColorSwatch();
        } else {
            console.error("Selected device not found in device options.");
        }
    }

    async fetchAndAddDeviceDropdown() {
        const url = `https://developer-api.govee.com/v1/devices`;
        console.log("Fetching devices from:", url);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Govee-API-Key": this.properties.api_key
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Fetched device data:", data);

            this.deviceOptions = data.data.devices.map(device => ({
                id: device.device,
                name: device.deviceName,
                model: device.model
            }));

            if (this.deviceOptions.length === 0) {
                console.error('No devices found');
                return;
            }

            this.deviceWidget.options.values = this.deviceOptions.map(device => device.name);

            this.onDeviceSelected(this.deviceOptions[0].name);

            this.properties.devices_fetched = true;
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    }

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

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    onDrawForeground(ctx) {
        const swatchHeight = 20;
        ctx.fillStyle = this.boxcolor || 'black';
        ctx.fillRect(10, this.size[1] - swatchHeight - 10, this.size[0] - 20, swatchHeight);
    }
}

LiteGraph.registerNodeType("govee/light_control", GoveeLightControlNode);*/
