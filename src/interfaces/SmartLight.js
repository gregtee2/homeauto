// File: src/interfaces/SmartLight.js

class SmartLight {
    constructor(config) {
        this.config = config;
    }

    // Abstract methods to be implemented by each device adapter
    turnOn() {
        throw new Error("Method 'turnOn()' must be implemented.");
    }

    turnOff() {
        throw new Error("Method 'turnOff()' must be implemented.");
    }

    setColor(hsv) {
        throw new Error("Method 'setColor()' must be implemented.");
    }

    setBrightness(level) {
        throw new Error("Method 'setBrightness()' must be implemented.");
    }
}

// Attach to the global window object for accessibility
window.SmartLight = SmartLight;
