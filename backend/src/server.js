// /backend/src/server.js

/**
 * Smart Lighting Backend Server
 * 
 * This server manages the discovery and control of TP-Link Kasa and Philips Hue devices.
 * It provides RESTful API endpoints and real-time communication via Socket.IO.
 * 
 * Technologies Used:
 * - Node.js with Express.js for the server
 * - tplink-smarthome-api for TP-Link Kasa devices
 * - node-hue-api for Philips Hue devices
 * - MongoDB with Mongoose for data storage
 * - Socket.IO for real-time communication
 * - Jexl for condition evaluation
 * 
 * Author: [Your Name]
 * Date: [Date]
 */

// =======================
// Import Required Modules
// =======================
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { v3 } = require('node-hue-api');
const mongoose = require('mongoose');
const CommandScheduler = require('./services/CommandScheduler');
const NodeRegistry = require('./services/NodeRegistry');
const graphSchema = require('./validation/graphValidation'); // Ensure this path is correct
const KasaLight = require('./KasaLight'); // Import the KasaLight class
const HueLight = require('./HueLight'); // Import the HueLight class
const { Client: KasaClient } = require('tplink-smarthome-api'); // Import Kasa Client for discovery
const Jexl = require('jexl'); // For condition evaluation
const convert = require('color-convert'); // For color conversions

// ===================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080", // Frontend URL
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 8081;

// ============================
// Hue Bridge Configuration
// ============================

/**
 * Ensure that the HUE_USERNAME and HUE_BRIDGE_IP are correctly set in the .env file.
 * Example .env entries:
 * HUE_USERNAME=your-hue-username
 * HUE_BRIDGE_IP=192.168.1.39
 */
const USERNAME = process.env.HUE_USERNAME || 'YOUR_HUE_USERNAME'; // Replace with your actual Hue username or use environment variable
const BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.39'; // Replace with your Hue Bridge IP or use environment variable



// /backend/src/server.js

// ... [Other imports and configurations]

// =========================
// Initialize Hue API
// =========================

let hueApi;
const hueLights = []; // Array to hold HueLight instances


(async () => {
    try {
        hueApi = await v3.api.createLocal(BRIDGE_IP).connect(USERNAME);
        console.log('Connected to Hue Bridge');

        if (hueApi && hueApi.lights && typeof hueApi.lights.getLightById === 'function') {
            console.log('hueApi.lights.getLightById is available.');
            console.log('Available methods in hueApi.lights:', Object.keys(hueApi.lights));
        } else {
            console.error('hueApi.lights.getLightById is NOT available.');
        }

        // Fetch all Hue lights
        const allHueLights = await hueApi.lights.getAll();
        console.log(`Fetched ${allHueLights.length} Hue lights.`);
        // Inside the allHueLights.forEach loop
        allHueLights.forEach(light => {
            console.log('Hue Light Object:', light); // Log the entire light object
            const hueLight = new HueLight(light, hueApi);
            hueLights.push(hueLight);
            console.log(`HueLight - Connected to ${hueLight.name} (ID: ${hueLight.id})`);
        });

        // Optional: Update state periodically
        setInterval(async () => {
            for (const hueLight of hueLights) {
                await hueLight.updateState();
            }
        }, 60000); // Update every 60 seconds

    } catch (error) {
        console.error('Error connecting to Hue Bridge:', error);
    }
})();





// =========================
// Initialize Command Scheduler and Node Registry
// =========================
const commandScheduler = new CommandScheduler();
const nodeRegistry = new NodeRegistry();

// =====================
// Connect to MongoDB
// =====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lightgraph')
  .then(() => {
      console.log('Connected to MongoDB');
      commandScheduler.loadScheduledTasks();
  })
  .catch(error => {
      console.error('Error connecting to MongoDB:', error);
  });

// =======================
// Middleware Setup
// =======================

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve index.html for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// =========================
// Initialize Kasa Client for Device Discovery
// =========================
const kasaClient = new KasaClient();
const kasaLights = []; // Array to store KasaLight instances

/**
 * Function to discover Kasa devices dynamically
 */
async function discoverKasaDevices() {
    try {
        // Start device discovery
        const devices = await kasaClient.startDiscovery();

        // Handle new devices
        devices.on('device-new', async (device) => {
            // Avoid adding duplicates
            if (!kasaLights.find(light => light.light_id === device.deviceId)) {
                const kasaLight = new KasaLight(device);
                await kasaLight.initialize();
                kasaLights.push(kasaLight);
                console.log(`KasaLight - Added new device: ${kasaLight.alias} (ID: ${kasaLight.light_id})`);
                console.log(`KasaLight - Device Type: ${kasaLight.deviceType} for "${kasaLight.alias}"`);
            }
        });

        // Handle device online status
        devices.on('device-online', (device) => {
            console.log(`KasaLight - Device Online: ${device.alias} (${device.host})`);
        });

        devices.on('device-offline', (device) => {
            console.log(`KasaLight - Device Offline: ${device.alias} (${device.host})`);
        });

        console.log('Kasa device discovery started...');
    } catch (error) {
        console.error('Error during Kasa device discovery:', error);
    }
}

