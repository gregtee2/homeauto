// /backend/src/HueLight.js

const { v3 } = require('node-hue-api');
const convert = require('color-convert');

/**
 * Converts RGB values to XY using the Philips Hue specifications.
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {[number, number]} - XY color coordinates
 */
function rgbToXY(r, g, b) {
    // Normalize RGB values to [0,1]
    r /= 255;
    g /= 255;
    b /= 255;

    // Apply gamma correction
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : (r / 12.92);
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : (g / 12.92);
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : (b / 12.92);

    // Convert RGB to XYZ using the Wide RGB D65 conversion formula
    const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
    const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
    const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;

    // Calculate the XY values
    const sum = X + Y + Z;
    if (sum === 0) {
        return [0, 0];
    }
    const x = X / sum;
    const y = Y / sum;

    return [x, y];
}

class HueLight {
    constructor(light, hueApi) {
        this.light = light;
        this.id = light.id;
        this.name = light.name.trim();
        this.type = light.type;
        this.modelId = light.modelId;
        this.state = light._rawData?.state || {}; // Access state from _rawData
        this.hueApi = hueApi;

        // Verify hueApi.lights
        if (!this.hueApi || !this.hueApi.lights || typeof this.hueApi.lights.getLightById !== 'function') {
            console.error(`HueLight - Invalid hueApi.lights for "${this.name}".`);
        } else {
            console.log(`HueLight - hueApi.lights verified for "${this.name}".`);
            console.log('Available methods in hueApi.lights:', Object.keys(this.hueApi.lights));
        }

        // Log initial state
        console.log(`Initial state for "${this.name}":`, this.state);
    }

    /**
     * Turns the Hue light on.
     */
    async turnOn() {
        try {
            const state = new v3.lightStates.LightState().on();
            await this.hueApi.lights.setLightState(this.id, state);
            console.log(`HueLight "${this.name}" turned on.`);
            this.state = { ...this.state, on: true };
        } catch (error) {
            console.error(`HueLight - Error turning on "${this.name}":`, error);
            throw error;
        }
    }

    /**
     * Turns the Hue light off.
     */
    async turnOff() {
        try {
            const state = new v3.lightStates.LightState().off();
            await this.hueApi.lights.setLightState(this.id, state);
            console.log(`HueLight "${this.name}" turned off.`);
            this.state = { ...this.state, on: false };
        } catch (error) {
            console.error(`HueLight - Error turning off "${this.name}":`, error);
            throw error;
        }
    }

    /**
     * Toggles the Hue light's power state.
     */
    async toggle() {
        try {
            console.log(`Current state for "${this.name}":`, this.state);
            if (!this.state || typeof this.state.on !== 'boolean') {
                throw new Error(`Invalid state for light "${this.name}".`);
            }
            const newState = !this.state.on;
            const state = new v3.lightStates.LightState()[newState ? 'on' : 'off']();
            await this.hueApi.lights.setLightState(this.id, state);
            console.log(`HueLight "${this.name}" toggled to ${newState ? 'on' : 'off'}.`);
            this.state = { ...this.state, on: newState };
        } catch (error) {
            console.error(`HueLight - Error toggling "${this.name}":`, error);
            throw error;
        }
    }

    /**
     * Sets the brightness of the Hue light.
     * @param {number} brightness - Brightness value (1-254).
     */
    async setBrightness(brightness) {
        try {
            if (!this.supportsBrightness()) {
                throw new Error(`Device "${this.name}" does not support brightness adjustments.`);
            }

            const state = new v3.lightStates.LightState().brightness(Math.round(brightness));
            await this.hueApi.lights.setLightState(this.id, state);
            console.log(`HueLight "${this.name}" brightness set to ${brightness}.`);
            this.state = { ...this.state, bri: brightness };
        } catch (error) {
            console.error(`HueLight - Error setting brightness for "${this.name}":`, error);
            throw error;
        }
    }

    /**
     * Sets the color of the Hue light using HSV values.
     * @param {object} hsv - HSV color values.
     * @param {number} hsv.hue - Hue value (0-65535).
     * @param {number} hsv.saturation - Saturation value (0-254).
     * @param {number} hsv.brightness - Brightness value (1-254).
     */
    async setColor(hsv) {
        try {
            if (!this.supportsColor()) {
                throw new Error(`Device "${this.name}" does not support color adjustments.`);
            }

            // Convert HSV to RGB
            const [r, g, b] = convert.hsv.rgb([hsv.hue, hsv.saturation, hsv.brightness]);

            // Convert RGB to XY
            const [x, y] = rgbToXY(r, g, b);

            const state = new v3.lightStates.LightState()
                .xy(x, y)
                .brightness(Math.round(hsv.brightness));

            await this.hueApi.lights.setLightState(this.id, state);
            console.log(`HueLight "${this.name}" color set to HSV(${hsv.hue}, ${hsv.saturation}, ${hsv.brightness}).`);
            this.state = { ...this.state, xy: [x, y], bri: hsv.brightness };
        } catch (error) {
            console.error(`HueLight - Error setting color for "${this.name}":`, error);
            throw error;
        }
    }

    /**
     * Determines if the Hue light supports brightness adjustments.
     * @returns {boolean}
     */
    supportsBrightness() {
        // All Hue lights support brightness
        return true;
    }

    /**
     * Determines if the Hue light supports color adjustments.
     * @returns {boolean}
     */
    supportsColor() {
        // Only certain types of Hue lights support color
        const colorSupportedTypes = ['Extended color light', 'Color temperature light', 'Color light'];
        return colorSupportedTypes.includes(this.type);
    }

    /**
     * Updates the internal state of the Hue light.
     */
    async updateState() {
        try {
            console.log(`Attempting to fetch light by ID: ${this.id}`);
            const light = await this.hueApi.lights.getLightById(this.id);
            this.state = light._rawData?.state || {}; // Access state from _rawData
            console.log(`HueLight - Updated state for "${this.name}":`, this.state);
        } catch (error) {
            console.error(`HueLight - Error updating state for "${this.name}":`, error);
        }
    }
}

module.exports = HueLight;
