// File: src/nodes/TimeOfDaySunriseSunset.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Timers/time_of_day_sunrise_sunset"]) {
    class TimeOfDaySunriseSunset extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Sunrise/Sunset Trigger";
            this.size = [300, 300];
            this.isEnabled = false; // Flag for enabling/disabling the node

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

            // Schedule recalculation after midnight
            this.scheduleMidnightRecalculation();
        }

        /**
         * Initializes times by fetching geolocation or setting default coordinates.
         */
        initializeTimes() {
            // Automatically fetch geolocation if available
            if (navigator.geolocation) {
                this.fetchGeolocation();
            } else {
                // If geolocation isn't available, initialize with default coordinates (e.g., New York City)
                this.properties.latitude = 40.7128;
                this.properties.longitude = -74.0060;
                this.geolocationAvailable = true;
                console.log("Geolocation not supported. Using default coordinates (New York City).");
                this.calculateSunTimes();
                this.fetchCityAndTimezone();
            }
        }

        /**
         * Sets up all widgets with proper callbacks or property bindings.
         */
        setupWidgets() {
            // Geolocation Button
            this.addWidget("button", "Fetch Geolocation", null, () => {
                console.log("Fetching geolocation...");
                this.fetchGeolocation();
            });

            // City and Timezone Display (Read-Only)
            this.addWidget("text", "City", this.properties.city, null);
            this.addWidget("text", "Timezone", this.properties.timezone, null);

            // On Time Offset Controls
            this.addWidget("combo", "On Offset Hours", this.properties.on_offset_hours, (value) => {
                this.properties.on_offset_hours = parseInt(value, 10);
                console.log(`On Offset Hours changed to: ${this.properties.on_offset_hours}`);
                this.updateOnTime();
            }, { values: Array.from({ length: 24 }, (_, i) => i) });

            this.addWidget("combo", "On Offset Minutes", this.properties.on_offset_minutes, (value) => {
                this.properties.on_offset_minutes = parseInt(value, 10);
                console.log(`On Offset Minutes changed to: ${this.properties.on_offset_minutes}`);
                this.updateOnTime();
            }, { values: Array.from({ length: 60 }, (_, i) => i) });

            this.addWidget("combo", "On Offset Timing", this.properties.on_offset_positive ? "After" : "Before", (value) => {
                this.properties.on_offset_positive = value === "After";
                console.log(`On Offset Timing changed to: ${this.properties.on_offset_positive ? 'After' : 'Before'}`);
                this.updateOnTime();
            }, { values: ["Before", "After"] });

            // Off Time Offset Controls
            this.addWidget("combo", "Off Offset Hours", this.properties.off_offset_hours, (value) => {
                this.properties.off_offset_hours = parseInt(value, 10);
                console.log(`Off Offset Hours changed to: ${this.properties.off_offset_hours}`);
                this.updateOffTime();
            }, { values: Array.from({ length: 24 }, (_, i) => i) });

            this.addWidget("combo", "Off Offset Minutes", this.properties.off_offset_minutes, (value) => {
                this.properties.off_offset_minutes = parseInt(value, 10);
                console.log(`Off Offset Minutes changed to: ${this.properties.off_offset_minutes}`);
                this.updateOffTime();
            }, { values: Array.from({ length: 60 }, (_, i) => i) });

            this.addWidget("combo", "Off Offset Timing", this.properties.off_offset_positive ? "After" : "Before", (value) => {
                this.properties.off_offset_positive = value === "After";
                console.log(`Off Offset Timing changed to: ${this.properties.off_offset_positive ? 'After' : 'Before'}`);
                this.updateOffTime();
            }, { values: ["Before", "After"] });

            // Display Final On and Off Times (Read-Only)
            this.addWidget("text", "Final On Time (Sunset)", this.properties.final_on_time, null);
            this.addWidget("text", "Final Off Time (Sunrise)", this.properties.final_off_time, null);

            // Enable/Disable Toggle
            this.addWidget("toggle", "Enable Node", this.isEnabled, (value) => {
                this.isEnabled = value;
                console.log(`Node is now ${this.isEnabled ? 'enabled' : 'disabled'}`);
            });
        }

        /**
         * Fetches the user's geolocation.
         */
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

        /**
         * Fetches the city and timezone based on latitude and longitude.
         */
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
                    this.widgets.find(w => w.name === "City").value = this.properties.city;
                    this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;

                    this.setDirtyCanvas(true);
                })
                .catch(error => {
                    console.error("Failed to fetch city and timezone:", error);
                    this.properties.city = "API Error";
                    this.properties.timezone = "API Error";
                    this.widgets.find(w => w.name === "City").value = this.properties.city;
                    this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;
                    this.setDirtyCanvas(true);
                });
        }

        /**
         * Calculates sunrise and sunset times using the SunCalc library.
         */
        calculateSunTimes() {
            if (this.geolocationAvailable) {
                const now = new Date();
                const sunTimes = SunCalc.getTimes(now, this.properties.latitude, this.properties.longitude);

                this.properties.sunrise_time = sunTimes.sunrise;
                this.properties.sunset_time = sunTimes.sunset;
                console.log(`Sunrise time: ${this.properties.sunrise_time}`);
                console.log(`Sunset time: ${this.properties.sunset_time}`);

                this.updateOnTime();
                this.updateOffTime();
            }
        }

        /**
         * Updates the final on time based on sunset and user-defined offsets.
         */
        updateOnTime() {
            if (this.geolocationAvailable) {
                const finalOnTime = this.calculateOffsetTime(
                    this.properties.sunset_time, 
                    this.properties.on_offset_hours, 
                    this.properties.on_offset_minutes, 
                    this.properties.on_offset_positive
                );

                this.properties.final_on_time = finalOnTime;
                this.widgets.find(w => w.name === "Final On Time (Sunset)").value = finalOnTime;
                this.setDirtyCanvas(true);

                // Set the internal time for time-of-day logic
                this.startTimeObj = this.parseTimeString(finalOnTime);
            }
        }

        /**
         * Updates the final off time based on sunrise and user-defined offsets.
         */
        updateOffTime() {
            if (this.geolocationAvailable) {
                const finalOffTime = this.calculateOffsetTime(
                    this.properties.sunrise_time, 
                    this.properties.off_offset_hours, 
                    this.properties.off_offset_minutes, 
                    this.properties.off_offset_positive
                );

                this.properties.final_off_time = finalOffTime;
                this.widgets.find(w => w.name === "Final Off Time (Sunrise)").value = finalOffTime;
                this.setDirtyCanvas(true);

                // Set the internal time for time-of-day logic
                this.stopTimeObj = this.parseTimeString(finalOffTime);
            }
        }

        /**
         * Calculates the final time by applying offsets to the base time.
         * @param {Date} baseTime - The base time (sunrise or sunset).
         * @param {number} offsetHours - Hours to offset.
         * @param {number} offsetMinutes - Minutes to offset.
         * @param {boolean} offsetPositive - Whether to offset after (true) or before (false).
         * @returns {string} - The final time as a localized string.
         */
        calculateOffsetTime(baseTime, offsetHours, offsetMinutes, offsetPositive) {
            const date = new Date(baseTime); // Use the Date object directly
            const offset = (offsetHours * 60 + offsetMinutes) * (offsetPositive ? 1 : -1);
            date.setMinutes(date.getMinutes() + offset);

            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }

        /**
         * Parses a time string into an object with hours and minutes.
         * @param {string} timeStr - Time string in "HH:MM AM/PM" format.
         * @returns {object} - Object with hours and minutes.
         */
        parseTimeString(timeStr) {
            if (!timeStr) {
                return { hours: 0, minutes: 0 }; // Fallback to prevent null issues
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

        /**
         * Checks if the current time is within the on and off time range.
         * @returns {boolean} - True if within range, else false.
         */
        isCurrentTimeWithinRange() {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const startMinutes = this.startTimeObj.hours * 60 + this.startTimeObj.minutes;
            const stopMinutes = this.stopTimeObj.hours * 60 + this.stopTimeObj.minutes;

            // Handle overnight ranges
            if (startMinutes <= stopMinutes) {
                // Same day range
                return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
            } else {
                // Overnight range
                return currentMinutes >= startMinutes || currentMinutes < stopMinutes;
            }
        }

        /**
         * Executes the node's main functionality.
         */
        onExecute() {
            if (!this.isEnabled) {
                console.log("TimeOfDaySunriseSunset - Node is disabled, skipping execution.");
                return;
            }

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
                // State remains unchanged; no action needed
            }
        }

        /**
         * Schedules a recalculation of sun times after midnight.
         */
        scheduleMidnightRecalculation() {
            const now = new Date();
            
            // Calculate the time remaining until midnight
            const timeUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) - now;

            console.log(`TimeOfDaySunriseSunset - Scheduling recalculation to occur in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`);

            // Schedule recalculation
            setTimeout(() => {
                console.log("TimeOfDaySunriseSunset - Recalculating sun times after midnight.");
                this.calculateSunTimes();   // Recalculate the sunrise/sunset times
                this.scheduleMidnightRecalculation();  // Reschedule for the next midnight
            }, timeUntilMidnight);
        }

        /**
         * Serializes the node's properties to save its state.
         * @returns {object} - Serialized data.
         */
        serialize() {
            const data = super.serialize();
            data.properties = this.properties;
            data.isEnabled = this.isEnabled; // Save the enabled/disabled state
            return data;
        }

        /**
         * Configures the node from serialized data.
         * @param {object} data - Serialized data.
         */
        configure(data) {
            super.configure(data);
            this.properties = data.properties || this.properties;
            this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : false; // Load the enabled/disabled state

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
            console.log(`TimeOfDaySunriseSunset - Configured with light_id: ${this.properties.light_id}`);
        }
    }

    // Register the node with LiteGraph under the "Timers" category
    LiteGraph.registerNodeType("Timers/time_of_day_sunrise_sunset", TimeOfDaySunriseSunset);
    console.log("TimeOfDaySunriseSunset - Registered successfully.");
} else {
    console.log("TimeOfDaySunriseSunset - Already registered.");
}
