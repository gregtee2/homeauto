// File: src/nodes/TimeOfDaySunriseSunset.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Timers/time_of_day_sunrise_sunset"]) {
    class TimeOfDaySunriseSunset extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.lastScheduledCommand = null;
            this.lastScheduledTime = null;
            this.title = "Sunrise/Sunset Trigger";
            this.size = [300, 300];
            this.isEnabled = false; // Flag for enabling/disabling the node

            // Initialize properties
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
                final_off_time: "",
                status: "No action yet" // Initialize status property
            };

            this.addOutput("State", "boolean");

            // Initialize time objects to avoid null issues
            this.startTimeObj = { hours: 0, minutes: 0 };
            this.stopTimeObj = { hours: 0, minutes: 0 };

            // Track the last triggered state
            this.lastState = null;

            // Initialize widgets
            this.setupWidgets();

            // Automatically fetch geolocation on load
            this.initializeTimes();

            // Bind methods to maintain 'this' context
            this.handleSelectedLightChange = this.handleSelectedLightChange.bind(this);
            this.handleExternalStateChange = this.handleExternalStateChange.bind(this);

            // Initialize logging flags
            this.hasLoggedNoLightSelected = false;

            // Initialize a dictionary to track last scheduled times for each command
            this.lastScheduledCommands = {
                "Turn on light": null,
                "Turn off light": null
            };

            // Register callbacks with HueDeviceManager
            if (window.HueDeviceManager) {
                if (typeof window.HueDeviceManager.onSelectedLightChange === 'function') {
                    window.HueDeviceManager.onSelectedLightChange(this.handleSelectedLightChange);
                } else {
                    console.error("TimeOfDaySunriseSunset - HueDeviceManager does not have onSelectedLightChange method.");
                }

                if (typeof window.HueDeviceManager.onStateChange === 'function') {
                    window.HueDeviceManager.onStateChange(this.handleExternalStateChange);
                } else {
                    console.error("TimeOfDaySunriseSunset - HueDeviceManager does not have onStateChange method.");
                }

                // **New Addition: Fetch current selected lights upon initialization**
                this.fetchCurrentSelectedLights();
            } else {
                console.error("TimeOfDaySunriseSunset - HueDeviceManager is not available.");
            }

            // Schedule recalculations
            this.scheduleMidnightRecalculation();
        }

        /**
         * Fetches the current selected lights from HueDeviceManager.
         */
        fetchCurrentSelectedLights() {
            try {
                if (typeof window.HueDeviceManager.getSelectedLights === 'function') {
                    const currentSelectedLights = window.HueDeviceManager.getSelectedLights();
                    if (currentSelectedLights && currentSelectedLights.length > 0) {
                        this.handleSelectedLightChange(currentSelectedLights);
                    } else {
                        console.log("TimeOfDaySunriseSunset - No lights currently selected.");
                    }
                } else {
                    console.error("TimeOfDaySunriseSunset - HueDeviceManager does not have getSelectedLights method.");
                }
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error fetching current selected lights:", error);
                this.updateStatus(`Error fetching selected lights: ${error.message}`);
            }
        }

        /**
         * Updates the status property and status widget.
         * @param {string} newStatus - The new status message.
         */
        updateStatus(newStatus) {
            try {
                this.properties.status = newStatus;
                if (this.statusWidget) {
                    this.statusWidget.value = this.properties.status;
                }
                this.setDirtyCanvas(true);
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error updating status:", error);
            }
        }

        /**
         * Handles updates when the selected lights change in HueDeviceManager.
         * @param {Array<object>} selectedLights - Array of selected light objects.
         */
        handleSelectedLightChange(selectedLights) {
            try {
                if (!selectedLights || selectedLights.length === 0) {
                    if (!this.hasLoggedNoLightSelected) {
                        console.log("TimeOfDaySunriseSunset - No lights currently selected.");
                        this.hasLoggedNoLightSelected = true;
                    }
                    this.selectedLights = [];
                    this.updateStatus("No lights selected.");
                    return;
                }

                console.log("TimeOfDaySunriseSunset - Selected lights updated:", selectedLights);

                // Update internal list of selected lights
                this.selectedLights = selectedLights;

                // Recalculate sun times and reschedule commands
                this.calculateSunTimes();
                this.updateOnTime();
                this.updateOffTime();

                this.updateStatus("Selected lights updated.");
                this.hasLoggedNoLightSelected = false; // Reset the flag since lights are now selected
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error in handleSelectedLightChange:", error);
                this.updateStatus(`Error updating selected lights: ${error.message}`);
            }
        }

        /**
         * Handles external state changes from HueDeviceManager.
         * @param {string} lightId - The ID of the device that changed.
         * @param {object} newState - The new state of the device.
         */
        handleExternalStateChange(lightId, newState) {
            try {
                if (this.selectedLights && this.selectedLights.some(light => light.light_id === lightId)) {
                    console.log(`TimeOfDaySunriseSunset - Detected state change for device ${lightId}:`, newState);
                    // Optionally, update internal state or UI based on the new state
                    // For example:
                    // this.updateSunTimesIfNecessary();
                }
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error handling external state change:", error);
                this.updateStatus(`Error handling state change: ${error.message}`);
            }
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
            try {
                const widgetWidth = this.size[0] - 20; // Consistent widget width

                // Geolocation Button
                this.addWidget("button", "Fetch Geolocation", null, () => {
                    console.log("Fetching geolocation...");
                    this.fetchGeolocation();
                });

                // City and Timezone Display (Read-Only)
                this.addWidget("text", "City", this.properties.city, null, {
                    property: "city",
                    readonly: true,
                    width: widgetWidth
                });
                this.addWidget("text", "Timezone", this.properties.timezone, null, {
                    property: "timezone",
                    readonly: true,
                    width: widgetWidth
                });

                // On Time Offset Controls
                this.addWidget("combo", "On Offset Hours", this.properties.on_offset_hours, (value) => {
                    this.properties.on_offset_hours = parseInt(value, 10);
                    console.log(`On Offset Hours changed to: ${this.properties.on_offset_hours}`);
                    this.updateOnTime();
                }, { values: Array.from({ length: 24 }, (_, i) => i), width: widgetWidth });

                this.addWidget("combo", "On Offset Minutes", this.properties.on_offset_minutes, (value) => {
                    this.properties.on_offset_minutes = parseInt(value, 10);
                    console.log(`On Offset Minutes changed to: ${this.properties.on_offset_minutes}`);
                    this.updateOnTime();
                }, { values: Array.from({ length: 60 }, (_, i) => i), width: widgetWidth });

                this.addWidget("combo", "On Offset Timing", this.properties.on_offset_positive ? "After" : "Before", (value) => {
                    this.properties.on_offset_positive = value === "After";
                    console.log(`On Offset Timing changed to: ${this.properties.on_offset_positive ? 'After' : 'Before'}`);
                    this.updateOnTime();
                }, { values: ["Before", "After"], width: widgetWidth });

                // Off Time Offset Controls
                this.addWidget("combo", "Off Offset Hours", this.properties.off_offset_hours, (value) => {
                    this.properties.off_offset_hours = parseInt(value, 10);
                    console.log(`Off Offset Hours changed to: ${this.properties.off_offset_hours}`);
                    this.updateOffTime();
                }, { values: Array.from({ length: 24 }, (_, i) => i), width: widgetWidth });

                this.addWidget("combo", "Off Offset Minutes", this.properties.off_offset_minutes, (value) => {
                    this.properties.off_offset_minutes = parseInt(value, 10);
                    console.log(`Off Offset Minutes changed to: ${this.properties.off_offset_minutes}`);
                    this.updateOffTime();
                }, { values: Array.from({ length: 60 }, (_, i) => i), width: widgetWidth });

                this.addWidget("combo", "Off Offset Timing", this.properties.off_offset_positive ? "After" : "Before", (value) => {
                    this.properties.off_offset_positive = value === "After";
                    console.log(`Off Offset Timing changed to: ${this.properties.off_offset_positive ? 'After' : 'Before'}`);
                    this.updateOffTime();
                }, { values: ["Before", "After"], width: widgetWidth });

                // Display Final On and Off Times (Read-Only)
                this.addWidget("text", "Final On Time (Sunset)", this.properties.final_on_time, null, {
                    property: "final_on_time",
                    readonly: true,
                    width: widgetWidth
                });
                this.addWidget("text", "Final Off Time (Sunrise)", this.properties.final_off_time, null, {
                    property: "final_off_time",
                    readonly: true,
                    width: widgetWidth
                });

                // Enable/Disable Toggle
                this.addWidget("toggle", "Enable Node", this.isEnabled, (value) => {
                    this.isEnabled = value;
                    console.log(`Node is now ${this.isEnabled ? 'enabled' : 'disabled'}`);
                    this.updateStatus(`Node is now ${this.isEnabled ? 'enabled' : 'disabled'}.`);
                }, { width: widgetWidth });

                // Status Widget
                this.statusWidget = this.addWidget("text", "Status", this.properties.status, null, {
                    property: "status",
                    readonly: true,
                    width: widgetWidth
                });

                console.log("TimeOfDaySunriseSunset - Widgets set up.");
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error setting up widgets:", error);
                this.updateStatus(`Error setting up widgets: ${error.message}`);
            }
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
                        this.updateStatus("Geolocation fetched successfully.");
                    },
                    (error) => {
                        console.error("Geolocation failed:", error);
                        this.geolocationAvailable = false;
                        this.properties.city = "Geolocation failed";
                        this.properties.timezone = "N/A";
                        this.widgets.find(w => w.name === "City").value = this.properties.city;
                        this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;
                        this.setDirtyCanvas(true);
                        this.updateStatus("Geolocation failed.");
                    }
                );
            } else {
                console.error("Geolocation not supported.");
                this.geolocationAvailable = false;
                this.properties.city = "Geolocation not supported";
                this.properties.timezone = "N/A";
                this.widgets.find(w => w.name === "City").value = this.properties.city;
                this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;
                this.setDirtyCanvas(true);
                this.updateStatus("Geolocation not supported.");
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
                    }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || "Unknown Timezone";

                    this.properties.timezone = timeZoneName;
                    console.log(`Timezone fetched: ${this.properties.timezone}`);

                    // Update the widgets with city and timezone
                    this.widgets.find(w => w.name === "City").value = this.properties.city;
                    this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;

                    this.setDirtyCanvas(true);
                    this.updateStatus("City and timezone fetched successfully.");
                })
                .catch(error => {
                    console.error("Failed to fetch city and timezone:", error);
                    this.properties.city = "API Error";
                    this.properties.timezone = "API Error";
                    this.widgets.find(w => w.name === "City").value = this.properties.city;
                    this.widgets.find(w => w.name === "Timezone").value = this.properties.timezone;
                    this.setDirtyCanvas(true);
                    this.updateStatus("Failed to fetch city and timezone.");
                });
        }

        /**
         * Calculates sunrise and sunset times using the SunCalc library.
         */
        calculateSunTimes() {
            if (this.geolocationAvailable && this.properties.latitude !== null && this.properties.longitude !== null) {
                const now = new Date();
                const sunTimes = SunCalc.getTimes(now, this.properties.latitude, this.properties.longitude);

                this.properties.sunrise_time = sunTimes.sunrise;
                this.properties.sunset_time = sunTimes.sunset;
                console.log(`Sunrise time: ${this.properties.sunrise_time}`);
                console.log(`Sunset time: ${this.properties.sunset_time}`);

                this.updateOnTime();
                this.updateOffTime();
                this.updateStatus("Sun times calculated.");
            } else {
                console.warn("Geolocation data is incomplete. Cannot calculate sun times.");
                this.updateStatus("Geolocation data is incomplete.");
            }
        }

        /**
         * Updates the final on time based on sunset and user-defined offsets.
         */
        updateOnTime() {
            if (this.geolocationAvailable && this.properties.sunset_time) {
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

                // Calculate the exact execution time in seconds since epoch
                let executionDate = new Date(this.properties.sunset_time);
                const offsetMinutes = this.properties.on_offset_hours * 60 + this.properties.on_offset_minutes;
                if (this.properties.on_offset_positive) {
                    executionDate.setMinutes(executionDate.getMinutes() + offsetMinutes);
                } else {
                    executionDate.setMinutes(executionDate.getMinutes() - offsetMinutes);
                }
                let executionTimeInSeconds = Math.floor(executionDate.getTime() / 1000);

                // Schedule the "Turn on light" command for all selected lights
                this.scheduleCommand("Turn on light", executionTimeInSeconds);
                this.updateStatus("Final On Time updated and command scheduled.");
            } else {
                console.warn("Sunset time is not available. Cannot update On Time.");
                this.updateStatus("Sunset time is not available.");
            }
        }

        /**
         * Updates the final off time based on sunrise and user-defined offsets.
         */
        updateOffTime() {
            if (this.geolocationAvailable && this.properties.sunrise_time) {
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

                // Calculate the exact execution time in seconds since epoch
                let executionDate = new Date(this.properties.sunrise_time);
                const offsetMinutes = this.properties.off_offset_hours * 60 + this.properties.off_offset_minutes;
                if (this.properties.off_offset_positive) {
                    executionDate.setMinutes(executionDate.getMinutes() + offsetMinutes);
                } else {
                    executionDate.setMinutes(executionDate.getMinutes() - offsetMinutes);
                }
                let executionTimeInSeconds = Math.floor(executionDate.getTime() / 1000);

                // Schedule the "Turn off light" command for all selected lights
                this.scheduleCommand("Turn off light", executionTimeInSeconds);
                this.updateStatus("Final Off Time updated and command scheduled.");
            } else {
                console.warn("Sunrise time is not available. Cannot update Off Time.");
                this.updateStatus("Sunrise time is not available.");
            }
        }

        /**
         * Helper function to send command and execution time to the command scheduler.
         */
        scheduleCommand(command, executionTimeInSeconds) {
            if (!this.selectedLights || this.selectedLights.length === 0) {
                console.log(`TimeOfDaySunriseSunset - No light selected, not scheduling command: ${command}`);
                this.updateStatus("No lights selected. Command not scheduled.");
                return;
            }

            const nowInSeconds = Math.floor(Date.now() / 1000);

            // Check if the command is already scheduled at the same time
            if (this.lastScheduledCommands[command] === executionTimeInSeconds) {
                console.log(`TimeOfDaySunriseSunset - Command "${command}" is already scheduled at ${new Date(executionTimeInSeconds * 1000).toLocaleString()}, skipping.`);
                return;
            }

            if (executionTimeInSeconds <= nowInSeconds) {
                console.log(`TimeOfDaySunriseSunset - "${command}" time has passed, scheduling for next day.`);
                executionTimeInSeconds += 86400; // Add 24 hours (86400 seconds)
            }

            if (window.CommandScheduler && typeof window.CommandScheduler.scheduleNextCommand === 'function') {
                console.log(`TimeOfDaySunriseSunset - Scheduling command: "${command}" at ${new Date(executionTimeInSeconds * 1000).toLocaleString()}`);
                window.CommandScheduler.scheduleNextCommand(command, executionTimeInSeconds);

                // Update the last scheduled time for the command
                this.lastScheduledCommands[command] = executionTimeInSeconds;

                this.updateStatus(`Command "${command}" scheduled at ${new Date(executionTimeInSeconds * 1000).toLocaleString()}.`);
            } else {
                console.error('TimeOfDaySunriseSunset - CommandScheduler.scheduleNextCommand function is not available.');
                this.updateStatus("CommandScheduler not available. Command not scheduled.");
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
         * Executes the node's main functionality.
         */
        onExecute() {
            if (!this.isEnabled) {
                // Optionally, update status without logging to console
                this.updateStatus("Node is disabled, skipping execution.");
                return;
            }

            // Update status or perform other continuous tasks
            this.updateStatus("Node is enabled and active.");
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
                this.updateOnTime();
                this.updateOffTime();
                this.scheduleMidnightRecalculation();  // Reschedule for the next midnight
            }, timeUntilMidnight);
        }

        /**
         * Serializes the node's properties to save its state.
         * @returns {object} Serialized data.
         */
        serialize() {
            try {
                const data = super.serialize();
                data.properties = this.properties;
                data.isEnabled = this.isEnabled; // Save the enabled/disabled state
                return data;
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error in serialize:", error);
                return {};
            }
        }

        /**
         * Configures the node from serialized data.
         * @param {object} data - Serialized data.
         */
        configure(data) {
            try {
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
                        case "Status":
                            widget.value = this.properties.status;
                            break;
                        default:
                            console.warn(`TimeOfDaySunriseSunset - Unhandled widget: ${widget.name}`);
                    }
                });

                this.setDirtyCanvas(true);
                console.log("TimeOfDaySunriseSunset - Configured with properties:", this.properties);
                this.updateStatus("Node configured successfully.");
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error in configure:", error);
                this.updateStatus(`Error in configure: ${error.message}`);
            }
        }

        /**
         * Clean up timers and listeners when the node is removed.
         */
        onRemoved() {
            try {
                // If there are any timers or listeners, clear them here
                // For example, if you used any setTimeout or setInterval, clear them
                console.log("TimeOfDaySunriseSunset - Node removed and cleaned up.");
            } catch (error) {
                console.error("TimeOfDaySunriseSunset - Error in onRemoved:", error);
                this.updateStatus(`Error in onRemoved: ${error.message}`);
            }
        }
    }

    // Register the node with LiteGraph under the "Timers" category
    LiteGraph.registerNodeType("Timers/time_of_day_sunrise_sunset", TimeOfDaySunriseSunset);
    console.log("TimeOfDaySunriseSunset - Registered successfully.");
} else {
    console.log("TimeOfDaySunriseSunset - Already registered.");
}
