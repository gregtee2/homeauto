// server.js

const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');
const dotenv = require('dotenv');
const yaml = require('js-yaml'); // Ensure js-yaml is installed
const axios = require('axios'); // Import axios
const rateLimit = require('express-rate-limit'); // For rate limiting
const auth = require('basic-auth'); // For basic authentication
const NodeCache = require('node-cache'); // For caching
const { Client } = require('tplink-smarthome-api'); // Import TP-Link Smart Home API

dotenv.config();

const app = express();
const port = 3000; // Ensure this port is not conflicting with other services

app.use(cors());
app.use(express.json());

// Initialize cache with a TTL of 60 seconds
const cache = new NodeCache({ stdTTL: 60 });

// Function to reload MediaMTX
const reloadMediaMTX = () => {
    return new Promise((resolve, reject) => {
        // Adjust this command based on your MediaMTX setup
        exec('pkill mediamtx && mediamtx -config "C:\\homeauto\\services\\camera\\mediamtx_v1.9.1_windows_amd64\\mediamtx.yml" &', (err, stdout, stderr) => {
            if (err) {
                console.error('Error reloading MediaMTX:', err);
                console.error('stderr:', stderr);
                return reject(err);
            }
            console.log('MediaMTX reload stdout:', stdout);
            resolve(stdout);
        });
    });
};

// Function to handle Basic Authentication
const proxyAuth = (req, res, next) => {
    const user = auth(req);
    const username = process.env.PROXY_USERNAME || 'admin';
    const password = process.env.PROXY_PASSWORD || 'password';

    if (!user || user.name !== username || user.pass !== password) {
        res.set('WWW-Authenticate', 'Basic realm="401"');
        return res.status(401).send('Authentication required.');
    }
    next();
};

// Rate Limiter for Proxy Endpoint
const proxyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many requests from this IP, please try again after a minute.',
});

// Endpoint to add a new camera
app.post('/add_camera', async (req, res) => {
    console.log('Received /add_camera request with body:', req.body);

    const { cameraID, ip, username, password, rtspPath, port: cameraPort = 554 } = req.body;

    // Validate required parameters
    if (!cameraID || !ip || !username || !password || !rtspPath) {
        console.error('Missing required camera configuration parameters:', req.body);
        return res.status(400).json({ error: 'Missing required camera configuration parameters.' });
    }

    // Construct the RTSP URL
    const rtspUrl = `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${ip}:${cameraPort}/${rtspPath}`;

    // Construct the MediaMTX path configuration
    const newCameraConfig = `
${cameraID}:
  source: ${rtspUrl}
  runOnInit: ffmpeg -i ${rtspUrl} -c:v copy -c:a copy -f hls /streams/${cameraID}/index.m3u8
`;

    // Define the path to your MediaMTX configuration file
    const mediaMTXConfigPath = "C:\\homeauto\\services\\camera\\mediamtx_v1.9.1_windows_amd64\\mediamtx.yml";

    try {
        // Check if the cameraID already exists to prevent duplicates
        if (fs.existsSync(mediaMTXConfigPath)) {
            const configContent = await fs.promises.readFile(mediaMTXConfigPath, 'utf8');
            if (configContent.includes(`${cameraID}:`)) {
                console.error(`Camera ID '${cameraID}' already exists.`);
                return res.status(400).json({ error: `Camera ID '${cameraID}' already exists.` });
            }
        } else {
            console.error(`Configuration file not found at path: ${mediaMTXConfigPath}`);
            return res.status(500).json({ error: 'MediaMTX configuration file not found.' });
        }

        // Append the new camera configuration to mediamtx.yml
        await fs.promises.appendFile(mediaMTXConfigPath, newCameraConfig);
        console.log(`Appended configuration for ${cameraID} to mediamtx.yml`);

        // Validate YAML Syntax
        try {
            const parsedConfig = yaml.load(await fs.promises.readFile(mediaMTXConfigPath, 'utf8'));
            console.log('YAML configuration is valid.');
        } catch (yamlError) {
            console.error('Invalid YAML syntax after appending:', yamlError);
            return res.status(500).json({ error: 'Invalid YAML syntax in mediamtx.yml.' });
        }

        // Reload MediaMTX to apply the new configuration
        await reloadMediaMTX();
        console.log(`MediaMTX reloaded successfully for ${cameraID}`);

        res.json({ message: `Camera ${cameraID} added and MediaMTX reloaded.` });
    } catch (error) {
        console.error('Error adding camera:', error);
        res.status(500).json({ error: 'Failed to add camera and reload MediaMTX.' });
    }
});

/**
 * CORS Proxy Endpoint
 * Usage: GET /proxy?url=<encoded_url>
 * Example: /proxy?url=https%3A%2F%2Fwww.alphavantage.co%2Fquery%3Ffunction%3DGLOBAL_QUOTE%26symbol%3DAAPL%26apikey%3DYOUR_API_KEY
 */
