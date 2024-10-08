// File: src/services/DeviceManager.js

class DeviceManager {
    constructor() {
        this.devices = {}; // Stores all Hue devices with their IDs
        this.deviceManagerReady = false; // Flag indicating if devices are loaded
        this.onReadyCallbacks = []; // Callbacks to invoke when ready

        this.initHueDevices();
    }

    /**
     * Initializes Hue devices by fetching from the Hue Bridge.
     */
    async initHueDevices() {
        const bridge_ip = localStorage.getItem('bridgeIp') || '192.168.1.39';
        const api_key = localStorage.getItem('apiKey') || 'YOUR_HUE_API_KEY';

        try {
            const response = await fetch(`http://${bridge_ip}/api/${api_key}/lights`);
            if (!response.ok) throw new Error(`Hue Bridge responded with status ${response.status}`);
            const data = await response.json();

            for (const [id, light] of Object.entries(data)) {
                this.registerDevice({
                    light_id: id,
                    bridge_ip: bridge_ip,
                    api_key: api_key,
                    light_name: light.name
                });
                console.log(`DeviceManager - Registered Hue device: ${light.name} (ID: ${id})`);
            }

            this.deviceManagerReady = true;
            this.onReadyCallbacks.forEach(callback => callback());
            this.onReadyCallbacks = [];

            console.log("DeviceManager - Hue devices fetched and registered successfully.");
        } catch (error) {
            console.error("DeviceManager - Error fetching Hue devices:", error);
        }
    }

    /**
     * Registers a Hue device.
     * @param {object} config - Configuration object for the device.
     */
    registerDevice(config) {
        const hueLight = new window.HueLight(config);
        this.devices[config.light_id] = hueLight;
        console.log(`DeviceManager - Registered HueLight: Name=${hueLight.name}, ID=${hueLight.light_id}`);
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
     * Sets the light state (on/off) for a specific Hue Light.
     * @param {string} lightId - The ID of the Hue Light.
     * @param {boolean} state - Desired state: true for On, false for Off.
     * @returns {Promise<void>}
     */
    async setLightState(lightId, state) {
        console.log(`DeviceManager - setLightState called for Light ID ${lightId} with state=${state}`);
        const device = this.getDevice(lightId);
        if (!device) {
            throw new Error(`DeviceManager - Device with ID ${lightId} not found.`);
        }

        console.log(`DeviceManager - setLightState called for Light ID ${lightId} with state=${state}`);
        return await device.turnOn(state); // Ensure no inversion here
    }

    /**
     * Sets the light color for a specific Hue Light.
     * @param {string} lightId - The ID of the Hue Light.
     * @param {object} hsv - Object containing hue, saturation, and brightness.
     * @returns {Promise<void>}
     */
    async setLightColor(lightId, hsv) {
        const device = this.getDevice(lightId);
        if (!device) {
            throw new Error(`DeviceManager - Device with ID ${lightId} not found.`);
        }

        console.log(`DeviceManager - setLightColor called for Light ID ${lightId} with HSV:`, hsv);
        return await device.setColor(hsv);
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
}



// Create and attach the instance to the global window object
window.deviceManager = new DeviceManager();
console.log("DeviceManager - Initialized and attached to window.deviceManager");
