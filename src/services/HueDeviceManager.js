// File: src/services/HueDeviceManager.js

class HueDeviceManager {
    // Static method to get the singleton instance
    static getInstance() {
        if (!HueDeviceManager.instance) {
            HueDeviceManager.instance = new HueDeviceManager();
        }
        return HueDeviceManager.instance;
    }

    constructor() {
        // Prevent direct instantiation
        if (HueDeviceManager.instance) {
            return HueDeviceManager.instance;
        }

        this.devices = {}; // Stores all Hue devices with their IDs
        this.deviceManagerReady = false; // Flag indicating if devices are loaded
        this.onReadyCallbacks = []; // Callbacks to invoke when ready
        this.stateChangeCallbacks = []; // Callbacks for state changes
        this.selectedLightChangeCallbacks = []; // Callbacks for selected light changes

        this.bridgeIp = localStorage.getItem('bridgeIp') || '192.168.1.39'; // Default bridge IP
        this.apiKey = localStorage.getItem('apiKey') || 'YOUR_HUE_API_KEY'; // Default API key

        this.stateCache = new Map(); // Cache for device states with timestamps
        this.pollingInterval = 30000; // Poll every 30 seconds

        this.selectedLights = new Map(); // Map to hold selected light objects, keyed by light_id

        this.initHueDevices();

        // Assign the instance to the static property
        HueDeviceManager.instance = this;
    }

    /**
     * Initializes Hue devices by fetching them from the Hue Bridge.
     */
    async initHueDevices() {
        try {
            const response = await fetch(`http://${this.bridgeIp}/api/${this.apiKey}/lights`);
            if (!response.ok) throw new Error(`Hue Bridge responded with status ${response.status}`);
            const data = await response.json();

            for (const [id, light] of Object.entries(data)) {
                this.registerDevice({
                    light_id: id,
                    bridge_ip: this.bridgeIp,
                    api_key: this.apiKey,
                    light_name: light.name,
                    type: light.type,
                    modelid: light.modelid,
                    state: light.state
                });
                console.log(`HueDeviceManager - Registered Hue device: ${light.name} (ID: ${id})`);
            }

            this.deviceManagerReady = true;
            this.invokeReadyCallbacks();
            this.startPolling(); // Start polling for device states

            console.log("HueDeviceManager - Hue devices fetched and registered successfully.");
        } catch (error) {
            console.error("HueDeviceManager - Error fetching Hue devices:", error);
        }
    }

    /**
     * Invokes any registered callbacks once the device manager is ready.
     */
    invokeReadyCallbacks() {
        this.onReadyCallbacks.forEach(callback => callback());
        this.onReadyCallbacks = [];
    }

    /**
     * Registers a Hue device.
     * @param {object} config - Configuration object for the device.
     */
    registerDevice(config) {
        const hueLight = new window.HueLight(config);
        this.devices[config.light_id] = hueLight;
        console.log(`HueDeviceManager - Registered HueLight: Name=${hueLight.name}, ID=${hueLight.light_id}`);
    }

    /**
     * Retrieves a Hue device by its ID.
     * @param {string} lightId - The ID of the Hue Light.
     * @returns {HueLight|null} The HueLight instance or null if not found.
     */
    getDevice(lightId) {
        return this.devices[lightId] || null;
    }

    /**
     * Retrieves all Hue devices.
     * @returns {Array<HueLight>} Array of HueLight instances.
     */
    getDevices() {
        return Object.values(this.devices);
    }

    /**
     * Retrieves all selected Hue lights.
     * @returns {Array<HueLight>} Array of selected HueLight instances.
     */
    getSelectedLights() {
        return Array.from(this.selectedLights.values());
    }

    /**
     * Sets the light state (on/off) for a specific Hue Light.
     * @param {string} lightId - The ID of the Hue Light.
     * @param {boolean} state - Desired state: true for On, false for Off.
     * @returns {Promise<void>}
     */
    async setLightState(lightId, state) {
        const device = this.getDevice(lightId);
        if (!device) {
            throw new Error(`HueDeviceManager - Device with ID ${lightId} not found.`);
        }

        console.log(`HueDeviceManager - setLightState called for Light ID ${lightId} with state=${state}`);
        return await device.turnOn(state);
    }

