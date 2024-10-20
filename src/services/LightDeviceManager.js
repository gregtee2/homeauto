// File: src/services/LightDeviceManager.js

class LightDeviceManager extends BaseDeviceManager {
    constructor() {
        super();
        this.apiBaseUrl = 'http://localhost:3000/api/kasa'; // Ensure this matches your backend URL
        this.lights = [];
        this.deviceStateCache = new Map(); // Cache for device states with timestamps
        this.deviceManagerReady = false;
        this.readyCallbacks = [];
        this.stateChangeCallbacks = []; // List of callbacks for state changes
        this.pollingInterval = 30000; // Poll every 30 seconds
        this.initialize();
    }

    /**
     * Initializes the LightDeviceManager by fetching lights from the backend.
     */
    async initialize() {
        try {
            await this.fetchDevices(); // Fetch lights
            this.deviceManagerReady = true;
            this.invokeReadyCallbacks();
            console.log("LightDeviceManager - Initialization complete.");
            this.startPolling(); // Start polling for device states
        } catch (error) {
            console.error("LightDeviceManager - Error during initialization:", error);
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
     * Fetches all Kasa lights from the backend.
     * @returns {Promise<Array>} Array of lights.
     */
    async fetchDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights?timestamp=${Date.now()}`, { cache: 'no-store' });
            console.log("LightDeviceManager - Fetch lights response status:", response.status);
            if (!response.ok) throw new Error(`Failed to fetch lights: ${response.statusText}`);
            const data = await response.json();
            console.log("LightDeviceManager - Raw lights data:", data);
            this.lights = data;
            console.log("LightDeviceManager - Lights fetched:", this.lights);
            return this.lights;
        } catch (error) {
            console.error("LightDeviceManager - Error fetching lights:", error);
            throw error;
        }
    }

    /**
     * Retrieves a specific light by its ID.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {object|null} The light object or null if not found.
     */
    getDevice(deviceId) {
        return this.lights.find(light => light.deviceId === deviceId) || null;
    }

    /**
     * Sets the state of a light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @param {string} state - "on" or "off"
     * @returns {Promise<void>}
     */
    async setDeviceState(deviceId, state) {
        if (state !== "on" && state !== "off") {
            throw new Error("Invalid state. Use 'on' or 'off'.");
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/${state}`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn ${state} light: ${response.statusText}`);
            const data = await response.json();
            console.log(`LightDeviceManager - Turned ${state} light ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`LightDeviceManager - Error turning ${state} light ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Sets the color of a light based on HSV values.
     * @param {string} deviceId - The ID of the Kasa light.
     * @param {object} hsv - { hue: 0-360, saturation: 0-100, brightness: 0-100 }
     * @returns {Promise<void>}
     */
    async setDeviceColor(deviceId, hsv) {
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
            console.log(`LightDeviceManager - Set color for light ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`LightDeviceManager - Error setting color for light ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Registers a callback to be executed whenever a light's state changes.
     * @param {function} callback - The callback function with parameters (deviceId, newState).
     */
    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.stateChangeCallbacks.push(callback);
        } else {
            console.warn("LightDeviceManager - onStateChange callback is not a function.");
        }
    }

    /**
     * Notifies all registered state change callbacks about a light's state change.
     * @param {string} deviceId - The ID of the Kasa light.
     * @param {object} newState - The new state of the light.
     */
    notifyStateChange(deviceId, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(deviceId, newState);
            } catch (error) {
                console.error(`LightDeviceManager - Error in stateChangeCallback for device ${deviceId}:`, error);
            }
        });
    }

    /**
     * Polls light states periodically and updates the cache.
     */
    async startPolling() {
        setInterval(async () => {
            for (const light of this.lights) {
                try {
                    const previousState = this.deviceStateCache.get(light.deviceId)?.state;
                    const currentState = await this.getDeviceState(light.deviceId);

                    // Compare previous and current state to detect changes
                    if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                        this.deviceStateCache.set(light.deviceId, { state: currentState, timestamp: Date.now() });
                        console.log(`LightDeviceManager - Polled and cached state for light ${light.deviceId}:`, currentState);
                        this.notifyStateChange(light.deviceId, currentState);
                    } else {
                        console.log(`LightDeviceManager - No state change for light ${light.deviceId}.`);
                    }
                } catch (error) {
                    console.error(`LightDeviceManager - Error polling light ${light.deviceId}:`, error);
                }
            }
        }, this.pollingInterval);
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
     * Manually invalidates the cache for a specific light.
     * @param {string} deviceId - The ID of the Kasa light.
     */
    invalidateCache(deviceId) {
        if (this.deviceStateCache.has(deviceId)) {
            console.log(`LightDeviceManager - Invalidating cache for light ${deviceId}`);
            this.deviceStateCache.delete(deviceId);
        }
    }

    /**
     * Fetches the current state of a specific light.
     * @param {string} deviceId - The ID of the Kasa light.
     * @returns {Promise<object>} The light state object.
     */
    async getDeviceState(deviceId) {
        const CACHE_DURATION_MS = 30000; // 30 seconds cache duration
        const cachedState = this.deviceStateCache.get(deviceId);

        // Check if the cached state exists and is still valid
        if (cachedState && (Date.now() - cachedState.timestamp < CACHE_DURATION_MS)) {
            console.log(`LightDeviceManager - Returning cached state for light ${deviceId}`);
            return cachedState.state;
        }

        // Fetch state from backend
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/state`);
            if (!response.ok) throw new Error(`Failed to fetch light state: ${response.statusText}`);
            const lightState = await response.json();

            // Update cache if state has changed
            const previousState = cachedState ? cachedState.state : null;
            if (JSON.stringify(previousState) !== JSON.stringify(lightState)) {
                this.deviceStateCache.set(deviceId, { state: lightState, timestamp: Date.now() });
                console.log(`LightDeviceManager - Fetched and cached state for light ${deviceId}:`, lightState);
                this.notifyStateChange(deviceId, lightState);
            } else {
                console.log(`LightDeviceManager - Light state for ${deviceId} unchanged.`);
            }

            return lightState;
        } catch (error) {
            console.error(`LightDeviceManager - Error fetching state for light ${deviceId}:`, error);
            throw error;
        }
    }
}

// Initialize the LightDeviceManager and attach it to the window object for global access
document.addEventListener('DOMContentLoaded', () => {
    window.LightDeviceManager = new LightDeviceManager();
    console.log("LightDeviceManager - Initialized and attached to window.LightDeviceManager");
});
