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

// ====== KASA DEVICE MANAGEMENT ======

// Initialize the TP-Link Smart Home API Client
const kasaClient = new Client();
const kasaLights = {};      // Store light devices by deviceId
const kasaSmartPlugs = {}; // Store smart plug devices by deviceId

// Define device types for categorization based on actual device.deviceType values
const LIGHT_DEVICE_TYPES = ['bulb']; // 'bulb' represents lights
const SMART_PLUG_DEVICE_TYPES = ['plug']; // 'plug' represents smart plugs

// Middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

// Discover Kasa Devices on Server Start
kasaClient.startDiscovery().on('device-new', (device) => {
    console.log(`Discovered Kasa device: ${device.alias} (${device.host})`);
    const deviceId = device.deviceId; // Ensure deviceId is used

    if (!deviceId) {
        console.warn(`Device ${device.alias} does not have a deviceId. Skipping.`);
        return;
    }

    // Log the deviceType for debugging
    console.log(`Device Type for ${device.alias}: ${device.deviceType}`);

    // Categorize device based on deviceType
    if (LIGHT_DEVICE_TYPES.includes(device.deviceType)) {
        kasaLights[deviceId] = device;
        console.log(`Registered Kasa Light device: ${device.alias} (ID: ${deviceId})`);
    } else if (SMART_PLUG_DEVICE_TYPES.includes(device.deviceType)) {
        kasaSmartPlugs[deviceId] = device;
        console.log(`Registered Kasa Smart Plug device: ${device.alias} (ID: ${deviceId})`);
    } else {
        console.warn(`Unknown device type (${device.deviceType}) for device ${device.alias}. Skipping.`);
    }
});

// ====== LIGHT API ENDPOINTS ======

// Endpoint to Get All Kasa Lights
app.get('/api/kasa/lights', (req, res) => {
    console.log(`Received request to fetch Kasa lights from ${req.ip}`);
    const lightList = Object.values(kasaLights).map(light => ({
        alias: light.alias,
        deviceId: light.deviceId,
        host: light.host,
        type: light.deviceType
    }));
    console.log(`Responding with lights: ${JSON.stringify(lightList)}`);
    res.json(lightList);
});

// Endpoint to Turn On a Kasa Light
app.post('/api/kasa/lights/:id/on', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn on light: ${deviceId}`);
    console.log(`Available lights: ${Object.keys(kasaLights)}`);

    const light = kasaLights[deviceId];
    if (!light) {
        console.error(`Light with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Light not found.' });
    }
    try {
        await light.setPowerState(true);
        res.json({ status: 'On' });
        console.log(`Turned on light ${deviceId}`);
    } catch (error) {
        console.error(`Error turning on light ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn on the light.' });
    }
});

// Endpoint to Turn Off a Kasa Light
app.post('/api/kasa/lights/:id/off', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn off light: ${deviceId}`);
    const light = kasaLights[deviceId];
    if (!light) {
        console.error(`Light with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Light not found.' });
    }
    try {
        await light.setPowerState(false);
        res.json({ status: 'Off' });
        console.log(`Turned off light ${deviceId}`);
    } catch (error) {
        console.error(`Error turning off light ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn off the light.' });
    }
});

// Endpoint to Get Light State of a Kasa Light
app.get('/api/kasa/lights/:id/state', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to get state of light: ${deviceId}`);
    const light = kasaLights[deviceId];
    if (!light) {
        console.error(`Light with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Light not found.' });
    }
    try {
        if (!light.lighting) {
            console.error(`Light ${deviceId} does not support lighting capabilities.`);
            return res.status(400).json({ error: 'Light does not support lighting capabilities.' });
        }
        const lightState = await light.lighting.getLightState();
        res.json(lightState);
        console.log(`Fetched light state for light ${deviceId}`);
    } catch (error) {
        console.error(`Error fetching light state for light ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to fetch light state.' });
    }
});

// ====== SMART PLUG API ENDPOINTS ======

// Endpoint to Get All Kasa Smart Plugs
app.get('/api/kasa/smartplugs', (req, res) => {
    console.log(`Received request to fetch Kasa smart plugs from ${req.ip}`);
    const plugList = Object.values(kasaSmartPlugs).map(plug => ({
        alias: plug.alias,
        deviceId: plug.deviceId,
        host: plug.host,
        type: plug.deviceType
    }));
    console.log(`Responding with smart plugs: ${JSON.stringify(plugList)}`);
    res.json(plugList);
});

// Endpoint to Turn On a Kasa Smart Plug
app.post('/api/kasa/smartplugs/:id/on', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn on smart plug: ${deviceId}`);
    const plug = kasaSmartPlugs[deviceId];
    if (!plug) {
        console.error(`Smart Plug with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Smart Plug not found.' });
    }
    try {
        await plug.setPowerState(true);
        res.json({ status: 'On' });
        console.log(`Turned on smart plug ${deviceId}`);
    } catch (error) {
        console.error(`Error turning on smart plug ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn on the smart plug.' });
    }
});

// Endpoint to Turn Off a Kasa Smart Plug
app.post('/api/kasa/smartplugs/:id/off', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to turn off smart plug: ${deviceId}`);
    const plug = kasaSmartPlugs[deviceId];
    if (!plug) {
        console.error(`Smart Plug with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Smart Plug not found.' });
    }
    try {
        await plug.setPowerState(false);
        res.json({ status: 'Off' });
        console.log(`Turned off smart plug ${deviceId}`);
    } catch (error) {
        console.error(`Error turning off smart plug ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to turn off the smart plug.' });
    }
});

// Endpoint to Get State of a Kasa Smart Plug
app.get('/api/kasa/smartplugs/:id/state', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to get state of smart plug: ${deviceId}`);
    const plug = kasaSmartPlugs[deviceId];

    if (!plug) {
        console.error(`Smart Plug with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Smart Plug not found.' });
    }

    try {
        const plugState = await plug.getSysInfo(); // Ensure this method fetches the state properly
        res.json(plugState);
        console.log(`Fetched state for smart plug ${deviceId}`);
    } catch (error) {
        console.error(`Error fetching state for smart plug ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to fetch smart plug state.' });
    }
});


// Endpoint to Get Energy Usage of a Kasa Smart Plug
app.get('/api/kasa/smartplugs/:id/energy', async (req, res) => {
    const deviceId = req.params.id;
    console.log(`Received request to get energy usage of smart plug: ${deviceId}`);
    const plug = kasaSmartPlugs[deviceId];
    if (!plug) {
        console.error(`Smart Plug with ID ${deviceId} not found.`);
        return res.status(404).json({ error: 'Smart Plug not found.' });
    }
    if (!plug.supportsEmeter) {
        console.error(`Smart Plug ${deviceId} does not support energy monitoring.`);
        return res.status(400).json({ error: 'Smart Plug does not support energy monitoring.' });
    }
    try {
        const emeterRealtime = await plug.emeter.getRealtime();
        res.json(emeterRealtime);
        console.log(`Fetched energy usage for smart plug ${deviceId}`);
    } catch (error) {
        console.error(`Error fetching energy usage for smart plug ${deviceId}:`, error);
        res.status(500).json({ error: 'Failed to fetch energy usage.' });
    }
});

// ====== END OF KASA DEVICE MANAGEMENT ======


// Start the server
app.listen(port, () => {
    console.log(`Dynamic MediaMTX Config Server and Kasa Backend Server listening at http://localhost:${port}`);
});