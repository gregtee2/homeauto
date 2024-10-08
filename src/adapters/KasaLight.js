// File: src/adapters/KasaLight.js

class KasaLight {
    constructor(config) {
        this.light_id = config.light_id;
        this.host = config.host;
        this.alias = config.alias;
        this.device = null;
        this.initialize();
    }

    /**
     * Initializes connection to the Kasa Light.
     */
    async initialize() {
        try {
            // Assuming `window.tplink_smarthome_api` is loaded and accessible
            const { Client } = window.tplink_smarthome_api;
            const client = new Client();
            this.device = await client.getDevice({ host: this.host });
            await this.device.getSysInfo(); // Ensure the device is responsive
            console.log(`KasaLight - Connected to ${this.alias} (${this.host})`);
        } catch (error) {
            console.error(`KasaLight - Error connecting to ${this.alias} (${this.host}):`, error);
        }
    }

    /**
     * Turns the Kasa Light on.
     */
    async turnOn() {
        try {
            await this.device.setPowerState(true);
            console.log(`KasaLight - Turned On: ${this.alias} (ID: ${this.light_id})`);
        } catch (error) {
            console.error(`KasaLight - Error turning on ${this.alias} (ID: ${this.light_id}):`, error);
        }
    }

    /**
     * Turns the Kasa Light off.
     */
    async turnOff() {
        try {
            await this.device.setPowerState(false);
            console.log(`KasaLight - Turned Off: ${this.alias} (ID: ${this.light_id})`);
        } catch (error) {
            console.error(`KasaLight - Error turning off ${this.alias} (ID: ${this.light_id}):`, error);
        }
    }

    /**
     * Sets the color of the Kasa Light based on HSV values.
     * Note: Kasa Lights may have limited color support.
     * @param {object} hsv - { hue: 0-360, saturation: 0-100, brightness: 0-100 }
     */
    async setColor(hsv) {
        try {
            // Kasa Bulbs have limited color support; ensure device supports color
            if (typeof this.device.setColor === 'function') {
                await this.device.setColor({
                    hue: Math.round(hsv.hue),
                    saturation: Math.round(hsv.saturation),
                    brightness: Math.round(hsv.brightness)
                });
                console.log(`KasaLight - Set Color for ${this.alias} (ID: ${this.light_id}):`, hsv);
            } else {
                console.warn(`KasaLight - Color setting not supported for ${this.alias} (ID: ${this.light_id})`);
            }
        } catch (error) {
            console.error(`KasaLight - Error setting color for ${this.alias} (ID: ${this.light_id}):`, error);
        }
    }
}

// Attach KasaLight class to window for global access
window.KasaLight = KasaLight;
console.log("KasaLight - Class defined and attached to window.KasaLight");
