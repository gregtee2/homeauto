class TimeOfDaySunriseSunset extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Sunrise/Sunset Trigger";
        this.size = [300, 300];
        this.isEnabled = false;  // Add this flag for enabling/disabling the node

        this.geolocationAvailable = false;

        // Properties for sunrise/sunset times, time offsets, city, and timezone
        this.properties = {
            on_offset_hours: 0,
            on_offset_minutes: 0,
            on_offset_positive: false, // Before sunset by default
            off_offset_hours: 0,
            off_offset_minutes: 0,
            off_offset_positive: false, // Before sunrise by default
            latitude: null,
            longitude: null,
            city: "Fetching...",
            timezone: "Fetching...",
            final_on_time: "",
            final_off_time: ""
        };

        this.addOutput("State", "boolean");

        // Initialize widgets
        this.setupWidgets();

        // Initialize time objects to avoid null issues
        this.startTimeObj = { hours: 0, minutes: 0 };
        this.stopTimeObj = { hours: 0, minutes: 0 };

        // Track the last triggered state
        this.lastState = null;

        // Automatically fetch geolocation on load
        this.initializeTimes();

        // Set up daily update for sunrise/sunset times
        this.setupDailyUpdate();  // Add this line
    }

    // New Method: Initialize Times
    initializeTimes() {
        // Automatically fetch geolocation if available
        if (navigator.geolocation) {
            this.fetchGeolocation();
        } else {
            // If geolocation isn't available, initialize with default coordinates
            this.properties.latitude = 40.7128; // Default to New York City
            this.properties.longitude = -74.0060;
            this.geolocationAvailable = true;
            this.calculateSunTimes();
        }
    }

    setupDailyUpdate() {
        const timeUntilUpdate = 10 * 1000; // 1 minute from now

        setTimeout(() => {
            console.log("Triggering daily update for sunrise/sunset times.");
            this.calculateSunTimes(); // Recalculate times
            console.log("Sunrise and sunset times recalculated.");
            this.setupDailyUpdate();  // Re-setup for the next update
        }, timeUntilUpdate);
    }

    setupWidgets() {
        this.widgets = [];

        // Geolocation Button
        this.addWidget("button", "Fetch Geolocation", null, () => {
            console.log("Fetching geolocation...");
            this.fetchGeolocation();
        });

        // City and Timezone Display
        this.addWidget("text", "City", this.properties.city, null);
        this.addWidget("text", "Timezone", this.properties.timezone, null);

        // On Time Offset Controls
        this.addWidget("combo", "On Offset Hours", this.properties.on_offset_hours, (v) => {
            this.properties.on_offset_hours = parseInt(v, 10);
            console.log(`On Offset Hours changed to: ${this.properties.on_offset_hours}`);
            this.updateOnTime();
        }, { values: Array.from({ length: 24 }, (_, i) => i) });

        this.addWidget("combo", "On Offset Minutes", this.properties.on_offset_minutes, (v) => {
            this.properties.on_offset_minutes = parseInt(v, 10);
            console.log(`On Offset Minutes changed to: ${this.properties.on_offset_minutes}`);
            this.updateOnTime();
        }, { values: Array.from({ length: 60 }, (_, i) => i) });

        this.addWidget("combo", "On Offset Timing", this.properties.on_offset_positive ? "After" : "Before", (v) => {
            this.properties.on_offset_positive = v === "After";
            console.log(`On Offset Timing changed to: ${this.properties.on_offset_positive ? 'After' : 'Before'}`);
            this.updateOnTime();
        }, { values: ["Before", "After"] });

        // Off Time Offset Controls
        this.addWidget("combo", "Off Offset Hours", this.properties.off_offset_hours, (v) => {
            this.properties.off_offset_hours = parseInt(v, 10);
            console.log(`Off Offset Hours changed to: ${this.properties.off_offset_hours}`);
            this.updateOffTime();
        }, { values: Array.from({ length: 24 }, (_, i) => i) });

        this.addWidget("combo", "Off Offset Minutes", this.properties.off_offset_minutes, (v) => {
            this.properties.off_offset_minutes = parseInt(v, 10);
            console.log(`Off Offset Minutes changed to: ${this.properties.off_offset_minutes}`);
            this.updateOffTime();
        }, { values: Array.from({ length: 60 }, (_, i) => i) });

        this.addWidget("combo", "Off Offset Timing", this.properties.off_offset_positive ? "After" : "Before", (v) => {
            this.properties.off_offset_positive = v === "After";
            console.log(`Off Offset Timing changed to: ${this.properties.off_offset_positive ? 'After' : 'Before'}`);
            this.updateOffTime();
        }, { values: ["Before", "After"] });

        // Display Final On and Off Times
        this.addWidget("text", "Final On Time (Sunset)", this.properties.final_on_time, null);
        this.addWidget("text", "Final Off Time (Sunrise)", this.properties.final_off_time, null);

        // Enable/Disable Toggle
        this.addWidget("toggle", "Enable Node", this.isEnabled, (v) => {
            this.isEnabled = v;
            console.log(`Node is now ${this.isEnabled ? 'enabled' : 'disabled'}`);
        });
    }

    fetchGeolocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.properties.latitude = position.coords.latitude;
                    this.properties.longitude = position.coords.longitude;
                    this.geolocationAvailable = true;
                    console.log(`Geolocation fetched: Latitude ${this.properties.latitude}, Longitude ${this.properties.longitude}`);
                    this.calculateSunTimes();
                    this.fetchCityAndTimezone();
                },
                (error) => {
                    console.error("Geolocation failed:", error);
                    this.geolocationAvailable = false;
                    this.properties.city = "Geolocation failed";
                    this.properties.timezone = "N/A";
                    this.setDirtyCanvas(true);
                }
            );
        } else {
            console.error("Geolocation not supported.");
            this.geolocationAvailable = false;
            this.properties.city = "Geolocation not supported";
            this.properties.timezone = "N/A";
            this.setDirtyCanvas(true);
        }
    }

    fetchCityAndTimezone() {
        const apiUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${this.properties.latitude}&longitude=${this.properties.longitude}&localityLanguage=en`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                this.properties.city = data.city || "Unknown City";
                console.log(`City fetched: ${this.properties.city}`);

                const date = new Date();
                const timeZoneName = Intl.DateTimeFormat('en-US', {
                    timeZone: data.timezone,
                    timeZoneName: 'short'
                }).formatToParts(date).find(part => part.type === 'timeZoneName').value;

                this.properties.timezone = timeZoneName || "Unknown Timezone";
                console.log(`Timezone fetched: ${this.properties.timezone}`);

                // Update the widgets with city and timezone
                this.widgets[1].value = this.properties.city;
                this.widgets[2].value = this.properties.timezone;

                this.setDirtyCanvas(true);
            })
            .catch(error => {
                console.error("Failed to fetch city and timezone:", error);
                this.properties.city = "API Error";
                this.properties.timezone = "API Error";
                this.setDirtyCanvas(true);
            });
    }

    calculateSunTimes() {
        if (this.geolocationAvailable) {
            // Get the current date and time
            let now = new Date();

            // Simulate 1 minute before midnight
            now.setHours(23, 59, 0, 0);  // Set time to 11:59 PM

            console.log(`Simulating time: ${now}`);

            const sunTimes = SunCalc.getTimes(now, this.properties.latitude, this.properties.longitude);

            this.properties.sunrise_time = sunTimes.sunrise;
            this.properties.sunset_time = sunTimes.sunset;
            console.log(`Simulated Sunrise time: ${this.properties.sunrise_time}`);
            console.log(`Simulated Sunset time: ${this.properties.sunset_time}`);

            this.updateOnTime(true);
            this.updateOffTime(true);
        }
    }

    updateOnTime(forceUpdate = false) {
        if (this.geolocationAvailable) {
            const finalOnTime = this.calculateOffsetTime(
                this.properties.sunset_time, 
                this.properties.on_offset_hours, 
                this.properties.on_offset_minutes, 
                this.properties.on_offset_positive
            );

            this.properties.final_on_time = finalOnTime;
            console.log(`Final On Time (Sunset) updated to: ${finalOnTime}`);
            this.widgets[9].value = finalOnTime;  // Ensure correct widget index for Sunset time
            
            // Explicitly force a UI update
            this.widgets[9].redraw();  // Redraw the specific widget
            this.setDirtyCanvas(true); // Mark the whole canvas for redraw

            // Set the internal time for time-of-day logic
            this.startTimeObj = this.parseTimeString(finalOnTime);
        }
    }

    updateOffTime(forceUpdate = false) {
        if (this.geolocationAvailable) {
            const finalOffTime = this.calculateOffsetTime(
                this.properties.sunrise_time, 
                this.properties.off_offset_hours, 
                this.properties.off_offset_minutes, 
                this.properties.off_offset_positive
            );

            this.properties.final_off_time = finalOffTime;
            console.log(`Final Off Time (Sunrise) updated to: ${finalOffTime}`);
            this.widgets[10].value = finalOffTime;  // Ensure correct widget index for Sunrise time
            
            // Explicitly force a UI update
            this.widgets[10].redraw();  // Redraw the specific widget
            this.setDirtyCanvas(true); // Mark the whole canvas for redraw

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

        console.log(`Checking time range - Current: ${now.toLocaleTimeString()}, Start: ${startMinutes} minutes, Stop: ${stopMinutes} minutes`);

        if (startMinutes <= stopMinutes) {
            // Normal time range, same day
            return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
        } else {
            // Overnight time range
            return currentMinutes >= startMinutes || currentMinutes < stopMinutes;
        }
    }

    onExecute() {
        if (!this.isEnabled) {
            console.log("Node is disabled, skipping execution.");
            return;
        }

        console.log("Executing TimeOfDaySunriseSunset...");

        // Ensure the times are updated
        this.updateOnTime();
        this.updateOffTime();

        // Check if the current time is within the range
        const currentState = this.isCurrentTimeWithinRange();

        // If the current state has changed, trigger the corresponding output
        if (currentState !== this.lastState) {
            this.lastState = currentState;
            this.setOutputData(0, currentState);
            console.log(`TimeOfDaySunriseSunset - Outputting state: ${currentState ? 'On' : 'Off'}`);
            this.triggerSlot(0);
        } else {
            console.log(`State remains unchanged: ${currentState ? 'On' : 'Off'} at ${new Date().toLocaleTimeString()}`);
        }

        console.log("Finished execution of TimeOfDaySunriseSunset");
    }

    // Serialize the node's properties to save its state
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        data.isEnabled = this.isEnabled;  // Save the enabled/disabled state
        return data;
    }

    // Configure the node's properties when loading from a saved state
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : false;  // Load the enabled/disabled state

        // Update the widgets to reflect the loaded state
        this.widgets.forEach(widget => {
            switch (widget.name) {
                case "On Offset Hours":
                    widget.value = this.properties.on_offset_hours;
                    break;
                case "On Offset Minutes":
                    widget.value = this.properties.on_offset_minutes;
                    break;
                case "On Offset Timing":
                    widget.value = this.properties.on_offset_positive ? "After" : "Before";
                    break;
                case "Off Offset Hours":
                    widget.value = this.properties.off_offset_hours;
                    break;
                case "Off Offset Minutes":
                    widget.value = this.properties.off_offset_minutes;
                    break;
                case "Off Offset Timing":
                    widget.value = this.properties.off_offset_positive ? "After" : "Before";
                    break;
                case "City":
                    widget.value = this.properties.city;
                    break;
                case "Timezone":
                    widget.value = this.properties.timezone;
                    break;
                case "Final On Time (Sunset)":
                    widget.value = this.properties.final_on_time;
                    break;
                case "Final Off Time (Sunrise)":
                    widget.value = this.properties.final_off_time;
                    break;
                case "Enable Node":
                    widget.value = this.isEnabled;
                    break;
            }
        });

        this.setDirtyCanvas(true);
    }
}

LiteGraph.registerNodeType("custom/time_of_day_sunrise_sunset", TimeOfDaySunriseSunset);
