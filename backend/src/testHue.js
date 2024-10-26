// /backend/src/testHue.js

const { v3 } = require('node-hue-api');
require('dotenv').config();

const USERNAME = process.env.HUE_USERNAME || 'YOUR_HUE_USERNAME';
const BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.39';

(async () => {
    try {
        const hueApi = await v3.api.createLocal(BRIDGE_IP).connect(USERNAME);
        console.log('Connected to Hue Bridge');

        // List all methods in hueApi.lights
        console.log('Available methods in hueApi.lights:', Object.keys(hueApi.lights));

        // List all lights
        const allLights = await hueApi.lights.getAll();
        console.log('All Lights:', allLights.map(light => ({ id: light.id, name: light.name })));

        // Test getLightById
        const testLightId = 2; // Replace with a valid light ID from your setup
        const testLight = await hueApi.lights.getLightById(testLightId);
        console.log(`Test Light [ID: ${testLightId}]:`, testLight);
    } catch (error) {
        console.error('Error:', error);
    }
})();
