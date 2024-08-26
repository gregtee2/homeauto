class TimeOfDayTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Time of Day Test";
        this.size = [220, 150];

        this.properties = {
            start_time: "8:00 AM",
            stop_time: "6:00 PM",
            use_external_time: false
        };

        this.addOutput("State", "boolean");
        this.addInput("Time Input", "object");

        this.setupWidgets();

        this.startTimeObj = this.parseTimeString(this.properties.start_time);
        this.stopTimeObj = this.parseTimeString(this.properties.stop_time);

        this.lastState = null;
    }

    setupWidgets() {
        this.widgets = [];
        this.addWidget("toggle", "Use External Time", this.properties.use_external_time, (v) => {
            this.properties.use_external_time = v;
            this.updateTimes();
        });

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
        if (this.properties.use_external_time) {
            const timeData = this.getInputData(0);
            if (timeData) {
                console.log("Received external time data:", timeData);
                this.properties.start_time = timeData.onTime || this.properties.start_time;
                this.properties.stop_time = timeData.offTime || this.properties.stop_time;
                this.startTimeObj = this.parseTimeString(this.properties.start_time);
                this.stopTimeObj = this.parseTimeString(this.properties.stop_time);

                this.widgets[1].value = this.properties.start_time;
                this.widgets[2].value = this.properties.stop_time;

                this.setDirtyCanvas(true);
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
        console.log(`Parsed time - Hours: ${hours}, Minutes: ${minutes}`);
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

        if (currentMinutes >= startMinutes && currentMinutes < stopMinutes) {
            console.log("Time is within range, triggering On command.");
            return true;
        } else {
            console.log("Time is outside range, triggering Off command.");
            return false;
        }
    }

    onExecute() {
        if (this.properties.use_external_time) {
            this.updateTimes();  // Ensure the start time is updated from the external node
        }

        const currentState = this.isCurrentTimeWithinRange();

        if (currentState !== this.lastState) {
            this.lastState = currentState;
            this.setOutputData(0, currentState);
            console.log(`TimeOfDayTestNode - Outputting state: ${currentState ? 'On' : 'Off'}`);
            this.triggerSlot(0);
        }
    }

}

LiteGraph.registerNodeType("custom/time_of_day_test", TimeOfDayTestNode);
