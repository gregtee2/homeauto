class IndependentSunriseSunsetTriggerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Sunrise/Sunset Trigger with Time Output";
        this.size = [300, 150];

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

        this.addOutput("Times", "object");  // Output to send the times

        // Initialize widgets
        this.setupWidgets();

        // Time objects
        this.startTimeObj = null;
        this.stopTimeObj = null;

        // Add a property to track the last calculation date
        this.lastCalculationDate = null;
    }

    setupWidgets() {
        this.widgets = [];

        // Geolocation Button
        this.addWidget("button", "Fetch Geolocation", null, () => {
            this.fetchGeolocation();
        });

        // Manual Latitude Input
        this.addWidget("number", "Latitude", this.properties.latitude || 0, (v) => {
            this.properties.latitude = parseFloat(v);
            if (!isNaN(this.properties.latitude) && !isNaN(this.properties.longitude)) {
                this.geolocationAvailable = true;
                this.calculateSunTimes();
            }
        });

        // Manual Longitude Input
        this.addWidget("number", "Longitude", this.properties.longitude || 0, (v) => {
            this.properties.longitude = parseFloat(v);
            if (!isNaN(this.properties.latitude) && !isNaN(this.properties.longitude)) {
                this.geolocationAvailable = true;
                this.calculateSunTimes();
            }
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
        if (this.geolocationAvailable && this.properties.latitude != null && this.properties.longitude != null) {
            const now = new Date();
            // Store the date of this calculation
            this.lastCalculationDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
            this.widgets[9].value = finalOnTime;  // Adjusted index for widgets
            this.setDirtyCanvas(true);

            // Send the updated time data
            this.sendTimeData();
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
            this.widgets[10].value = finalOffTime;  // Adjusted index for widgets
            this.setDirtyCanvas(true);

            // Send the updated time data
            this.sendTimeData();
        }
    }

    calculateOffsetTime(baseTime, offsetHours, offsetMinutes, offsetPositive) {
        const date = new Date(baseTime);  // Directly use the Date object
        const offset = (offsetHours * 60 + offsetMinutes) * (offsetPositive ? 1 : -1);
        date.setMinutes(date.getMinutes() + offset);

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    sendTimeData() {
        const times = {
            onTime: this.properties.final_on_time,
            offTime: this.properties.final_off_time
        };
        this.setOutputData(0, times);  // Send both times as an object
    }

    onExecute() {
        // If geolocation is not available, try to fetch it
        if (!this.geolocationAvailable && (this.properties.latitude == null || this.properties.longitude == null)) {
            // Do nothing; waiting for user to provide location
            return;
        }

        const now = new Date();
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (this.lastCalculationDate == null || currentDate.getTime() !== this.lastCalculationDate.getTime()) {
            this.calculateSunTimes();
        }

        this.sendTimeData();  // Continuously send the time data
    }
}

LiteGraph.registerNodeType("custom/independent_sunrise_sunset_trigger", IndependentSunriseSunsetTriggerNode);
