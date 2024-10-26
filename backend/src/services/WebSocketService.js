// T2Auto/backend/src/services/WebSocketService.js

let wss = null; // WebSocket Server reference

/**
 * Initializes the WebSocket server.
 * @param {WebSocket.Server} wsServer - The WebSocket server instance.
 */
function initializeWebSocket(wsServer) {
    wss = wsServer;

    wss.on("connection", (ws) => {
        console.log("WebSocket client connected.");

        ws.on("message", (message) => {
            console.log("Received message from client:", message);
            // Handle incoming messages if needed
        });

        ws.on("close", () => {
            console.log("WebSocket client disconnected.");
        });
    });
}

/**
 * Sends a message to all connected WebSocket clients.
 * @param {object} message - The message object to send.
 */
function sendWebSocketMessage(message) {
    if (!wss) {
        console.error("WebSocket server not initialized.");
        return;
    }

    const data = JSON.stringify(message);

    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(data);
        }
    });
}

module.exports = { initializeWebSocket, sendWebSocketMessage };
