// File: src/nodes/PushButtonNode.js

class PushButtonNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Simple On/Off";
        this.size = [200, 60];
        this.properties = { state: false };
        this.debounceTimeout = null; // Timeout for debouncing
        this.isProcessing = false;   // Flag to prevent multiple concurrent commands

        this.addOutput("State", "boolean");

        console.log("PushButtonNode - Initialized.");
    }

    /**
     * Handles the button press.
     * Toggles the state and emits the new state.
     */
    onMouseDown(e, pos) {
        // Check if the click is within the node's boundaries
        if (
            pos[0] >= 0 &&
            pos[0] <= this.size[0] &&
            pos[1] >= 0 &&
            pos[1] <= this.size[1]
        ) {
            console.log("PushButtonNode - Mouse down detected.");

            if (this.isProcessing) {
                console.warn("PushButtonNode - Currently processing a state change. Ignoring this click.");
                return false; // Ignore the click if already processing
            }

            // Toggle the state
            this.properties.state = !this.properties.state;
            console.log(`PushButtonNode - Toggled state to: ${this.properties.state ? "ON" : "OFF"}`);
            this.setDirtyCanvas(true); // Redraw the canvas

            // Emit the new state after a short debounce
            this.isProcessing = true;
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }

            this.debounceTimeout = setTimeout(() => {
                this.setOutputData(0, this.properties.state);
                console.log(`PushButtonNode - Outputting new state: ${this.properties.state ? "ON" : "OFF"}`);
                this.triggerSlot(0); // Trigger the connected node
                this.isProcessing = false;
            }, 300); // Debounce delay (adjust as necessary)

            return true; // Indicate that the event was handled
        }
        return false;
    }

    /**
     * Draws the node's foreground, displaying the current state.
     */
    onDrawForeground(ctx) {
        ctx.fillStyle = this.properties.state ? "#6c6" : "#c66";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
            this.properties.state ? "ON" : "OFF",
            this.size[0] * 0.5,
            this.size[1] * 0.5 + 7
        );
    }

    /**
     * Initializes the node when loaded.
     */
    onLoad() {
        this.properties.state = false; // Reset state to "Off" on load
        this.setOutputData(0, this.properties.state);
        this.setDirtyCanvas(true); // Redraw the canvas
        console.log("PushButtonNode - Loaded with state OFF.");
    }

    /**
     * Serializes the node's state for saving.
     * @returns {object} Serialized data.
     */
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    /**
     * Configures the node from serialized data.
     * @param {object} data Serialized data.
     */
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.setOutputData(0, this.properties.state);
        this.setDirtyCanvas(true);
        console.log("PushButtonNode - Configured with state:", this.properties.state ? "ON" : "OFF");
    }
}

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Execution/pushbutton"]) {
    LiteGraph.registerNodeType("Execution/pushbutton", PushButtonNode);
    console.log("PushButtonNode - Registered successfully under 'Execution' category.");
}
