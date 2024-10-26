// /backend/src/controllers/lightController.js
const { hueApi, kasaLights } = require('../services/deviceDiscovery');

const actionHandlers = {
    hue: {
        async on(controller) { return controller.turnOn(); },
        async off(controller) { return controller.turnOff(); },
        async brightness(controller, brightness) { return controller.setBrightness(brightness); },
        async color(controller, hsv) { return controller.setColor(hsv); }
    },
    kasa: {
        async on(controller) { return controller.turnOn(); },
        async off(controller) { return controller.turnOff(); },
        async brightness(controller, brightness) { return controller.setBrightness(brightness); }
    }
};

async function controlLight(req, res) {
    const { brand, id, action } = req.params;
    const { brightness, hsv } = req.body;

    let controller;
    if (brand.toLowerCase() === 'hue') {
        controller = hueApi.lights.getLightById(id);
    } else if (brand.toLowerCase() === 'kasa') {
        controller = kasaLights.find(light => light.light_id === id);
    }

    if (controller && actionHandlers[brand] && actionHandlers[brand][action]) {
        try {
            await actionHandlers[brand][action](controller, brightness || hsv);
            res.json({ success: true });
        } catch (error) {
            console.error(`Error performing action on ${brand} device "${id}":`, error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(400).json({ success: false, error: 'Invalid action or brand' });
    }
}

module.exports = { controlLight };
