// /frontend/js/initializeGraph.js

// Import the Socket.IO client library
import { io } from "socket.io-client";

// Establish a Socket.IO connection to the Backend server
const socket = io("http://localhost:8081"); // Adjust the URL if Backend is hosted elsewhere

// Listen for connection events
socket.on("connect", () => {
    console.log(`Connected to backend with ID: ${socket.id}`);
});

socket.on("disconnect", () => {
    console.log("Disconnected from backend");
});

// Listen for 'graph-processed' event from the Backend

socket.on('graph-processed', (response) => {
    if (response.success) {
        console.log('Backend successfully processed the graph');
        // Optionally, provide user feedback in the UI
        showNotification("Graph processed successfully!", "success");
    } else {
        console.error('Error processing graph on backend:', response.error);
        // Optionally, notify the user about the error
        showNotification(`Error processing graph: ${response.error}`, "error");
    }
});


// Listen for 'error' events from the Socket.IO connection
socket.on('error', (error) => {
    console.error('Socket encountered error:', error);
    // Optionally, handle the error in the UI
    // Example: display an error notification
});

// Function to serialize the entire graph
function serializeGraph() {
    return graph.serialize();
}

// Debounce mechanism to prevent flooding the backend with rapid updates
let debounceTimeout;
const DEBOUNCE_DELAY = 300; // milliseconds

function emitGraphUpdate() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const serializedGraph = serializeGraph();
        socket.emit('update-graph', JSON.stringify(serializedGraph));
        console.log('Graph data emitted to backend');
    }, DEBOUNCE_DELAY);
}

window.addEventListener('load', function() {
    console.log("All scripts loaded. Initializing graph...");

    const canvas = document.getElementById("graphcanvas");
    if (canvas) {
        // Initialize the graph and canvas
        window.graph = new LGraph();
        window.graphCanvas = new LGraphCanvas(canvas, graph);
        
        // Customize graph appearance
        graphCanvas.background_color = "#1e1e1e"; // Match background color

        // Handle window resize to adjust the canvas
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            graphCanvas.resize();
        }

        // Initial resize
        resizeCanvas();

        // Add event listener for window resize
        window.addEventListener('resize', resizeCanvas);

        // Example: Add a TimerNode to the graph
        const timerNode = LiteGraph.createNode("custom/TimerNode");
        timerNode.pos = [200, 200];
        graph.add(timerNode);

        // Start the graph
        graph.start();

        // Assign event handlers to detect graph changes and emit updates
        graph.onNodeAdded = function(node) {
            console.log(`Node added: ${node.title}`);
            emitGraphUpdate();
        };

        graph.onNodeRemoved = function(node) {
            console.log(`Node removed: ${node.title}`);
            emitGraphUpdate();
        };

        graph.onConnectionChange = function() {
            console.log('Connection changed');
            emitGraphUpdate();
        };

        graph.onNodePropertyChanged = function(node, property, value) {
            console.log(`Node property changed: ${node.title} - ${property}: ${value}`);
            emitGraphUpdate();
        };
    } else {
        console.error("graphcanvas element not found");
    }
});
