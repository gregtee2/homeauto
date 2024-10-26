// /frontend/custom_nodes/v1/Timers/TimerNode.js

export default class TimerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Timer";
        this.properties = { time: "12:00", isActive: false };
        this.addOutput("trigger", "boolean");
        this.addProperty("time", "12:00");
        this.addProperty("isActive", false);
    }

    onPropertyChanged(name, value) {
        if (name === "time") {
            this.setTime(value);
        }
        if (name === "isActive") {
            if (value) {
                this.activate();
            } else {
                this.deactivate();
            }
        }
    }

    setTime(time) {
        this.properties.time = time;
        // Additional logic to handle time changes
        this.updateOutput();
    }

    activate() {
        this.properties.isActive = true;
        // Additional logic to activate the timer
    }

    deactivate() {
        this.properties.isActive = false;
        // Additional logic to deactivate the timer
    }

    execute() {
        if (this.properties.isActive) {
            console.log(`TimerNode triggered at ${this.properties.time}`);
            // Implement the logic to trigger connected nodes or backend actions
            this.setOutputData(0, true); // Trigger the output
        } else {
            this.setOutputData(0, false);
        }
    }
}
