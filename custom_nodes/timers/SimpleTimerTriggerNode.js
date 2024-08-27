class SimpleTimerTriggerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Simple Timer Trigger";
        this.size = [240, 140]; // Default size set here
        this.properties = {
            executeHour: 12,
            executeMinute: 0,
            executePeriod: "AM"
        };

        this.lastTriggerState = false;

        // Add widgets for setting the time
        this.addWidget("combo", "Hour", this.properties.executeHour, (value) => {
            this.properties.executeHour = value;
            this.setDirtyCanvas(true);
        }, { values: [...Array(12).keys()].map(i => i + 1) }); // 1-12

        this.addWidget("combo", "Minute", this.properties.executeMinute, (value) => {
            this.properties.executeMinute = value;
            this.setDirtyCanvas(true);
        }, { values: [...Array(60).keys()] }); // 0-59

        this.addWidget("combo", "Period", this.properties.executePeriod, (value) => {
            this.properties.executePeriod = value;
            this.setDirtyCanvas(true);
        }, { values: ["AM", "PM"] });

        this.addOutput("Trigger", "boolean");
    }

    onExecute() {
        const currentTime = new Date();
        let currentHours = currentTime.getHours();
        const currentMinutes = currentTime.getMinutes();

        // Convert properties to 24-hour format for comparison
        let executeHours = this.properties.executeHour;
        if (this.properties.executePeriod === "PM" && executeHours < 12) {
            executeHours += 12;
        }
        if (this.properties.executePeriod === "AM" && executeHours === 12) {
            executeHours = 0;
        }

        // Check if current time matches execute time
        const shouldTrigger = (currentHours === executeHours && currentMinutes === this.properties.executeMinute);

        if (shouldTrigger !== this.lastTriggerState) {
            this.setOutputData(0, shouldTrigger);
            console.log(`SimpleTimerTriggerNode - Outputting trigger state: ${shouldTrigger}`);
            this.triggerSlot(0); // Propagate the value
            this.lastTriggerState = shouldTrigger;
        }
    }

    onResize() {
        this.size = [240, 140]; // Enforcing the size in onResize
    }

    onDrawForeground(ctx) {
        // Background color and styling
        ctx.fillStyle = "#2c3e50"; // Dark blue-gray background
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
    }

    onStart() {
        this.size = [240, 140]; // Enforcing the size in onStart
    }

    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = data.properties || {
            executeHour: 12,
            executeMinute: 0,
            executePeriod: "AM"
        };
        this.setDirtyCanvas(true); // Ensure UI updates when node is loaded
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("custom/simple_timer_trigger", SimpleTimerTriggerNode);
