// File: C:\homeauto\custom_nodes\Timers\conditional-logic.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Timers/conditional_logic"]) {
    class ConditionalLogicNode extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Conditional Logic";
            this.size = [350, 250];

            // Initialize properties
            this.properties = {
                startDay: 1,
                endDay: 31,
                startMonth: 1,
                endMonth: 12,
                logicType: "AND" // Could be "AND" or "OR"
            };

            // Inputs and Outputs
            this.addInput("Trigger", "boolean");  // Input from TimeOfDayNode or other trigger
            this.addInput("HSV Info", "hsv_info");
            this.addOutput("On/Off", "boolean");
            this.addOutput("HSV Info", "hsv_info");

            // Widgets for Day and Month selection
            this.startDayWidget = this.addWidget("combo", "Start Day", this.properties.startDay, (value) => {
                this.properties.startDay = value;
            }, { values: [...Array(31).keys()].map(i => i + 1) });

            this.endDayWidget = this.addWidget("combo", "End Day", this.properties.endDay, (value) => {
                this.properties.endDay = value;
            }, { values: [...Array(31).keys()].map(i => i + 1) });

            this.startMonthWidget = this.addWidget("combo", "Start Month", this.properties.startMonth, (value) => {
                this.properties.startMonth = value;
            }, { values: [...Array(12).keys()].map(i => i + 1) });

            this.endMonthWidget = this.addWidget("combo", "End Month", this.properties.endMonth, (value) => {
                this.properties.endMonth = value;
            }, { values: [...Array(12).keys()].map(i => i + 1) });

            this.logicTypeWidget = this.addWidget("combo", "Logic Type", this.properties.logicType, (value) => {
                this.properties.logicType = value;
            }, { values: ["AND", "OR"] });
        }

        onExecute() {
            const currentTime = new Date();
            const currentDay = currentTime.getDate();
            const currentMonth = currentTime.getMonth() + 1;

            // Check if the current date is within the specified day and month ranges
            const dayCondition = currentDay >= this.properties.startDay && currentDay <= this.properties.endDay;
            const monthCondition = currentMonth >= this.properties.startMonth && currentMonth <= this.properties.endMonth;

            let logicSatisfied = false;
            if (this.properties.logicType === "AND") {
                logicSatisfied = dayCondition && monthCondition;
            } else if (this.properties.logicType === "OR") {
                logicSatisfied = dayCondition || monthCondition;
            }

            // Pass the trigger signal and HSV info if conditions are met
            const trigger = this.getInputData(0);  // Input from TimeOfDayNode or other signal
            if (logicSatisfied && trigger) {
                this.setOutputData(0, true);  // Pass On/Off signal
                const hsvInfo = this.getInputData(1);  // Input for HSV Info
                this.setOutputData(1, hsvInfo);  // Pass HSV info if available
            } else {
                this.setOutputData(0, false);  // Pass Off signal if conditions are not met
                this.setOutputData(1, null);  // Nullify HSV output if conditions are not met
            }
        }

        /**
         * Serializes the node's properties for saving.
         */
        onSerialize(o) {
            o.properties = LiteGraph.cloneObject(this.properties); // Save the node's properties
            console.log("[Conditional Logic] Serialized properties:", this.properties);
        }

        /**
         * Configures the node based on serialized data.
         */
        onConfigure(o) {
            this.properties = LiteGraph.cloneObject(o.properties); // Restore properties
            console.log("[Conditional Logic] Configured with properties:", this.properties);

            // Restore the widget values based on the restored properties
            this.startDayWidget.value = this.properties.startDay;
            this.endDayWidget.value = this.properties.endDay;
            this.startMonthWidget.value = this.properties.startMonth;
            this.endMonthWidget.value = this.properties.endMonth;
            this.logicTypeWidget.value = this.properties.logicType;
        }
    }

    // Register the node type with LiteGraph under the "Timers" category
    LiteGraph.registerNodeType("Timers/ConditionalLogic", ConditionalLogicNode);
    console.log("[Conditional Logic] Node registered successfully under 'Timers' category.");
} else {
    console.log("[Conditional Logic] Node is already registered.");
}
