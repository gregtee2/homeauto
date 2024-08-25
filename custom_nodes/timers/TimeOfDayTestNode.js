class TimeOfDayTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Time of Day Test";
        this.size = [220, 150];

        // Properties that will be editable through the UI
        this.properties = {
            start_time: "8:00 AM",  // Default start time
            stop_time: "6:00 PM",  // Default stop time
            use_external_time: false  // Toggle to use external time
        };

        this.addOutput("State", "boolean");
        this.addInput("Time Input", "object");  // Input to receive the time data

        // Initialize widgets
        this.setupWidgets();

        // Parse the initial start and stop times
        this.startTimeObj = this.parseTimeString(this.properties.start_time);
        this.stopTimeObj = this.parseTimeString(this.properties.stop_time);
    }

    setupWidgets() {
        this.widgets = [];

        // Toggle Widget to use external time
        this.addWidget("toggle", "Use External Time", this.properties.use_external_time, (v) => {
            this.properties.use_external_time = v;
            this.updateTimes();  // Force update when the toggle is switched
        });

        // Start Time and Stop Time Widgets
        this.addWidget("text", "Start Time", this.properties.start_time, (v) => {
            this.properties.start_time = v;
            this.startTimeObj = this.parseTimeString(v);
            console.log(`Manual Start Time set to: ${v}`);
        });
        this.addWidget("text", "Stop Time", this.properties.stop_time, (v) => {
            this.properties.stop_time = v;
            this.stopTimeObj = this.parseTimeString(v);
            console.log(`Manual Stop Time set to: ${v}`);
        });
    }

    updateTimes() {
        // If the toggle is on, pull the time from the connected node
        if (this.properties.use_external_time) {
            const timeData = this.getInputData(0);
            if (timeData) {
                if (this.properties.start_time !== timeData.onTime || this.properties.stop_time !== timeData.offTime) {
                    console.log("Received time data:", timeData);
                    this.properties.start_time = timeData.onTime || this.properties.start_time;
                    this.properties.stop_time = timeData.offTime || this.properties.stop_time;
                    this.startTimeObj = this.parseTimeString(this.properties.start_time);
                    this.stopTimeObj = this.parseTimeString(this.properties.stop_time);

                    this.widgets[1].value = this.properties.start_time;
                    this.widgets[2].value = this.properties.stop_time;

                    this.setDirtyCanvas(true);  // Redraw the canvas to reflect changes
                }
            }
        }
    }

    parseTimeString(timeStr) {
        const [time, ampm] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);
        if (ampm === "PM" && hours !== 12) {
            hours += 12;
        }
        if (ampm === "AM" && hours === 12) {
            hours = 0;
        }
        return { hours, minutes };
    }

    isCurrentTimeWithinRange() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const startMinutes = this.startTimeObj.hours * 60 + this.startTimeObj.minutes;
        const stopMinutes = this.stopTimeObj.hours * 60 + this.stopTimeObj.minutes;

        console.log(`Current Time: ${now.toLocaleTimeString()}`);
        console.log(`Start Time (minutes): ${startMinutes}`);
        console.log(`Stop Time (minutes): ${stopMinutes}`);
        console.log(`Current Minutes: ${currentMinutes}`);

        return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
    }

    onExecute() {
        if (this.properties.use_external_time) {
            this.updateTimes();  // Ensure the start time is updated from the external node
        }

        const currentState = this.isCurrentTimeWithinRange();

        if (currentState !== this.lastState) {
            this.lastState = currentState;
            this.setOutputData(0, currentState);
            console.log(`TimeOfDayTestNode - Outputting state: ${currentState}`);
            this.triggerSlot(0);
        }
    }
}

LiteGraph.registerNodeType("custom/time_of_day_test", TimeOfDayTestNode);
