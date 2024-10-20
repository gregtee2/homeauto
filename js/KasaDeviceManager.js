// File: src/services/KasaDeviceManager.js

class KasaDeviceManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api/kasa'; // Ensure this matches your backend URL
        this.lights = [];
        this.smartPlugs = [];
        this.deviceStateCache = new Map(); // Cache for device states with timestamps
        this.deviceManagerReady = false;
        this.readyCallbacks = [];
        this.stateChangeCallbacks = []; // List of callbacks for state changes
        this.pollingInterval = 30000; // Poll every 30 seconds
        this.initialize();
    }

    /**
     * Initializes the KasaDeviceManager by fetching devices from the backend.
     */
    async initialize() {
        try {
            await this.fetchDevices(); // Fetch both lights and smart plugs
            this.deviceManagerReady = true;
            this.invokeReadyCallbacks();
            console.log("KasaDeviceManager - Initialization complete.");
            this.startPolling(); // Start polling for device states
        } catch (error) {
            console.error("KasaDeviceManager - Error during initialization:", error);
        }
    }

    /**
     * Invokes any registered callbacks once the device manager is ready.
     */
    invokeReadyCallbacks() {
        this.readyCallbacks.forEach(callback => callback());
        this.readyCallbacks = [];
    }

    /**
     * Fetches all Kasa devices (lights and smart plugs) from the backend.
     * @returns {Promise<Array>} Combined array of lights and smart plugs.
     */
    async fetchDevices() {
        try {
            const [lights, smartPlugs] = await Promise.all([
                this.fetchLights(),
                this.fetchSmartPlugs()
            ]);
            const combinedDevices = [...lights, ...smartPlugs];
            console.log("KasaDeviceManager - All devices fetched:", combinedDevices);
            return combinedDevices;
        } catch (error) {
            console.error("KasaDeviceManager - Error fetching devices:", error);
            throw error;
        }
    }

    /**
     * Fetches all Kasa lights from the backend.
     * @returns {Promise<Array>} Array of lights.
     */
    async fetchLights() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights?timestamp=${Date.now()}`, { cache: 'no-store' });
            console.log("KasaDeviceManager - Fetch lights response status:", response.status);
            if (!response.ok) throw new Error(`Failed to fetch lights: ${response.statusText}`);
            const data = await response.json();
            console.log("KasaDeviceManager - Raw lights data:", data);
            this.lights = data;
            console.log("KasaDeviceManager - Lights fetched:", this.lights);
            return this.lights;
        } catch (error) {
            console.error("KasaDeviceManager - Error fetching lights:", error);
            throw error;
        }
    }

    /**
     * Fetches all Kasa smart plugs from the backend.
     * @returns {Promise<Array>} Array of smart plugs.
     */
    async fetchSmartPlugs() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs?timestamp=${Date.now()}`, { cache: 'no-store' });
            console.log("KasaDeviceManager - Fetch smart plugs response status:", response.status);
            if (!response.ok) throw new Error(`Failed to fetch smart plugs: ${response.statusText}`);
            const data = await response.json();
            console.log("KasaDeviceManager - Raw smart plugs data:", data);
            this.smartPlugs = data;
            console.log("KasaDeviceManager - Smart Plugs fetched:", this.smartPlugs);
            return this.smartPlugs;
        } catch (error) {
            console.error("KasaDeviceManager - Error fetching smart plugs:", error);
            throw error;
        }
    }

    /**
     * Retrieves a specific light by its ID.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {object|null} The light object or null if not found.
     */
    getLight(deviceId) {
        return this.lights.find(light => light.deviceId === deviceId) || null;
    }

    /**
     * Retrieves a specific smart plug by its ID.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {object|null} The smart plug object or null if not found.
     */
    getSmartPlug(deviceId) {
        return this.smartPlugs.find(plug => plug.deviceId === deviceId) || null;
    }

    /**
     * Turns on a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {Promise<void>}
     */
    async turnOnLight(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/on`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn on light: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned on light ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning on light ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Turns off a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {Promise<void>}
     */
    async turnOffLight(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/off`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn off light: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned off light ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning off light ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Sets the color of a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @param {object} hsv - { hue: 0-360, saturation: 0-100, brightness: 0-100 }
     * @returns {Promise<void>}
     */
    async setColor(deviceId, hsv) {
        try {
            // Validate HSV values
            const { hue, saturation, brightness } = hsv;
            if (
                typeof hue !== 'number' || hue < 0 || hue > 360 ||
                typeof saturation !== 'number' || saturation < 0 || saturation > 100 ||
                typeof brightness !== 'number' || brightness < 0 || brightness > 100
            ) {
                alert("Invalid HSV values entered.");
                throw new Error("Invalid HSV values.");
            }

            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/color`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hsv)
            });
            if (!response.ok) throw new Error(`Failed to set color: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Set color for light ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`KasaDeviceManager - Error setting color for light ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Turns on a specific Kasa smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {Promise<void>}
     */
    async turnOnSmartPlug(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/on`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn on smart plug: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned on smart plug ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning on smart plug ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Turns off a specific Kasa smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {Promise<void>}
     */
    async turnOffSmartPlug(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/off`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn off smart plug: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned off smart plug ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning off smart plug ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Fetches the energy usage of a specific Kasa smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {Promise<object>} Energy usage data.
     */
    async getSmartPlugEnergy(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/energy`);
            if (!response.ok) throw new Error(`Failed to fetch energy usage: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Energy usage for smart plug ${deviceId}:`, data);
            return data;
        } catch (error) {
            console.error(`KasaDeviceManager - Error fetching energy usage for smart plug ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Fetches the state of a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {Promise<object>} The light state object.
     */
    async getLightState(deviceId) {
        const CACHE_DURATION_MS = 30000; // 30 seconds cache duration
        const cachedState = this.deviceStateCache.get(deviceId);

        // Check if the cached state exists and is still valid
        if (cachedState && (Date.now() - cachedState.timestamp < CACHE_DURATION_MS)) {
            console.log(`KasaDeviceManager - Returning cached state for light ${deviceId}`);
            return cachedState.state;
        }

        // Fallback to fetching state from backend if cache is invalid or not found
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/state`);
            if (!response.ok) throw new Error(`Failed to fetch light state: ${response.statusText}`);
            const lightState = await response.json();

            // Check if state has changed before updating the cache
            const previousState = cachedState ? cachedState.state : null;
            if (JSON.stringify(previousState) !== JSON.stringify(lightState)) {
                this.deviceStateCache.set(deviceId, { state: lightState, timestamp: Date.now() });
                console.log(`KasaDeviceManager - Fetched and cached light state for ${deviceId}:`, lightState);
                this.notifyStateChange(deviceId, lightState);
            } else {
                console.log(`KasaDeviceManager - Light state for ${deviceId} unchanged.`);
            }

            return lightState;
        } catch (error) {
            console.error(`KasaDeviceManager - Error fetching light state for device ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Manually invalidates the cache for a specific device.
     * @param {string} deviceId - The ID of the Kasa device.
     */
    invalidateCache(deviceId) {
        if (this.deviceStateCache.has(deviceId)) {
            console.log(`KasaDeviceManager - Invalidating cache for device ${deviceId}`);
            this.deviceStateCache.delete(deviceId);
        }
    }

    /**
     * Allows registration of callbacks to be executed once the manager is ready.
     * @param {function} callback - The callback function.
     */
    onReady(callback) {
        if (this.deviceManagerReady) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Registers a callback to be executed whenever a device's state changes.
     * @param {function} callback - The callback function with parameters (deviceId, newState).
     */
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateChangeCallbacks.push(callback);
        } else {
            console.warn("KasaDeviceManager - onStateChange callback is not a function.");
        }
    }

    /**
     * Notifies all registered state change callbacks about a device's state change.
     * @param {string} deviceId - The ID of the Kasa device.
     * @param {object} newState - The new state of the device.
     */
    notifyStateChange(deviceId, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(deviceId, newState);
            } catch (error) {
                console.error(`KasaDeviceManager - Error in stateChangeCallback for device ${deviceId}:`, error);
            }
        });
    }

    /**
     * Polls device states periodically and updates the cache.
     */
    async startPolling() {
        setInterval(async () => {
            // Poll Lights
            for (const light of this.lights) {
                try {
                    const previousState = this.deviceStateCache.get(light.deviceId)?.state;
                    const currentState = await this.getLightState(light.deviceId);

                    // Compare previous and current state to detect changes
                    if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                        this.deviceStateCache.set(light.deviceId, { state: currentState, timestamp: Date.now() });
                        console.log(`Polled and cached state for light ${light.deviceId}:`, currentState);
                        this.notifyStateChange(light.deviceId, currentState);
                    } else {
                        console.log(`KasaDeviceManager - No state change for light ${light.deviceId}.`);
                    }
                } catch (error) {
                    console.error(`Error polling light ${light.deviceId}:`, error);
                }
            }

            // Poll Smart Plugs
            for (const plug of this.smartPlugs) {
                try {
                    const previousState = this.deviceStateCache.get(plug.deviceId)?.state;
                    const currentState = await this.getSmartPlugEnergy(plug.deviceId);

                    // Compare previous and current state to detect changes
                    if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                        this.deviceStateCache.set(plug.deviceId, { state: currentState, timestamp: Date.now() });
                        console.log(`KasaDeviceManager - Polled and cached state for smart plug ${plug.deviceId}:`, currentState);
                        this.notifyStateChange(plug.deviceId, currentState);
                    } else {
                        console.log(`KasaDeviceManager - No state change for smart plug ${plug.deviceId}.`);
                    }
                } catch (error) {
                    console.error(`Error polling smart plug ${plug.deviceId}:`, error);
                }
            }
        }, this.pollingInterval);
    }

    /**
     * Generic method to turn on a device (light or smart plug) based on device type.
     * @param {string} deviceId - The ID of the device.
     * @returns {Promise<void>}
     */
    async turnOn(deviceId) {
        const light = this.getLight(deviceId);
        if (light) {
            await this.turnOnLight(deviceId);
            return;
        }

        const smartPlug = this.getSmartPlug(deviceId);
        if (smartPlug) {
            await this.turnOnSmartPlug(deviceId);
            return;
        }

        throw new Error(`Device with ID ${deviceId} not found.`);
    }

    /**
     * Generic method to turn off a device (light or smart plug) based on device type.
     * @param {string} deviceId - The ID of the device.
     * @returns {Promise<void>}
     */
    async turnOff(deviceId) {
        const light = this.getLight(deviceId);
        if (light) {
            await this.turnOffLight(deviceId);
            return;
        }

        const smartPlug = this.getSmartPlug(deviceId);
        if (smartPlug) {
            await this.turnOffSmartPlug(deviceId);
            return;
        }

        throw new Error(`Device with ID ${deviceId} not found.`);
    }
}

// Initialize the KasaDeviceManager and attach it to the window object for global access
document.addEventListener('DOMContentLoaded', () => {
    window.KasaDeviceManager = new KasaDeviceManager();
    console.log("KasaDeviceManager - Initialized and attached to window.KasaDeviceManager");
});
