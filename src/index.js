// File: src/index.js

import deviceManager from './services/DeviceManager.js';
import stateStore from './services/StateStore.js';
import './nodes/SmartLightControlNode.js'; // Ensure the node is loaded

// Register the Hue device
deviceManager.registerDevice('Hue', {
    light_id: '1', // Unique identifier for the Hue light
    bridge_ip: '192.168.1.39', // IP address of the Hue Bridge
    api_key: 'RCxxMfvLJP5-LoLFlS44HuEWWC5R10nMnGGcbnf1' // API key for the Hue Bridge
});

// Optionally, register other devices here
// deviceManager.registerDevice('Kasa', { ... });
// deviceManager.registerDevice('Insteon', { ... });

// Initialize LiteGraph (assuming you have a canvas or container)
const graph = new LiteGraph.LGraph();

// Optionally, load a predefined graph
// graph.configure(JSON.parse(localStorage.getItem('graph')) || {});

// Create a canvas and link it to the graph
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 600;
document.body.appendChild(canvas);

const graphCanvas = new LiteGraph.LGraphCanvas(canvas, graph);

// Optional: Add nodes programmatically for testing
/*
const timerNode = LiteGraph.createNode("Time/Timer");
timerNode.pos = [100, 100];
graph.add(timerNode);

const controlNode = LiteGraph.createNode("SmartLights/Control");
controlNode.pos = [300, 100];
graph.add(controlNode);

timerNode.connect(0, controlNode, 0);
*/

graph.start();

// Optional: Save the graph state periodically
/*
setInterval(() => {
    const graphData = graph.serialize();
    localStorage.setItem('graph', JSON.stringify(graphData));
}, 5000);
*/