// Start discovering Kasa devices only once during server startup
discoverKasaDevices();

// =====================
// API Endpoint Definitions
// =====================

/**
 * @route   POST /api/lights/:brand/:id/:action
 * @desc    Control smart lights based on brand, device ID, and action
 * @params  brand - 'hue' or 'kasa'
 *          id - Device name (case-insensitive, trimmed)
 *          action - 'on', 'off', 'toggle', 'brightness', 'color'
 * @body    For 'brightness': { brightness: Number (1-254) }
 *          For 'color': { hsv: { hue: 0-65535, saturation: 0-254, brightness: 1-254 } }
 */
app.post('/api/lights/:brand/:id/:action', async (req, res) => {
    const { brand, id, action } = req.params;
    const { brightness, hsv } = req.body; // Optional parameters

    // Log the incoming API request
    console.log(`API Request - Brand: ${brand}, ID: ${id}, Action: ${action}, Body:`, req.body);

    try {
        let controller;

        if (brand.toLowerCase() === 'hue') {
            // Find the HueLight instance by name (case-insensitive and trimmed)
            const hueLight = hueLights.find(light => light.name.toLowerCase() === id.toLowerCase());

            if (!hueLight) {
                console.warn(`Hue device "${id}" not found.`);
                return res.status(404).json({ success: false, error: `Hue device "${id}" not found.` });
            }

            controller = hueLight;
            console.log(`Controller assigned: HueLight - ${hueLight.name} (ID: ${hueLight.id})`);

        } else if (brand.toLowerCase() === 'kasa') {
            // Find the KasaLight instance by alias (case-insensitive and trimmed)
            const kasaLight = kasaLights.find(light => light.alias.toLowerCase() === id.toLowerCase());

            if (!kasaLight) {
                console.warn(`Kasa device "${id}" not found.`);
                return res.status(404).json({ success: false, error: `Kasa device "${id}" not found.` });
            }

            controller = kasaLight;
            console.log(`Controller assigned: KasaLight - ${kasaLight.alias} (ID: ${kasaLight.light_id})`);

        } else {
            console.warn(`Unsupported brand: ${brand}`);
            return res.status(400).json({ success: false, error: 'Unsupported light brand' });
        }

        // Perform the requested action
        switch (action.toLowerCase()) {
            case 'on':
                await controller.turnOn();
                console.log(`Action Performed - Turned On: ${brand} device "${id}"`);
                return res.json({ success: true });

            case 'off':
                await controller.turnOff();
                console.log(`Action Performed - Turned Off: ${brand} device "${id}"`);
                return res.json({ success: true });

            case 'toggle':
                await controller.toggle();
                console.log(`Action Performed - Toggled: ${brand} device "${id}"`);
                return res.json({ success: true });

            case 'brightness':
                if (brightness === undefined || brightness < 1 || brightness > 254) {
                    console.warn(`Invalid brightness value: ${brightness} for device "${id}"`);
                    return res.status(400).json({ success: false, error: 'Brightness value must be between 1 and 254' });
                }
                await controller.setBrightness(brightness);
                console.log(`Action Performed - Set Brightness: ${brightness} for ${brand} device "${id}"`);
                return res.json({ success: true });

            case 'color':
                if (!hsv || typeof hsv.hue !== 'number' || typeof hsv.saturation !== 'number' || typeof hsv.brightness !== 'number') {
                    console.warn(`Invalid HSV values: ${JSON.stringify(hsv)} for device "${id}"`);
                    return res.status(400).json({ success: false, error: 'HSV values are required and must be numbers' });
                }
                await controller.setColor(hsv);
                console.log(`Action Performed - Set Color: Hue=${hsv.hue}, Saturation=${hsv.saturation}, Brightness=${hsv.brightness} for ${brand} device "${id}"`);
                return res.json({ success: true });

            default:
                console.warn(`Invalid action: ${action} for device "${id}"`);
                return res.status(400).json({ success: false, error: 'Invalid action' });
        }

    } catch (error) {
        console.error(`Error performing action on ${brand} device "${id}":`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// /backend/src/server.js

/**
 * @route   GET /api/devices
 * @desc    Retrieve all connected Hue and Kasa devices along with their current states
 */
app.get('/api/devices', async (req, res) => {
    try {
        const devices = {
            hue: [],
            kasa: []
        };

        // Fetch Hue devices
        if (hueApi) {
            const allHueLights = await hueApi.lights.getAll();
            devices.hue = allHueLights.map(light => ({
                id: light.id,
                name: light.name,
                type: light.type,
                modelId: light.modelId,
                state: {
                    on: light._rawData?.state?.on || false,
                    brightness: light._rawData?.state?.bri || 0,
                    hue: light._rawData?.state?.hue || 0,
                    saturation: light._rawData?.state?.sat || 0,
                    alert: light._rawData?.state?.alert || 'none',
                    effect: light._rawData?.state?.effect || 'none',
                    colorTemp: light._rawData?.state?.ct || 0
                }
            }));
        }

        // Fetch Kasa devices
        const kasaDevicesPromises = kasaLights.map(async (light) => ({
            light_id: light.light_id,
            alias: light.alias,
            host: light.host,
            type: light.deviceType,
            state: {
                on: await light.getPowerState(),
                brightness: light.supportsBrightness() ? await light.getBrightness() : null,
                color: light.supportsColor() ? await light.getColor() : null
            }
        }));

        // Wait for all Kasa device states to be fetched
        devices.kasa = await Promise.all(kasaDevicesPromises);

        res.json({ success: true, devices });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * Socket.IO Real-Time Communication
 */
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Listen for serialized graph data from frontend
    socket.on('update-graph', async (data) => { // Make the handler async
        console.log('Received graph data from frontend:', data);
        try {
            const graphData = JSON.parse(data);
            // Validate graph data
            const { error } = graphSchema.validate(graphData);
            if (error) {
                throw new Error(`Graph data validation failed: ${error.message}`);
            }
            await processGraphData(graphData); // Await the processing
            // Acknowledge receipt and processing status
            socket.emit('graph-processed', { success: true });
        } catch (error) {
            console.error('Error processing graph data:', error);
            socket.emit('graph-processed', { success: false, error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

/**
 * Function to process the received graph data
 */
async function processGraphData(graphData) { // Make this function async
    // Clear existing registry
    nodeRegistry.clear();

    // Reconstruct nodes
    const nodes = graphData.nodes || [];
    nodes.forEach(node => {
        nodeRegistry.addNode(node);
    });

    // Reconstruct connections
    const connections = graphData.connections || [];
    connections.forEach(conn => {
        nodeRegistry.addConnection(conn);
    });

    // After reconstruction, process nodes
    await executeWorkflow(); // Await the workflow execution
}

/**
 * Function to execute the workflow based on the node graph
 */
async function executeWorkflow() { // Make this function async
    const nodes = nodeRegistry.getNodes();
    const connections = nodeRegistry.getConnections();

    // Identify start nodes (nodes without incoming connections)
    const startNodes = Object.values(nodes).filter(node => {
        // A node is a start node if no connections target it
        return !connections.some(conn => conn.target_id === node.id);
    });

    // Traverse the graph and execute nodes
    for (const startNode of startNodes) {
        await traverseAndExecute(startNode, nodes, connections); // Await each traversal
    }
}

/**
 * Recursive function to traverse and execute nodes with data passing
 */
async function traverseAndExecute(currentNode, nodes, connections, inputData = {}) { // Declare as async
    console.log(`Executing node: ${currentNode.title} (ID: ${currentNode.id})`);

    let outputData = {};

    // Execute the current node based on its type and receive output data
    switch(currentNode.type) {
        case "custom/TimerNode":
            outputData = executeTimerNode(currentNode, inputData);
            break;
        case "custom/ConditionNode":
            outputData = await executeConditionNode(currentNode, inputData); // Await if function is async
            break;
        case "custom/ActionNode":
            outputData = await executeActionNode(currentNode, inputData); // Await since it's async
            break;
        // Add cases for other custom node types here
        default:
            console.warn(`Unknown node type: ${currentNode.type}`);
    }

    // Find outgoing connections from the current node
    const outgoingConnections = connections.filter(conn => conn.origin_id === currentNode.id);

    // For each outgoing connection, pass output data to the target node
    for (const conn of outgoingConnections) {
        const targetNode = nodes.find(node => node.id === conn.target_id);
        if (targetNode) {
            await traverseAndExecute(targetNode, nodes, connections, outputData); // Await recursive call
        } else {
            console.warn(`Target node with ID ${conn.target_id} not found.`);
        }
    }
}

/**
 * Function to execute TimerNode logic
 */
function executeTimerNode(node, inputData) {
    const { properties } = node;
    const { time, isActive } = properties;

    let outputData = {};

    if (isActive) {
        // Schedule the timer action
        commandScheduler.scheduleCommand({
            nodeId: node.id,
            type: 'TimerNode',
            time: time,
            // Include other necessary properties
        }, async () => {
            console.log(`TimerNode ${node.id} triggered at ${time}`);
            // Perform API calls or other actions here
            // Example: Turn on specific lights

            try {
                // Example for Hue light
                const hueLightName = 'Downstairs Fire Extinguisher'; // Replace with actual name or make dynamic
                const hueLight = hueLights.find(light => light.name.toLowerCase() === hueLightName.toLowerCase());
                if (hueLight) {
                    await hueLight.turnOn();
                    console.log(`Hue Light ${hueLight.name} turned on by TimerNode ${node.id}`);
                }

                // Example for Kasa device
                const kasaLightAlias = 'Smart Plug 01'; // Replace with actual alias or make dynamic
                const kasaLight = kasaLights.find(light => light.alias.toLowerCase() === kasaLightAlias.toLowerCase());
                if (kasaLight) {
                    await kasaLight.turnOn();
                    console.log(`Kasa Light ${kasaLight.alias} turned on by TimerNode ${node.id}`);
                }
            } catch (error) {
                console.error(`Error executing TimerNode ${node.id}:`, error);
            }
        });

        // Example output data
        outputData = { timerTriggered: true, time: time };
    } else {
        // If the timer is not active, ensure no scheduled tasks are pending
        commandScheduler.cancelCommand(node.id);
        console.log(`TimerNode ${node.id} is inactive. No actions scheduled.`);
        outputData = { timerTriggered: false };
    }

    return outputData;
}

/**
 * Function to execute ConditionNode logic
 */
async function executeConditionNode(node, inputData) { // Declare as async
    const { properties } = node;
    const { condition } = properties; // e.g., "timerTriggered === true"

    let outputData = {};

    try {
        // Evaluate the condition using Jexl
        const conditionResult = await Jexl.eval(condition, inputData);
        outputData = { conditionMet: conditionResult };
        console.log(`ConditionNode ${node.id} evaluated condition "${condition}" as ${conditionResult}`);
    } catch (error) {
        console.error(`Error evaluating condition in ConditionNode ${node.id}:`, error);
        outputData = { conditionMet: false, error: error.message };
    }

    return outputData;
}

/**
 * Function to execute ActionNode logic
 */
async function executeActionNode(node, inputData) { // Declare as async
    const { properties } = node;
    const { actionType, targetId } = properties; // e.g., actionType: "toggle", targetId: "2"

    let outputData = {};

    switch(actionType) {
        case 'toggle':
            // Determine if target is Hue or Kasa
            let hueLight;
            let kasaLight;

            if (hueApi) {
                hueLight = hueLights.find(light => light.id === targetId);
            }

            kasaLight = kasaLights.find(light => 
                light.light_id.toLowerCase() === targetId.toLowerCase() || 
                light.alias.toLowerCase() === targetId.toLowerCase()
            );

            if (hueLight) {
                // Toggle Hue light
                try {
                    await hueLight.toggle();
                    console.log(`ActionNode ${node.id} toggled Hue light ${hueLight.name}`);
                    outputData = { action: 'toggle', targetId, success: true };
                } catch (error) {
                    console.error(`Error toggling Hue light ${targetId} by ActionNode ${node.id}:`, error);
                    outputData = { action: 'toggle', targetId, success: false, error: error.message };
                }
            } else if (kasaLight) {
                // Toggle Kasa light
                try {
                    await kasaLight.toggle();
                    console.log(`ActionNode ${node.id} toggled Kasa light ${kasaLight.alias}`);
                    outputData = { action: 'toggle', targetId, success: true };
                } catch (error) {
                    console.error(`Error toggling Kasa light ${kasaLight.alias} by ActionNode ${node.id}:`, error);
                    outputData = { action: 'toggle', targetId, success: false, error: error.message };
                }
            } else {
                console.warn(`ActionNode ${node.id}: Target light ${targetId} not found in Hue or Kasa devices.`);
                outputData = { action: 'toggle', targetId, success: false, error: 'Target light not found' };
            }
            break;
        // Handle other action types here (e.g., 'turnOn', 'turnOff', etc.)
        default:
            console.warn(`Unknown action type: ${actionType} in ActionNode ${node.id}`);
    }

    return outputData;
}

// =====================
// Start the Server
// =====================
server.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}/`);
    console.log('Available on:');
    console.log(`  http://localhost:${PORT}/`);
    // Add other network IPs if necessary
});
