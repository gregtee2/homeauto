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
            const onState = !!state; // Ensure it's a boolean
            const url = `http://${this.bridge_ip}/api/${this.api_key}/lights/${this.light_id}/state`;
            const body = { on: onState };

            console.log(`HueLight - turnOn Request body: ${JSON.stringify(body)}`);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data[0]?.error) throw new Error(data[0].error.description);

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
            // Validate and clamp HSV values
            const hue = Math.round(Math.min(360, Math.max(0, hsv.hue)));
            const saturation = Math.round(Math.min(100, Math.max(0, hsv.saturation)));
            const brightness = Math.round(Math.min(254, Math.max(0, hsv.brightness)));

            const url = `http://${this.bridge_ip}/api/${this.api_key}/lights/${this.light_id}/state`;
            const body = {
                hue: Math.round((hue / 360) * 65535), // Convert to 0-65535 range
                sat: Math.round((saturation / 100) * 254), // Convert to 0-254 range
                bri: brightness // Brightness in 0-254
            };

            console.log(`HueLight - setColor Request body: ${JSON.stringify(body)}`);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data[0]?.error) throw new Error(data[0].error.description);

            // Update internal state
            this.state.hue = hue;
            this.state.saturation = saturation;
            this.state.brightness = brightness;

            console.log(`HueLight - Set color: ${this.name}`, { hue, saturation, brightness });
        } catch (error) {
            console.error(`HueLight - Error setting color: ${this.name}`, error);
        }
    }
}

// Attach HueLight class to window for global access
window.HueLight = HueLight;
console.log("HueLight - Class defined and attached to window.HueLight");
