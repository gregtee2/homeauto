class TimeOfDayNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Time of Day";
        this.size = [220, 200];  // Adjusted size to accommodate widgets

        // Properties that will be editable through the UI
        this.properties = {
            start_hour: 8,
            start_minute: 0,
            start_ampm: "AM",
            stop_hour: 6,
            stop_minute: 0,
            stop_ampm: "PM"
        };

        this.addOutput("State", "boolean");

        // Initialize widgets
        this.setupWidgets();

        // Parse the initial start and stop times
        this.startTimeObj = this.parseTime(this.properties.start_hour, this.properties.start_minute, this.properties.start_ampm);
        this.stopTimeObj = this.parseTime(this.properties.stop_hour, this.properties.stop_minute, this.properties.stop_ampm);

        // Force the size after widgets are added
        this.forceSize();

        // Internal state
        this.currentState = null;  // Tracks the current state (true/false)
        this.timeoutId = null;     // ID of the scheduled timeout

        // Listen for visibility changes to handle tab activation
        document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));

        console.log("TimeOfDayNode - Initialized.");
    }

    setupWidgets() {
        this.widgets = [];

        // Start Time Widgets
        this.addWidget("combo", "Start Hour", this.properties.start_hour, (v) => {
            this.properties.start_hour = parseInt(v, 10);
            this.updateTimes();
        }, { values: Array.from({ length: 12 }, (_, i) => i + 1) });

        this.addWidget("combo", "Start Minute", this.properties.start_minute, (v) => {
            this.properties.start_minute = parseInt(v, 10);
            this.updateTimes();
        }, { values: Array.from({ length: 60 }, (_, i) => this.formatMinute(i)) });

        this.addWidget("combo", "Start AM/PM", this.properties.start_ampm, (v) => {
            this.properties.start_ampm = v;
            this.updateTimes();
        }, { values: ["AM", "PM"] });

        // Stop Time Widgets
        this.addWidget("combo", "Stop Hour", this.properties.stop_hour, (v) => {
            this.properties.stop_hour = parseInt(v, 10);
            this.updateTimes();
        }, { values: Array.from({ length: 12 }, (_, i) => i + 1) });

        this.addWidget("combo", "Stop Minute", this.properties.stop_minute, (v) => {
            this.properties.stop_minute = parseInt(v, 10);
            this.updateTimes();
        }, { values: Array.from({ length: 60 }, (_, i) => this.formatMinute(i)) });

        this.addWidget("combo", "Stop AM/PM", this.properties.stop_ampm, (v) => {
            this.properties.stop_ampm = v;
            this.updateTimes();
        }, { values: ["AM", "PM"] });

        // Force the size again after widgets setup
        this.forceSize();
    }

    formatMinute(minute) {
        // Ensure minutes are displayed as two digits
        return minute < 10 ? `0${minute}` : `${minute}`;
    }

    updateTimes() {
        // Update the internal time objects whenever the user changes the time via widgets
        this.startTimeObj = this.parseTime(this.properties.start_hour, this.properties.start_minute, this.properties.start_ampm);
        this.stopTimeObj = this.parseTime(this.properties.stop_hour, this.properties.stop_minute, this.properties.stop_ampm);
        this.setDirtyCanvas(true);  // Redraw the canvas to reflect changes

        // Reschedule the next state check
        this.scheduleNextCheck();
    }

    parseTime(hour, minute, ampm) {
        if (ampm === "PM" && hour !== 12) {
            hour += 12;
        }
        if (ampm === "AM" && hour === 12) {
            hour = 0;
        }

        return { hours: hour, minutes: minute };
    }

    isCurrentTimeWithinRange() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const startMinutes = this.startTimeObj.hours * 60 + this.startTimeObj.minutes;
        const stopMinutes = this.stopTimeObj.hours * 60 + this.stopTimeObj.minutes;

        return (startMinutes < stopMinutes)
            ? currentMinutes >= startMinutes && currentMinutes < stopMinutes
            : currentMinutes >= startMinutes || currentMinutes < stopMinutes;
    }

    onExecute() {
        const currentState = this.isCurrentTimeWithinRange();

        if (currentState !== this.lastState) {
            this.lastState = currentState;
            this.setOutputData(0, currentState);
            console.log(`TimeOfDayNode - Outputting state: ${currentState}`);
            this.triggerSlot(0);
        }
    }

    onDrawForeground(ctx) {
        ctx.fillStyle = "rgb(34, 139, 34)";  // Start time text color - Green
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`Start: ${this.properties.start_hour}:${this.formatMinute(this.properties.start_minute)} ${this.properties.start_ampm}`, 10, this.size[1] - 50);

        ctx.fillStyle = "#FF0000";  // Stop time text color - Red
        ctx.fillText(`Stop: ${this.properties.stop_hour}:${this.formatMinute(this.properties.stop_minute)} ${this.properties.stop_ampm}`, 10, this.size[1] - 30);
    }

    scheduleNextCheck() {
        // Clear any existing timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const startMinutes = this.startTimeObj.hours * 60 + this.startTimeObj.minutes;
        const stopMinutes = this.stopTimeObj.hours * 60 + this.stopTimeObj.minutes;

        let nextChange;
        if (startMinutes < stopMinutes) {
            nextChange = (currentMinutes < startMinutes) ? startMinutes : stopMinutes;
        } else {
            nextChange = (currentMinutes < stopMinutes) ? stopMinutes : startMinutes + (24 * 60);  // Add a day if overnight
        }

        const delayInMillis = (nextChange * 60 * 1000) - (now.getTime() % (24 * 60 * 60 * 1000)); // Delay to the next event

        // Schedule the next state change
        this.timeoutId = setTimeout(() => {
            this.checkAndUpdateState();
            this.scheduleNextCheck();  // Schedule the next change
        }, delayInMillis > 0 ? delayInMillis : 0);

        // Fallback to requestAnimationFrame to check periodically even if the tab is inactive
        const fallbackCheck = () => {
            if (this.timeoutId) return;  // Skip if setTimeout hasn't fired yet
            this.checkAndUpdateState();
            requestAnimationFrame(fallbackCheck);
        };
        requestAnimationFrame(fallbackCheck);
    }

    checkAndUpdateState() {
        const newState = this.isCurrentTimeWithinRange();
        if (newState !== this.currentState) {
            this.currentState = newState;
            this.setOutputData(0, this.currentState);
            console.log(`TimeOfDayNode - State changed to: ${this.currentState}`);
            this.triggerSlot(0);
        }
    }

    handleVisibilityChange() {
        if (!document.hidden) {
            console.log("TimeOfDayNode - Tab became active. Performing immediate state check.");
            this.checkAndUpdateState();
            this.scheduleNextCheck();  // Reschedule based on the current time
        }
    }

    onSerialize(o) {
        o.properties = LiteGraph.cloneObject(this.properties);  // Ensure properties are saved
    }

    onConfigure(o) {
        this.properties = LiteGraph.cloneObject(o.properties);  // Restore properties when loading
        this.setupWidgets();  // Recreate widgets based on restored properties
        this.updateTimes();  // Ensure the internal times are updated based on restored properties
        this.forceSize();  // Force the size when the node is configured
    }

    forceSize() {
        this.size = [220, 250];  // Ensure the size is consistently applied in multiple locations
    }

    onAdded() {
        this.forceSize();  // Ensure the size is set when the node is added to the graph
        this.currentState = this.isCurrentTimeWithinRange();
        this.setOutputData(0, this.currentState);
        this.triggerSlot(0);  // Emit the initial state
        this.scheduleNextCheck();  // Schedule the first state check
    }

    onRemoved() {
        // Clear any existing timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Remove visibility change listener
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
}

// Register the node with LiteGraph under the "Timers" category
LiteGraph.registerNodeType("Timers/time_of_day", TimeOfDayNode);
