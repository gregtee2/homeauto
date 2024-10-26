// /backend/src/discoverKasa.js
const { Client } = require('tplink-smarthome-api');

const client = new Client();

// Discover all Kasa devices on the network
client.startDiscovery().on('device-new', async (device) => {
    try {
        // Retrieve system information
        const sysInfo = await device.getSysInfo();

        // Log the entire sysInfo object for inspection
        console.log('Full sysInfo:', JSON.stringify(sysInfo, null, 2));

        // Log the device.host object to inspect available properties
        console.log('Device Host Info:', JSON.stringify(device.host, null, 2));

        // Extract device type using 'mic_type' or fallback to 'model'
        const deviceType = sysInfo.mic_type || sysInfo.model || 'undefined';

        // Extract device ID using 'deviceId'
        const deviceId = sysInfo.deviceId || 'undefined';

        // Extract IP address
        let ipAddress = 'IP not available';
        if (device.host) {
            if (typeof device.host === 'string') {
                ipAddress = device.host;
            } else if (device.host.ip) {
                ipAddress = device.host.ip;
            } else if (device.host.address) {
                ipAddress = device.host.address;
            }
        }

        console.log(`Discovered Kasa device: ${deviceType} at ${ipAddress}`);
        console.log('Device ID:', deviceId);
        console.log('Alias (Name):', sysInfo.alias);
        console.log('---------------------------------------');
    } catch (error) {
        console.error('Error retrieving device information:', error);
    }
});
