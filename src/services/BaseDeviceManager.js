// File: src/services/BaseDeviceManager.js

class BaseDeviceManager {
    constructor() {
        if (this.constructor === BaseDeviceManager) {
            throw new Error("BaseDeviceManager is an abstract class and cannot be instantiated directly.");
        }
    }

    /**
     * Initializes device discovery.
     */
    async initialize() {
        throw new Error("Method 'initialize()' must be implemented.");
    }

    /**
     * Retrieves all devices managed by this manager.
     * @returns {Array} List of device instances.
     */
    getDevices() {
        throw new Error("Method 'getDevices()' must be implemented.");
    }

    /**
     * Retrieves a device by its ID.
     * @param {string} deviceId 
     * @returns {object|null} Device instance or null if not found.
     */
    getDevice(deviceId) {
        throw new Error("Method 'getDevice()' must be implemented.");
    }

    /**
     * Sets the state of a device.
     * @param {string} deviceId 
     * @param {object} state 
     */
    async setDeviceState(deviceId, state) {
        throw new Error("Method 'setDeviceState()' must be implemented.");
    }

    /**
     * Sets the color of a device based on HSV values.
     * @param {string} deviceId 
     * @param {object} hsv 
     */
    async setDeviceColor(deviceId, hsv) {
        throw new Error("Method 'setDeviceColor()' must be implemented.");
    }
}

// Export as global to allow access in other scripts
window.BaseDeviceManager = BaseDeviceManager;
console.log("BaseDeviceManager - Defined and attached to window.BaseDeviceManager");
