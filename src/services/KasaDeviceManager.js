// File: src/services/KasaDeviceManager.js

class KasaDeviceManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api/kasa'; // Ensure this matches your backend URL
        this.devices = [];
        this.deviceManagerReady = false;
        this.readyCallbacks = [];
        this.initialize();
    }

    async initialize() {
        try {
            await this.fetchDevices();
            this.deviceManagerReady = true;
            this.readyCallbacks.forEach(callback => callback());
            this.readyCallbacks = [];
            console.log("KasaDeviceManager - Initialization complete.");
        } catch (error) {
            console.error("KasaDeviceManager - Error during initialization:", error);
        }
    }

    /**
     * Fetches all Kasa devices from the backend.
     * @returns {Promise<Array>} Array of devices.
     */
    async fetchDevices() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/devices?timestamp=${Date.now()}`, {
                cache: 'no-store'
            });
            console.log("KasaDeviceManager - Fetch response status:", response.status);
            if (!response.ok) throw new Error(`Failed to fetch devices: ${response.statusText}`);
            const data = await response.json();
            console.log("KasaDeviceManager - Raw data:", data);
            this.devices = data;
            console.log("KasaDeviceManager - Devices fetched:", this.devices);
            return this.devices;
        } catch (error) {
            console.error("KasaDeviceManager - Error fetching devices:", error);
            throw error;
        }
    }


    /**
     * Retrieves a specific device by its ID.
     * @param {string} deviceId - The ID of the Kasa device.
     * @returns {object|null} The device object or null if not found.
     */
    getDevice(deviceId) {
        return this.devices.find(device => device.deviceId === deviceId) || null;
    }

    /**
     * Turns on a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa device.
     * @returns {Promise<void>}
     */
    async turnOn(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/on`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error(`Failed to turn on device: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned on device ${deviceId}:`, data);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning on device ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Turns off a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa device.
     * @returns {Promise<void>}
     */
    async turnOff(deviceId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/off`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error(`Failed to turn off device: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Turned off device ${deviceId}:`, data);
        } catch (error) {
            console.error(`KasaDeviceManager - Error turning off device ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Sets the color of a specific Kasa light.
     * @param {string} deviceId - The ID of the Kasa device.
     * @param {object} hsv - { hue: 0-360, saturation: 0-100, brightness: 0-100 }
     * @returns {Promise<void>}
     */
    async setColor(deviceId, hsv) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/lights/${deviceId}/color`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hsv)
            });
            if (!response.ok) throw new Error(`Failed to set color: ${response.statusText}`);
            const data = await response.json();
            console.log(`KasaDeviceManager - Set color for device ${deviceId}:`, data);
        } catch (error) {
            console.error(`KasaDeviceManager - Error setting color for device ${deviceId}:`, error);
            throw error;
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
}

// Initialize the KasaDeviceManager and attach it to the window object for global access
window.KasaDeviceManager = new KasaDeviceManager();
console.log("KasaDeviceManager - Initialized and attached to window.KasaDeviceManager");
