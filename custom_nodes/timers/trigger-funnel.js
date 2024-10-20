// File: C:\homeauto\custom_nodes\Timers\trigger-funnel.js

// Registration Guard: Ensure the node is registered only once
if (!LiteGraph.registered_nodes || !LiteGraph.registered_nodes["Timers/trigger_funnel"]) {
    class TriggerFunnelNode extends LiteGraph.LGraphNode {
        constructor() {
            super();
            this.title = "Trigger Funnel";
            this.size = [350, 250];

            // Inputs for multiple triggers and HSV info
            for (let i = 1; i <= 5; i++) {
                this.addInput(`Trigger ${i}`, "boolean");  // Trigger input
                this.addInput(`HSV Info ${i}`, "hsv_info");  // HSV info input
            }

            // Outputs for trigger and HSV info
            this.addOutput("Funnel Trigger", "boolean");  // Output for the first active trigger
            this.addOutput("Funnel HSV", "hsv_info");  // Output for the first active HSV info
        }

        /**
         * Executes the node's logic by passing the first active trigger and HSV signal.
         */
        onExecute() {
            let activeTrigger = null;
            let activeHSV = null;

            // Loop through the inputs and funnel the first active trigger and HSV info
            for (let i = 0; i < 5; i++) {
                const trigger = this.getInputData(i * 2);  // Get trigger input
                const hsvInfo = this.getInputData(i * 2 + 1);  // Get HSV info input

                // If there's a valid trigger input (true), output the first active trigger and corresponding HSV info
                if (trigger !== null && trigger !== undefined && trigger === true) {
                    activeTrigger = trigger;  // Store first active trigger
                    activeHSV = hsvInfo || null;  // Store corresponding HSV info (if available)
                    break;  // Stop after finding the first active trigger
                }
            }

            // Pass the first active trigger and HSV info to the output
            this.setOutputData(0, activeTrigger);  // Set the trigger output
            this.setOutputData(1, activeHSV);  // Set the HSV info output
        }

        /**
         * Serializes the node's properties (if needed).
         */
        onSerialize(o) {
            o.properties = LiteGraph.cloneObject(this.properties); // Save properties
        }

        /**
         * Configures the node based on serialized data (if needed).
         */
        onConfigure(o) {
            this.properties = LiteGraph.cloneObject(o.properties); // Restore properties
        }
    }

    // Register the node type with LiteGraph under the "Timers" category
    LiteGraph.registerNodeType("Timers/trigger_funnel", TriggerFunnelNode);
    console.log("[Trigger Funnel] Node registered successfully under 'Timers' category.");
} else {
    console.log("[Trigger Funnel] Node is already registered.");
}
