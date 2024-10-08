// File: src/adapters/HueLight.js

class HueLight extends window.SmartLight { // Assuming SmartLight is a base class
    constructor(config) {
        super(config);
        this.light_id = config.light_id;
        this.bridge_ip = config.bridge_ip;
        this.api_key = config.api_key;
        this.name = config.light_name || `Hue Light ${this.light_id}`;
        this.state = { on: false, brightness: 0, hue: 0, saturation: 0 };
    }

    /**
     * Turns the light on or off.
     * @param {boolean} state - true for On, false for Off
     */
    async turnOn(state) {
        try {
            // Ensure onState is always a valid boolean
            const onState = state === true ? true : false;

            const url = `http://${this.bridge_ip}/api/${this.api_key}/lights/${this.light_id}/state`;
            const body = { on: onState };

            console.log(`HueLight - turnOn Request body: ${JSON.stringify(body)}`);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data[0]?.error) {
                throw new Error(data[0].error.description);
            }

            this.state.on = onState;
            console.log(`HueLight - Turned ${onState ? 'On' : 'Off'}: ${this.name}`);
        } catch (error) {
            console.error(`HueLight - Error turning ${state ? 'On' : 'Off'}: ${this.name}`, error);
        }
    }

    /**
     * Turns the light off.
     */
    async turnOff() {
        return await this.turnOn(false);
    }

    /**
     * Sets the color of the light based on HSV values.
     * @param {object} hsv - { hue: 0-360, saturation: 0-100, brightness: 0-254 }
     */
    async setColor(hsv) {
        try {
            // Round HSV values to ensure integers are sent
            const roundedHue = Math.round(hsv.hue);
            const roundedSaturation = Math.round(hsv.saturation);
            const roundedBrightness = Math.round(hsv.brightness);

            const url = `http://${this.bridge_ip}/api/${this.api_key}/lights/${this.light_id}/state`;
            const body = {
                hue: Math.round((roundedHue / 360) * 65535), // Hue in 0-65535
                sat: Math.round((roundedSaturation / 100) * 254), // Saturation in 0-254
                bri: roundedBrightness // Brightness 0-254
            };

            console.log(`HueLight - setColor Request body: ${JSON.stringify(body)}`);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data[0]?.error) {
                throw new Error(data[0].error.description);
            }

            this.state.hue = roundedHue;
            this.state.saturation = roundedSaturation;
            this.state.brightness = roundedBrightness;
            console.log(`HueLight - Set color: ${this.name}`, { hue: roundedHue, saturation: roundedSaturation, brightness: roundedBrightness });
        } catch (error) {
            console.error(`HueLight - Error setting color: ${this.name}`, error);
        }
    }

    /**
     * Optionally, implement getState or other necessary methods.
     */
}

// Attach HueLight class to window for global access
window.HueLight = HueLight;
console.log("HueLight - Class defined and attached to window.HueLight");
