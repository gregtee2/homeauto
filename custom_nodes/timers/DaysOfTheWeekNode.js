class DaysOfTheWeekNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Days of the Week";
        this.size = [360, 420];  // Adjust size to accommodate new widgets

        // Properties that will be editable through the UI
        this.properties = {
            days: {
                Sunday: false,
                Monday: false,
                Tuesday: false,
                Wednesday: false,
                Thursday: false,
                Friday: false,
                Saturday: false
            },
            everyday: false,
            weekdays: false,
            weekends: false,
            even_days: false,
            odd_days: false,
            special_days: []  // Array of objects with date and repeat status
        };

        this.addInput("In", "boolean");
        this.addOutput("Out", "boolean");

        // Initialize widgets
        this.setupWidgets();

        // Force the size after widgets are added
        this.forceSize();
    }

    setupWidgets() {
        this.widgets = [];

        // Days of the Week Checkboxes
        for (let day in this.properties.days) {
            this.addWidget("toggle", day, this.properties.days[day], (v) => {
                this.properties.days[day] = v;
                this.updateState();
            });
        }

        // Everyday Toggle
        this.addWidget("toggle", "Everyday", this.properties.everyday, (v) => {
            this.properties.everyday = v;
            if (v) {
                this.setEveryday(true);
            } else {
                this.setEveryday(false);
            }
            this.updateState();
        });

        // Weekdays Toggle
        this.addWidget("toggle", "Weekdays", this.properties.weekdays, (v) => {
            this.properties.weekdays = v;
            if (v) {
                this.setWeekdays(true);
                this.properties.weekends = false; // Disable Weekends if Weekdays is selected
            } else {
                this.setWeekdays(false);  // Clear Weekdays when untoggled
            }
            this.updateState();
        });

        // Weekends Toggle
        this.addWidget("toggle", "Weekends", this.properties.weekends, (v) => {
            this.properties.weekends = v;
            if (v) {
                this.setWeekends(true);
                this.properties.weekdays = false; // Disable Weekdays if Weekends is selected
            } else {
                this.setWeekends(false);  // Clear Weekends when untoggled
            }
            this.updateState();
        });

        // Even/Odd Day Toggle
        this.addWidget("toggle", "Even Days", this.properties.even_days, (v) => {
            this.properties.even_days = v;
            if (v) {
                this.properties.odd_days = false;
            }
            this.updateState();
        });
        this.addWidget("toggle", "Odd Days", this.properties.odd_days, (v) => {
            this.properties.odd_days = v;
            if (v) {
                this.properties.even_days = false;
            }
            this.updateState();
        });

        // Special Days Input and List
        this.addWidget("text", "Add Special Day (MM/DD)", "", (v) => {
            if (v.trim() === "") {
                this.properties.special_days.pop();  // Remove the last entry or clear all if the input is empty
            } else if (this.isValidDate(v)) {
                this.properties.special_days.push({ date: v, repeat: false });
            }
            this.updateSpecialDaysList();  // Update the list of special days
            this.setDirtyCanvas(true);  // Mark canvas as needing redraw
            LiteGraph.closeAllContextMenus();  // Attempt to close any open context menu or popup (keeping this as a safeguard)
        });

        // Toggle for Annual Repeat
        this.addWidget("toggle", "Repeat Annually", false, (v) => {
            if (this.properties.special_days.length > 0) {
                this.properties.special_days[this.properties.special_days.length - 1].repeat = v;
                this.updateSpecialDaysList();
                this.setDirtyCanvas(true);
            }
        });

        // Display the Special Days List
        this.specialDaysWidget = this.addWidget("info", "Special Days", this.getSpecialDaysList());

        // Force the size again after widgets setup
        this.forceSize();
    }

    // Define the updateSpecialDaysList method
    updateSpecialDaysList() {
        if (this.specialDaysWidget) {
            this.specialDaysWidget.value = this.getSpecialDaysList();
            this.setDirtyCanvas(true);  // Mark canvas as needing redraw
        }
    }

    isValidDate(dateStr) {
        const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
        return datePattern.test(dateStr);
    }

    getSpecialDaysList() {
        return this.properties.special_days
            .map(sd => `${sd.date}${sd.repeat ? " (Annual)" : ""}`)
            .join(", ");
    }

    setEveryday(enabled) {
        for (let day in this.properties.days) {
            this.properties.days[day] = enabled;
        }
    }

    setWeekdays(enabled) {
        this.properties.days.Monday = enabled;
        this.properties.days.Tuesday = enabled;
        this.properties.days.Wednesday = enabled;
        this.properties.days.Thursday = enabled;
        this.properties.days.Friday = enabled;

        if (!enabled) {
            // Clear the weekdays toggle if it's turned off
            this.properties.weekdays = false;
        }
    }

    setWeekends(enabled) {
        this.properties.days.Saturday = enabled;
        this.properties.days.Sunday = enabled;

        if (!enabled) {
            // Clear the weekends toggle if it's turned off
            this.properties.weekends = false;
        }
    }

    updateState() {
        const days = this.properties.days;

        // Update Weekdays, Weekends, and Everyday toggles based on individual day selections
        this.properties.everyday = Object.values(days).every(Boolean);
        this.properties.weekdays = days.Monday && days.Tuesday && days.Wednesday && days.Thursday && days.Friday;
        this.properties.weekends = days.Saturday && days.Sunday;

        // If any individual weekday is un-toggled, clear the weekdays toggle
        if (!this.properties.weekdays) {
            this.properties.weekdays = false;
        }

        // If any individual weekend day is un-toggled, clear the weekends toggle
        if (!this.properties.weekends) {
            this.properties.weekends = false;
        }

        // If any day is un-toggled, clear the everyday toggle
        if (!this.properties.everyday) {
            this.properties.everyday = false;
        }

        this.updateSpecialDaysList();  // Ensure the special days list is updated

        this.setDirtyCanvas(true);  // Mark canvas as needing to redraw
    }

    isTodayValid() {
        const today = new Date();
        const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });
        const dayOfMonth = today.getDate();
        const month = today.getMonth() + 1;
        const todayStr = `${String(month).padStart(2, '0')}/${String(dayOfMonth).padStart(2, '0')}`;

        // Check if today is a special day
        for (let sd of this.properties.special_days) {
            if (sd.date === todayStr || (sd.repeat && sd.date === todayStr)) {
                // If today is a special day, return true immediately
                return true;
            }
        }

        // If a special day exists but today is not that day, return false
        if (this.properties.special_days.length > 0) {
            return false;
        }

        // If no special day is active, proceed with regular checks
        if (this.properties.even_days && dayOfMonth % 2 === 0) {
            return true;
        }

        if (this.properties.odd_days && dayOfMonth % 2 !== 0) {
            return true;
        }

        // Return the state based on regular day selections if no special day is active
        return this.properties.days[dayOfWeek] || false;
    }



    onExecute() {
        const input = this.getInputData(0);

        // If a special day is active, ignore other days and output true
        if (this.isTodayValid()) {
            this.setOutputData(0, input);
        } else {
            this.setOutputData(0, false);
        }
    }

    onDrawForeground(ctx) {
        // Calculate the position for the text with some padding
        const padding = 10;  // Padding on the left and right
        const textX = padding;
        const textY = this.size[1] - 20;
        const textHeight = 20; // Height of the text area to be cleared

        // Clear the area where the summary text will be drawn, with padding applied
        ctx.clearRect(textX - padding, textY - textHeight, this.size[0] - 2 * padding, textHeight);

        // Set the background color using the specified RGB value
        ctx.fillStyle = "rgb(53, 53, 53)";  // Background color to match the node
        ctx.fillRect(textX - padding, textY - textHeight, this.size[0] - 2 * padding, textHeight);

        // Display selected days summary with green text color
        const selectedDays = Object.keys(this.properties.days).filter(day => this.properties.days[day]);
        let summary = `Days: ${selectedDays.join(', ')}`;
        if (this.properties.even_days) summary = "Days: Even";
        if (this.properties.odd_days) summary = "Days: Odd";
        if (this.properties.special_days.length > 0) {
            summary += `, Special Days: ${this.getSpecialDaysList()}`;
        }

        ctx.fillStyle = "#006400";  // Green text color
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.fillText(summary, textX, textY);
    }

    onSerialize(o) {
        o.properties = LiteGraph.cloneObject(this.properties);
    }

    onConfigure(o) {
        this.properties = LiteGraph.cloneObject(o.properties);
        this.setupWidgets();
        this.updateState();
        this.forceSize();
    }

    forceSize() {
        this.size = [360, 420];  // Ensure the size is consistently applied in multiple locations
    }

    onAdded() {
        this.forceSize();  // Ensure the size is set when the node is added to the graph
    }
}

LiteGraph.registerNodeType("Timers/days_of_the_week", DaysOfTheWeekNode);
