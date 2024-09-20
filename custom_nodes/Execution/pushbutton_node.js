

//prior pushbutton code before event handler inserts
class PushButtonNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Simple On/Off";
        this.size = [200, 60];
        this.properties = { state: false };
        this.lastState = null; // Keep track of the last state
        this.debounceTimeout = null; // Timeout for debouncing

        this.addOutput("State", "boolean");
    }

    onExecute() {
        // Ensure lastState is initialized properly if it's the first run
        if (typeof this.lastState === 'undefined') {
            this.lastState = this.properties.state;
        }

        // Only trigger the output if the state has changed
        if (this.properties.state !== this.lastState) {
            console.log(`PushButtonNode - State change detected, processing...`);
            this.lastState = this.properties.state; // Update the last known state
            
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => {
                this.setOutputData(0, this.properties.state);
                console.log(`PushButtonNode - Outputting new state: ${this.properties.state}`);
                this.triggerSlot(0); // Trigger the connected node
            }, 500); // Adjust debounce delay as necessary
        } else {
            // Add condition to throttle "no change" logs
            if (!this.skipNoChangeLog) {
                //console.log(`PushButtonNode - No state change, skipping output.`);
                this.skipNoChangeLog = true;
                setTimeout(() => { this.skipNoChangeLog = false; }, 5000); // Log only every 5 seconds
            }
        }
    }






    onMouseDown(e, pos) {
        if (pos[0] >= 0 && pos[0] <= this.size[0] && pos[1] >= 0 && pos[1] <= this.size[1]) {
            this.properties.state = !this.properties.state;
            this.setDirtyCanvas(true); // Redraw the canvas
            this.onExecute();
            return true;
        }
        return false;
    }

    onDrawForeground(ctx) {
        ctx.fillStyle = this.properties.state ? "#6c6" : "#c66";
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.properties.state ? "ON" : "OFF", this.size[0] * 0.5, this.size[1] * 0.5 + 7);
    }

    onLoad() {
        this.properties.state = false; // Reset state to "Off" on load
        this.setOutputData(0, this.properties.state);
        this.setDirtyCanvas(true); // Redraw the canvas
    }
}

LiteGraph.registerNodeType("Execution/pushbutton", PushButtonNode);
