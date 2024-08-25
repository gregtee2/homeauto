class CombinedSunriseSunsetTimeOfDayNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Sunrise/Sunset + Time of Day";
        this.size = [300, 250];

        this.geolocationAvailable = false;

        // Properties for sunrise/sunset times and time offsets
        this.properties = {
            on_offset_hours: 0,
            on_offset_minutes: 0,
            on_offset_positive: false, // Before sunset by default
            off_offset_hours: 0,
            off_offset_minutes: 0,
            off_offset_positive: false, // Before sunrise by default
            latitude: null,
            longitude: null,
            final_on_time: "",
            final_off_time: ""
        };

        this.addOutput("State", "boolean");

        // Initialize widgets
        this.setupWidgets();

        // Initialize time objects to avoid null issues
        this.startTimeObj = { hours: 0, minutes: 0 };
        this.stopTimeObj = { hours: 0, minutes: 0 };
    }

    setupWidgets() {
        this.widgets = [];

        // Geolocation Button
        this.addWidget("button", "Fetch Geolocation", null, () => {
            this.fetchGeolocation();
        });

        // On Time Offset Controls
        this.addWidget("combo", "On Offset Hours", this.properties.on_offset_hours, (v) => {
            this.properties.on_offset_hours = parseInt(v, 10);
            this.updateOnTime();  // Update dynamically whenever hours change
        }, { values: Array.from({ length: 24 }, (_, i) => i) });

        this.addWidget("combo", "On Offset Minutes", this.properties.on_offset_minutes, (v) => {
            this.properties.on_offset_minutes = parseInt(v, 10);
            this.updateOnTime();  // Update dynamically whenever minutes change
        }, { values: Array.from({ length: 60 }, (_, i) => i) });

        this.addWidget("combo", "On Offset Timing", this.properties.on_offset_positive ? "After" : "Before", (v) => {
            this.properties.on_offset_positive = v === "After";
            this.updateOnTime();  // Update dynamically whenever timing changes
        }, { values: ["Before", "After"] });

        // Off Time Offset Controls
        this.addWidget("combo", "Off Offset Hours", this.properties.off_offset_hours, (v) => {
            this.properties.off_offset_hours = parseInt(v, 10);
            this.updateOffTime();  // Update dynamically whenever hours change
        }, { values: Array.from({ length: 24 }, (_, i) => i) });

        this.addWidget("combo", "Off Offset Minutes", this.properties.off_offset_minutes, (v) => {
            this.properties.off_offset_minutes = parseInt(v, 10);
            this.updateOffTime();  // Update dynamically whenever minutes change
        }, { values: Array.from({ length: 60 }, (_, i) => i) });

        this.addWidget("combo", "Off Offset Timing", this.properties.off_offset_positive ? "After" : "Before", (v) => {
            this.properties.off_offset_positive = v === "After";
            this.updateOffTime();  // Update dynamically whenever timing changes
        }, { values: ["Before", "After"] });

        // Display Final On and Off Times
        this.addWidget("text", "Final On Time (Sunset)", this.properties.final_on_time, null);
        this.addWidget("text", "Final Off Time (Sunrise)", this.properties.final_off_time, null);
    }

    fetchGeolocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.properties.latitude = position.coords.latitude;
                    this.properties.longitude = position.coords.longitude;
                    this.geolocationAvailable = true;
                    this.calculateSunTimes();
                },
                (error) => {
                    this.geolocationAvailable = false;
                }
            );
        } else {
            this.geolocationAvailable = false;
        }
    }

    calculateSunTimes() {
        if (this.geolocationAvailable) {
            const now = new Date();
            const sunTimes = SunCalc.getTimes(now, this.properties.latitude, this.properties.longitude);

            this.properties.sunrise_time = sunTimes.sunrise;
            this.properties.sunset_time = sunTimes.sunset;

            this.updateOnTime();
            this.updateOffTime();
        }
    }

    updateOnTime() {
        if (this.geolocationAvailable) {
            const finalOnTime = this.calculateOffsetTime(
                this.properties.sunset_time, 
                this.properties.on_offset_hours, 
                this.properties.on_offset_minutes, 
                this.properties.on_offset_positive
            );

            this.properties.final_on_time = finalOnTime;
            this.widgets[7].value = finalOnTime;  // Ensure correct widget index for Sunset time
            this.setDirtyCanvas(true);

            // Set the internal time for time-of-day logic
            this.startTimeObj = this.parseTimeString(finalOnTime);
        }
    }

    updateOffTime() {
        if (this.geolocationAvailable) {
            const finalOffTime = this.calculateOffsetTime(
                this.properties.sunrise_time, 
                this.properties.off_offset_hours, 
                this.properties.off_offset_minutes, 
                this.properties.off_offset_positive
            );

            this.properties.final_off_time = finalOffTime;
            this.widgets[8].value = finalOffTime;  // Ensure correct widget index for Sunrise time
            this.setDirtyCanvas(true);

            // Set the internal time for time-of-day logic
            this.stopTimeObj = this.parseTimeString(finalOffTime);
        }
    }

    calculateOffsetTime(baseTime, offsetHours, offsetMinutes, offsetPositive) {
        const date = new Date(baseTime);  // Directly use the Date object
        const offset = (offsetHours * 60 + offsetMinutes) * (offsetPositive ? 1 : -1);
        date.setMinutes(date.getMinutes() + offset);

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    parseTimeString(timeStr) {
        if (!timeStr) {
            return { hours: 0, minutes: 0 };  // Fallback to prevent null issues
        }
        
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

        return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
    }

    onExecute() {
        const currentState = this.isCurrentTimeWithinRange();

        if (currentState !== this.lastState) {
            this.lastState = currentState;
            this.setOutputData(0, currentState);
            console.log(`CombinedNode - Outputting state: ${currentState}`);
            this.triggerSlot(0);
        }
    }
}

LiteGraph.registerNodeType("custom/combined_sunrise_sunset_time_of_day", CombinedSunriseSunsetTimeOfDayNode);
