// T2Auto/frontend/custom_nodes/v02/ToggleNode.js

// Ensure LiteGraph is available globally
const LiteGraph = window.LiteGraph;

// Define the ToggleNode class
function ToggleNode() {
    this.addOutput("State", "boolean"); // Output port to indicate current state
    this.properties = { state: false }; // Initial state (OFF)
    this.size = [150, 60]; // Node size
    this.title = "Toggle On/Off"; // Node title
}

// Extend LiteGraph.LGraphNode
LiteGraph.registerNodeType("Control/ToggleOnOff", ToggleNode);

// Implement the onExecute method
ToggleNode.prototype.onExecute = function() {
    // Output the current state
    this.setOutputData(0, this.properties.state);
};

// Implement the onDrawForeground method for custom rendering
ToggleNode.prototype.onDrawForeground = function(ctx) {
    // Set background color based on state
    ctx.fillStyle = this.properties.state ? "#4CAF50" : "#F44336"; // Green for ON, Red for OFF
    ctx.fillRect(0, 0, this.size[0], this.size[1]);

    // Set text properties
    ctx.fillStyle = "#FFFFFF"; // White text
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw the state text
    const stateText = this.properties.state ? "ON" : "OFF";
    ctx.fillText(stateText, this.size[0] / 2, this.size[1] / 2);
};

// Implement the onMouseDown method to handle clicks
ToggleNode.prototype.onMouseDown = function(e, pos) {
    // Toggle the state
    this.properties.state = !this.properties.state;
    this.setDirtyCanvas(true); // Redraw the node

    // Send the updated state to the backend
    this.sendStateToBackend();

    return true; // Indicate that the event was handled
};

// Method to send state to the backend
ToggleNode.prototype.sendStateToBackend = function() {
    const payload = {
        nodeType: "ToggleOnOff",
        state: this.properties.state
    };

    fetch("http://localhost:8081/api/update-node", { // Ensure this URL matches your backend endpoint
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        console.log("ToggleNode - State sent to backend:", data);
    })
    .catch(error => {
        console.error("ToggleNode - Error sending state to backend:", error);
    });
};
