// File: src/services/SmartPlugDeviceManager.js

class SmartPlugDeviceManager extends BaseDeviceManager {
    constructor() {
        super();
        this.apiBaseUrl = 'http://localhost:3000/api/kasa'; // Ensure this matches your backend URL
        this.smartPlugs = [];
        this.deviceStateCache = new Map(); // Cache for device states with timestamps
        this.energyCache = new Map(); // Cache for energy data with timestamps
        this.deviceManagerReady = false;
        this.readyCallbacks = [];
        this.stateChangeCallbacks = []; // List of callbacks for state changes
        this.pollingInterval = 30000; // Poll every 30 seconds
        this.initialize();
    }

    /**
     * Initializes the SmartPlugDeviceManager by fetching smart plugs from the backend.
     */
    async initialize() {
        try {
            await this.fetchDevices(); // Fetch smart plugs
            this.deviceManagerReady = true;
            this.invokeReadyCallbacks();
            console.log("SmartPlugDeviceManager - Initialization complete.");
            this.startPolling(); // Start polling for device states
        } catch (error) {
            console.error("SmartPlugDeviceManager - Error during initialization:", error);
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
     * Invokes any registered callbacks once the device manager is ready.
     */
    invokeReadyCallbacks() {
        this.readyCallbacks.forEach(callback => callback());
        this.readyCallbacks = [];
    }

    /**
     * Fetches all Kasa smart plugs from the backend.
     * @returns {Promise<Array>} Array of smart plugs.
     */
    async fetchDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs?timestamp=${Date.now()}`, { cache: 'no-store' });
            console.log("SmartPlugDeviceManager - Fetch smart plugs response status:", response.status);
            if (!response.ok) throw new Error(`Failed to fetch smart plugs: ${response.statusText}`);
            const data = await response.json();
            console.log("SmartPlugDeviceManager - Raw smart plugs data:", data);
            this.smartPlugs = data;
            console.log("SmartPlugDeviceManager - Smart Plugs fetched:", this.smartPlugs);
            return this.smartPlugs;
        } catch (error) {
            console.error("SmartPlugDeviceManager - Error fetching smart plugs:", error);
            throw error;
        }
    }

    /**
     * Retrieves a specific smart plug by its ID.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {object|null} The smart plug object or null if not found.
     */
    getDevice(deviceId) {
        return this.smartPlugs.find(plug => plug.deviceId === deviceId) || null;
    }

    /**
     * Sets the state of a smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @param {string} state - "on" or "off"
     * @returns {Promise<void>}
     */
    async setDeviceState(deviceId, state) {
        if (state !== "on" && state !== "off") {
            throw new Error("Invalid state. Use 'on' or 'off'.");
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/${state}`, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to turn ${state} smart plug: ${response.statusText}`);
            const data = await response.json();
            console.log(`SmartPlugDeviceManager - Turned ${state} smart plug ${deviceId}:`, data);
            // Invalidate cache after state change
            this.invalidateCache(deviceId);
        } catch (error) {
            console.error(`SmartPlugDeviceManager - Error turning ${state} smart plug ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Fetches the state of a specific smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {Promise<object>} The smart plug state object.
     */
    async getDeviceState(deviceId) {
        const CACHE_DURATION_MS = 30000; 
        const cachedState = this.deviceStateCache.get(deviceId);

        // Check if the cached state exists and is still valid
        if (cachedState && (Date.now() - cachedState.timestamp < CACHE_DURATION_MS)) {
            console.log(`SmartPlugDeviceManager - Returning cached state for smart plug ${deviceId}`);
            return cachedState.state;
        }

        // Fetch state from backend
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/state`);
            if (response.status === 404) {
                console.error(`SmartPlugDeviceManager - Smart plug ${deviceId} not found.`);
                return null;  // Handle 404
            }
            if (!response.ok) throw new Error(`Failed to fetch smart plug state: ${response.statusText}`);

            const plugState = await response.json();
            this.deviceStateCache.set(deviceId, { state: plugState, timestamp: Date.now() });
            console.log(`SmartPlugDeviceManager - Fetched and cached state for smart plug ${deviceId}:`, plugState);
            this.notifyStateChange(deviceId, plugState);

            return plugState;
        } catch (error) {
            console.error(`SmartPlugDeviceManager - Error fetching state for smart plug ${deviceId}:`, error);
            return null;  // Handle the error and return null if state cannot be fetched
        }
    }


    /**
     * Fetches the energy usage of a specific smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @returns {Promise<object>} The energy usage data.
     */
    async fetchPlugEnergyUsage(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/smartplugs/${deviceId}/energy`);
            if (!response.ok) throw new Error(`Failed to fetch energy data for smart plug: ${response.statusText}`);
            
            const energyData = await response.json();
            console.log(`SmartPlugDeviceManager - Fetched energy data for smart plug ${deviceId}:`, energyData);
            
            // Optionally cache the energy data if needed
            this.energyCache.set(deviceId, { energy: energyData, timestamp: Date.now() });

            return energyData;
        } catch (error) {
            console.error(`SmartPlugDeviceManager - Error fetching energy data for smart plug ${deviceId}:`, error);
            throw error;
        }
    }


    /**
     * Notifies all registered state change callbacks about a smart plug's state change.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     * @param {object} newState - The new state of the smart plug.
     */
    notifyStateChange(deviceId, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(deviceId, newState);
            } catch (error) {
                console.error(`SmartPlugDeviceManager - Error in stateChangeCallback for device ${deviceId}:`, error);
            }
        });
    }

    /**
     * Polls smart plug states periodically and updates the cache.
     */
    async startPolling() {
        setInterval(async () => {
            for (const plug of this.smartPlugs) {
                try {
                    const currentState = await this.getDeviceState(plug.deviceId);

                    if (!currentState) {
                        console.warn(`SmartPlugDeviceManager - Skipping smart plug ${plug.deviceId} due to 404.`);
                        continue;  // Skip non-existent plugs
                    }

                    const previousState = this.deviceStateCache.get(plug.deviceId)?.state;

                    if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                        this.deviceStateCache.set(plug.deviceId, { state: currentState, timestamp: Date.now() });
                        this.notifyStateChange(plug.deviceId, currentState);
                    }
                } catch (error) {
                    console.error(`SmartPlugDeviceManager - Error polling smart plug ${plug.deviceId}:`, error);
                }
            }
        }, this.pollingInterval);
    }


    /**
     * Manually invalidates the cache for a specific smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     */
    invalidateCache(deviceId) {
        if (this.deviceStateCache.has(deviceId)) {
            console.log(`SmartPlugDeviceManager - Invalidating cache for smart plug ${deviceId}`);
            this.deviceStateCache.delete(deviceId);
        }
    }

    /**
     * Manually invalidates the energy cache for a specific smart plug.
     * @param {string} deviceId - The ID of the Kasa smart plug.
     */
    invalidateEnergyCache(deviceId) {
        if (this.energyCache.has(deviceId)) {
            console.log(`SmartPlugDeviceManager - Invalidating energy cache for smart plug ${deviceId}`);
            this.energyCache.delete(deviceId);
        }
    }
}

// Initialize the SmartPlugDeviceManager and attach it to the window object for global access
document.addEventListener('DOMContentLoaded', () => {
    window.SmartPlugDeviceManager = new SmartPlugDeviceManager();
    console.log("SmartPlugDeviceManager - Initialized and attached to window.SmartPlugDeviceManager");
});