app.get('/proxy', proxyAuth, proxyLimiter, async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing "url" query parameter.' });
    }

    // Check cache first
    const cachedResponse = cache.get(targetUrl);
    if (cachedResponse) {
        console.log('Serving from cache:', targetUrl);
        return res.setHeader('Content-Type', cachedResponse.contentType).status(200).send(cachedResponse.data);
    }

    try {
        // Optional: Restrict proxying to specific domains (e.g., Alpha Vantage)
        const allowedDomains = ['www.alphavantage.co'];
        const urlObject = new URL(targetUrl);
        if (!allowedDomains.includes(urlObject.hostname)) {
            return res.status(403).json({ error: 'Domain not allowed.' });
        }

        // Fetch the target URL
        const response = await axios.get(targetUrl, {
            headers: {
                'Accept': 'application/json',
            },
        });

        // Cache the response data
        cache.set(targetUrl, {
            data: response.data,
            contentType: response.headers['content-type'],
        });

        // Forward the response data and headers
        res.setHeader('Content-Type', response.headers['content-type']);
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error in proxy:', error.message);
        res.status(500).json({ error: 'Failed to fetch the requested URL.' });
    }
});

/** 
 * ====== START OF KASA DEVICE MANAGEMENT ======
 * 
 * Below is the integration of Kasa device management using the `tplink-smarthome-api`.
 * It includes device discovery and API endpoints to control Kasa lights.
 */

// Initialize the TP-Link Smart Home API Client
const kasaClient = new Client();
const kasaDevices = {};

// Discover Kasa Devices on Server Start
kasaClient.startDiscovery().on('device-new', (device) => {
    console.log(`Discovered Kasa device: ${device.alias} (${device.host})`);
    const deviceId = device.deviceId; // Ensure deviceId is used
    
    if (deviceId) {
        kasaDevices[deviceId] = device;
        console.log(`Registered Kasa device: ${device.alias} (ID: ${deviceId})`);
    } else {
        console.warn(`Device ${device.alias} does not have a deviceId. Skipping.`);
    }
});

// Endpoint to Get All Kasa Devices
app.get('/api/kasa/devices', (req, res) => {
    console.log(`Received request to fetch Kasa devices from ${req.ip}`);
    const deviceList = Object.values(kasaDevices).map(device => ({
        alias: device.alias,
        deviceId: device.deviceId,
        host: device.host,
        type: device.deviceType
    }));
    console.log(`Responding with devices: ${JSON.stringify(deviceList)}`);
    res.json(deviceList);
});

// Endpoint to Turn On a Kasa Light
app.post('/api/kasa/lights/:id/on', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn on device: ${deviceId}`);
    console.log(`Available devices: ${Object.keys(kasaDevices)}`);
    
    const device = kasaDevices[deviceId];
    if (!device) {
        console.error(`Device with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Device not found.' });
    }
    try {
        await device.setPowerState(true);
        res.json({ status: 'On' });
        console.log(`Turned on device ${deviceId}`);
    } catch (error) {
        console.error(`Error turning on device ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn on the device.' });
    }
});

// Endpoint to Turn Off a Kasa Light
app.post('/api/kasa/lights/:id/off', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn off device: ${deviceId}`);
    const device = kasaDevices[deviceId];
    if (!device) {
        console.error(`Device with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Device not found.' });
    }
    try {
        await device.setPowerState(false);
        res.json({ status: 'Off' });
        console.log(`Turned off device ${deviceId}`);
    } catch (error) {
        console.error(`Error turning off device ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn off the device.' });
    }
});

// Endpoint to Set Color of a Kasa Light
app.post('/api/kasa/lights/:id/color', async (req, res) => {
    const deviceId = req.params.id;
    const { hue, saturation, brightness } = req.body;
    const device = kasaDevices[deviceId];
    
    if (!device) {
        console.error(`Device with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Device not found.' });
    }
    
    // Log the device and its methods for debugging
    console.log(`Device info for ${deviceId}:`, device);
    console.log(`Available methods on device: ${Object.keys(device).join(', ')}`);
    
    // Validate HSV Values
    if (
        typeof hue !== 'number' || hue < 0 || hue > 360 ||
        typeof saturation !== 'number' || saturation < 0 || saturation > 100 ||
        typeof brightness !== 'number' || brightness < 0 || brightness > 100
    ) {
        return res.status(400).json({ error: 'Invalid HSV values. Ensure hue is 0-360, saturation and brightness are 0-100.' });
    }
    
    try {
        // Ensure the device supports lighting capabilities
        if (!device.lighting) {
            console.error(`Device ${deviceId} does not support lighting capabilities.`);
            return res.status(400).json({ error: 'Device does not support color control' });
        }
    
        // Set the color using the correct method
        await device.lighting.setLightState({ on: true, hue, saturation, brightness });
        res.json({ status: 'Color set successfully.' });
        console.log(`Set color for device ${deviceId} to H:${hue} S:${saturation} B:${brightness}`);
    } catch (error) {
        console.error(`Error setting color for device ${deviceId}:`, error.stack);
        res.status(500).json({ error: 'Failed to set color.', details: error.message });
    }
});

/** 
 * ====== END OF KASA DEVICE MANAGEMENT ======
 */

/** 
 * Start the server (if not already started earlier)
 */
app.listen(port, () => {
    console.log(`Dynamic MediaMTX Config Server and Kasa Backend Server listening at http://localhost:${port}`);
});