    /**
     * Sets the color of a specific Hue Light based on HSV values.
     * @param {string} lightId - The ID of the Hue Light.
     * @param {object} hsv - Object containing hue, saturation, and brightness.
     * @returns {Promise<void>}
     */
    async setLightColor(lightId, hsv) {
        const device = this.getDevice(lightId);
        if (!device) {
            throw new Error(`HueDeviceManager - Device with ID ${lightId} not found.`);
        }

        console.log(`HueDeviceManager - setLightColor called for Light ID ${lightId} with HSV:`, hsv);
        return await device.setColor(hsv);
    }

    /**
     * Polls device states periodically and caches them.
     */
    async startPolling() {
        setInterval(async () => {
            for (const device of this.getDevices()) {
                try {
                    const previousState = this.stateCache.get(device.light_id)?.state;
                    const currentState = await this.getLightState(device.light_id);

                    // Compare with cached state to detect changes
                    if (!previousState || JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                        this.stateCache.set(device.light_id, { state: currentState, timestamp: Date.now() });
                        this.notifyStateChange(device.light_id, currentState);
                    }
                } catch (error) {
                    console.error(`HueDeviceManager - Error polling device ${device.light_id}:`, error);
                }
            }
        }, this.pollingInterval);
    }

    /**
     * Fetches the state of a specific Hue light.
     * First, checks the cache, and if not found or outdated, fetches from the bridge.
     * @param {string} lightId - The ID of the Hue Light.
     * @returns {Promise<object>} The light state object.
     */
    async getLightState(lightId) {
        const CACHE_DURATION_MS = 5000; // 5 seconds cache duration
        const cachedState = this.stateCache.get(lightId);

        // Check if the cached state exists and is still valid
        if (cachedState && (Date.now() - cachedState.timestamp < CACHE_DURATION_MS)) {
            console.log(`HueDeviceManager - Returning cached state for device ${lightId}`);
            return cachedState.state;
        }

        // Fallback to fetching state from bridge if cache is invalid or not found
        try {
            const response = await fetch(`http://${this.bridgeIp}/api/${this.apiKey}/lights/${lightId}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch light state: ${response.statusText}`);
            }

            const lightState = await response.json();

            // Check if state has changed before updating the cache
            const previousState = cachedState ? cachedState.state : null;
            if (JSON.stringify(previousState) !== JSON.stringify(lightState)) {
                this.stateCache.set(lightId, {
                    state: lightState,
                    timestamp: Date.now()
                });
                console.log(`HueDeviceManager - Fetched and cached light state for ${lightId}:`, lightState);
                this.notifyStateChange(lightId, lightState);
            } else {
                console.log(`HueDeviceManager - Light state for ${lightId} unchanged.`);
            }

            return lightState;
        } catch (error) {
            console.error(`HueDeviceManager - Error fetching light state for device ${lightId}:`, error);
            throw error;
        }
    }

    /**
     * Registers a callback to be invoked whenever a device's state changes.
     * @param {function} callback - The callback function with parameters (lightId, newState).
     */
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateChangeCallbacks.push(callback);
        } else {
            console.warn("HueDeviceManager - onStateChange callback is not a function.");
        }
    }

    /**
     * Notifies all registered state change callbacks about a device's state change.
     * @param {string} lightId - The ID of the Hue Light.
     * @param {object} newState - The new state of the device.
     */
    notifyStateChange(lightId, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(lightId, newState);
            } catch (error) {
                console.error(`HueDeviceManager - Error in stateChangeCallback for device ${lightId}:`, error);
            }
        });
    }

    /**
     * Registers a callback to be invoked when DeviceManager is ready.
     * @param {function} callback - The callback function.
     */
    onReady(callback) {
        if (this.deviceManagerReady) {
            callback();
        } else {
            this.onReadyCallbacks.push(callback);
        }
    }

    /**
     * Registers a callback to be invoked when the selected lights change.
     * @param {function} callback - The callback function with parameter (selectedLights).
     */
    onSelectedLightChange(callback) {
        if (typeof callback === 'function') {
            this.selectedLightChangeCallbacks.push(callback);
        } else {
            console.warn("HueDeviceManager - onSelectedLightChange callback is not a function.");
        }
    }

    /**
     * Notifies all registered selected light change callbacks about a change.
     */
    notifySelectedLightChange() {
        const selectedLightsArray = this.getSelectedLights();
        this.selectedLightChangeCallbacks.forEach(callback => {
            try {
                callback(selectedLightsArray);
            } catch (error) {
                console.error("HueDeviceManager - Error in selectedLightChangeCallback:", error);
            }
        });
    }

    /**
     * Adds a light to the selectedLights map and notifies listeners.
     * @param {object} light - The light object to add.
     */
    addSelectedLight(light) {
        // Ensure that only one instance of each light is added based on light_id
        if (!this.selectedLights.has(light.light_id)) {
            this.selectedLights.set(light.light_id, light);
            console.log(`HueDeviceManager - Added selected light: ${light.name} (ID: ${light.light_id})`);
            this.notifySelectedLightChange();
        } else {
            console.warn(`HueDeviceManager - Light ${light.name} (ID: ${light.light_id}) is already selected.`);
        }
    }

    /**
     * Removes a light from the selectedLights map and notifies listeners.
     * @param {string} lightId - The ID of the light to remove.
     */
    removeSelectedLight(lightId) {
        if (this.selectedLights.has(lightId)) {
            const removedLight = this.selectedLights.get(lightId);
            this.selectedLights.delete(lightId);
            console.log(`HueDeviceManager - Removed selected light: ${removedLight.name} (ID: ${removedLight.light_id})`);
            this.notifySelectedLightChange();
        } else {
            console.warn(`HueDeviceManager - Light ID ${lightId} is not in the selectedLights map.`);
        }
    }

    /**
     * Retrieves all available Hue lights.
     * @returns {Array<object>} Array of light objects with essential properties.
     */
    getAllLights() {
        return Object.values(this.devices).map(light => ({
            light_id: light.light_id,
            name: light.light_name,
            type: light.type,
            modelid: light.modelid,
            state: light.state
        }));
    }

    /**
     * Retrieves a specific light by its ID.
     * @param {string} id 
     * @returns {object|null}
     */
    getLightById(id) {
        return this.devices[id] || null;
    }

    /**
     * Updates the state of a specific light.
     * @param {string} id 
     * @param {object} newState 
     */
    updateLightState(id, newState) {
        const device = this.getDevice(id);
        if (device) {
            device.updateState(newState); // Assuming HueLight has an updateState method
            this.stateCache.set(id, { state: device.state, timestamp: Date.now() });
            this.notifyStateChange(id, device.state);
        } else {
            console.warn(`HueDeviceManager - Cannot update state. Light with ID ${id} does not exist.`);
        }
    }

    /**
     * Adds a new Hue light to the manager.
     * @param {object} light 
     */
    addLight(light) {
        if (!this.devices[light.light_id]) {
            this.registerDevice(light);
            this.stateCache.set(light.light_id, { state: light.state, timestamp: Date.now() });
            console.log(`HueDeviceManager - Added new light: ${light.light_name} (ID: ${light.light_id})`);
            this.notifyStateChange(light.light_id, light.state);
        } else {
            console.warn(`HueDeviceManager - Light with ID ${light.light_id} already exists.`);
        }
    }

    /**
     * Removes a Hue light from the manager.
     * @param {string} id 
     */
    removeLight(id) {
        if (this.devices[id]) {
            const removedLight = this.devices[id];
            delete this.devices[id];
            this.stateCache.delete(id);
            console.log(`HueDeviceManager - Removed light: ${removedLight.light_name} (ID: ${id})`);
            this.notifyStateChange(id, null);
            // Also remove from selectedLights if it's selected
            if (this.selectedLights.has(id)) {
                this.selectedLights.delete(id);
                this.notifySelectedLightChange();
            }
        } else {
            console.warn(`HueDeviceManager - Cannot remove. Light with ID ${id} does not exist.`);
        }
    }

    /**
     * Manually invalidates the cache for a specific device.
     * @param {string} lightId - The ID of the Hue Light.
     */
    invalidateCache(lightId) {
        if (this.stateCache.has(lightId)) {
            console.log(`HueDeviceManager - Invalidating cache for device ${lightId}`);
            this.stateCache.delete(lightId);
            // Optionally, fetch the state immediately after invalidation
            this.getLightState(lightId).catch(error => {
                console.error(`HueDeviceManager - Error fetching state after cache invalidation for device ${lightId}:`, error);
            });
        }
    }
}

// Create and attach the singleton instance to the global window object
if (!window.HueDeviceManager) {
    window.HueDeviceManager = HueDeviceManager.getInstance();
    console.log("HueDeviceManager - Initialized and attached to window.HueDeviceManager");
} else {
    console.log("HueDeviceManager - Already initialized.");
}
