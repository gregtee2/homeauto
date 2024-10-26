// /backend/src/KasaLight.js

const convert = require('color-convert');

class KasaLight {
    /**
     * Constructs a KasaLight instance.
     * @param {object} device - The Kasa device object from tplink-smarthome-api.
     */
    constructor(device) {
        this.device = device;
        this.alias = device.alias.trim(); // Trim to remove any trailing spaces
        this.light_id = device.deviceId;
        this.host = device.host;
        this.deviceType = device.deviceType;
    }

    /**
     * Initializes the device by connecting to it.
     */
    async initialize() {
        try {
            await this.device.getInfo(); // Ensures the device is reachable
            console.log(`KasaLight - Initialized device: ${this.alias} (${this.host})`);
        } catch (error) {
            console.error(`KasaLight - Error initializing device ${this.alias}:`, error);
            throw error;
        }
    }

    /**
     * Turns the Kasa device on.
     */
    async turnOn() {
        try {
            await this.setPowerState(true);
            console.log(`KasaLight "${this.alias}" turned on.`);
        } catch (error) {
            console.error(`KasaLight - Error turning on "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Turns the Kasa device off.
     */
    async turnOff() {
        try {
            await this.setPowerState(false);
            console.log(`KasaLight "${this.alias}" turned off.`);
        } catch (error) {
            console.error(`KasaLight - Error turning off "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Toggles the Kasa device's power state.
     */
    async toggle() {
        try {
            const currentState = await this.getPowerState();
            await this.setPowerState(!currentState);
            console.log(`KasaLight "${this.alias}" toggled to ${!currentState ? 'on' : 'off'}.`);
        } catch (error) {
            console.error(`KasaLight - Error toggling "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Sets the power state of the Kasa device.
     * @param {boolean} state - Desired power state.
     */
    async setPowerState(state) {
        try {
            await this.device.setPowerState(state);
        } catch (error) {
            console.error(`KasaLight - Error setting power state for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Gets the current power state of the Kasa device.
     * @returns {boolean}
     */
    async getPowerState() {
        try {
            return await this.device.getPowerState();
        } catch (error) {
            console.error(`KasaLight - Error getting power state for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Sets the brightness of the Kasa device.
     * @param {number} brightness - Brightness value (1-100).
     */
    async setBrightness(brightness) {
        try {
            if (!this.supportsBrightness()) {
                throw new Error(`Device "${this.alias}" does not support brightness adjustments.`);
            }

            // Kasa devices typically accept brightness values between 1 and 100
            await this.device.setBrightness(brightness);
            console.log(`KasaLight "${this.alias}" brightness set to ${brightness}.`);
        } catch (error) {
            console.error(`KasaLight - Error setting brightness for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Gets the brightness of the Kasa device.
     * @returns {number|null} - Brightness value (1-100) or null if not supported.
     */
    async getBrightness() {
        try {
            if (!this.supportsBrightness()) {
                return null;
            }
            if (typeof this.device.getBrightness !== 'function') {
                console.warn(`KasaLight - Device "${this.alias}" does not support getBrightness method.`);
                return null;
            }
            const brightness = await this.device.getBrightness();
            return brightness;
        } catch (error) {
            console.error(`KasaLight - Error getting brightness for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Sets the color of the Kasa device using HSV values.
     * @param {object} hsv - HSV color values.
     * @param {number} hsv.hue - Hue value (0-360).
     * @param {number} hsv.saturation - Saturation value (0-100).
     * @param {number} hsv.brightness - Brightness value (0-100).
     */
    async setColor(hsv) {
        try {
            if (!this.supportsColor()) {
                throw new Error(`Device "${this.alias}" does not support color adjustments.`);
            }

            const { hue, saturation, brightness } = hsv;
            // Convert HSV to RGB
            const [r, g, b] = convert.hsv.rgb([hue, saturation, brightness]);
            // Set color using RGB values
            await this.device.setColor({ r, g, b });
            console.log(`KasaLight "${this.alias}" color set to HSV(${hue}, ${saturation}, ${brightness}).`);
        } catch (error) {
            console.error(`KasaLight - Error setting color for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Gets the color of the Kasa device.
     * @returns {object|null} - HSV color values or null if not supported.
     */
    async getColor() {
        try {
            if (!this.supportsColor()) {
                return null;
            }
            if (typeof this.device.getColor !== 'function') {
                console.warn(`KasaLight - Device "${this.alias}" does not support getColor method.`);
                return null;
            }
            const color = await this.device.getColor();
            // Assuming the device returns RGB, convert it back to HSV
            const { r, g, b } = color;
            const [hue, saturation, brightness] = convert.rgb.hsv([r, g, b]);
            return { hue, saturation, brightness };
        } catch (error) {
            console.error(`KasaLight - Error getting color for "${this.alias}":`, error);
            throw error;
        }
    }

    /**
     * Determines if the device supports brightness adjustments.
     * @returns {boolean}
     */
    supportsBrightness() {
        const nonBrightnessTypes = ['Plug']; // Add other types as necessary
        if (nonBrightnessTypes.includes(this.deviceType)) {
            return false;
        }
        // Additionally, check if the device has getBrightness method
        return typeof this.device.getBrightness === 'function';
    }

    /**
     * Determines if the device supports color adjustments.
     * @returns {boolean}
     */
    supportsColor() {
        const colorSupportedTypes = ['Bulb', 'LightStrip']; // Add other types as necessary
        if (!colorSupportedTypes.includes(this.deviceType)) {
            return false;
        }
        // Additionally, check if the device has setColor and getColor methods
        return typeof this.device.getColor === 'function' && typeof this.device.setColor === 'function';
    }
}

module.exports = KasaLight;
