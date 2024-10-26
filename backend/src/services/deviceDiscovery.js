// /backend/src/services/deviceDiscovery.js
const { v3 } = require('node-hue-api');
const { Client: KasaClient } = require('tplink-smarthome-api');
const KasaLight = require('../KasaLight');

const USERNAME = process.env.HUE_USERNAME || 'defaultHueUser';
const BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.39';
const kasaClient = new KasaClient();
let hueApi;
let kasaLights = [];

/**
 * Initialize connection to the Hue Bridge
 */
async function connectToHueBridge() {
    try {
        hueApi = await v3.api.createLocal(BRIDGE_IP).connect(USERNAME);
        console.log('Connected to Hue Bridge');
        return hueApi;
    } catch (error) {
        console.error('Error connecting to Hue Bridge:', error);
    }
}

/**
 * Discover Kasa Devices
 */
async function discoverKasaDevices() {
    try {
        const devices = await kasaClient.startDiscovery();
        devices.on('device-new', async (device) => {
            if (!kasaLights.find(light => light.light_id === device.deviceId)) {
                const kasaLight = new KasaLight(device);
                await kasaLight.initialize();
                kasaLights.push(kasaLight);
            }
        });
        console.log('Kasa device discovery started...');
        return kasaLights;
    } catch (error) {
        console.error('Error during Kasa device discovery:', error);
    }
}

module.exports = { connectToHueBridge, discoverKasaDevices, hueApi, kasaLights };
