//GTP o1 mini unified data approach
class EventBusHandlerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Event Bus Handler";
        this.size = [250, 100]; // Increased size for better visibility
        this.properties = { eventType: "light_settings" };  // Default event type

        this.listeners = {};
        this.DEBUG = true;  // Enable debugging

        // Outputs
        this.addOutput("On Event", LiteGraph.EVENT);
        this.addOutput("Event Data", "object");

        // Add a combo widget for event type selection
        this.addWidget("combo", "Event Type", this.properties.eventType, (value) => {
            if (value === "Other...") {
                this.addWidget("text", "Custom Event Type", "", (customValue) => {
                    this.properties.eventType = customValue;
                    this.subscribeToEvent(); // Subscribe to the new custom event type
                });
            } else {
                this.properties.eventType = value;
                this.subscribeToEvent(); // Subscribe to the new event type
            }
        }, { values: ["light_settings", "light_info", "device_control", "device_settings", "Other..."] });

        this.currentSubscribedEventType = null; // Track the current subscription
        this.subscribeToEvent(); // Initial subscription
    }

    emitEventIfChanged(eventData) {
        if (!eventData) {
            this.logDebug("EventBusHandler: Invalid event data received.");
            return;
        }

        this.logDebug("EventBusHandler: Emitting new event data:", eventData);

        if (JSON.stringify(this.lastEventData) !== JSON.stringify(eventData)) {
            this.setOutputData(1, eventData);  // Output the data via "Event Data" output
            this.triggerSlot(0, eventData);    // Trigger the event via "On Event" output
            this.lastEventData = eventData;    // Store last data to prevent duplicates
        }
    }

    debouncedEmitEvent(eventData) {
        clearTimeout(this.debounceTimeout);  // Clear any existing debounce
        this.debounceTimeout = setTimeout(() => {
            this.emitEventIfChanged(eventData);  // Emit event if the data has changed
        }, 300);  // Debounce delay of 300ms
    }

    subscribeToEvent() {
        const eventBus = window.EventBus;
        if (eventBus) {
            if (this.currentSubscribedEventType) {
                // Unsubscribe from the previous event type if it exists
                eventBus.unsubscribe(this.currentSubscribedEventType, this.eventListener);
                this.logDebug(`Unsubscribed from '${this.currentSubscribedEventType}'`);
            }

            if (this.properties.eventType) {
                this.eventListener = (data) => {
                    this.logDebug(`Received event for '${this.properties.eventType}':`, data);
                    this.debouncedEmitEvent(data);
                };
                eventBus.subscribe(this.properties.eventType, this.eventListener);
                this.logDebug(`Subscribed to '${this.properties.eventType}'`);
                this.currentSubscribedEventType = this.properties.eventType;
            }
        } else {
            this.logError("EventBusHandler: window.EventBus is not available.");
        }
    }

    onRemoved() {
        const eventBus = window.EventBus;
        if (eventBus && this.eventListener && this.currentSubscribedEventType) {
            eventBus.unsubscribe(this.currentSubscribedEventType, this.eventListener);
            this.logDebug(`Unsubscribed from '${this.currentSubscribedEventType}' on removal`);
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);  // Clear debounce on removal
            this.debounceTimeout = null;
        }
    }

    logDebug(message, ...optionalParams) {
        if (this.DEBUG) {
            console.log(`[EventBusHandlerNode]: ${message}`, ...optionalParams);
        }
    }

    logError(message, ...optionalParams) {
        console.error(`[EventBusHandlerNode]: ${message}`, ...optionalParams);
    }

    serialize() {
        const data = super.serialize();
        data.properties = { ...this.properties };  // Clone properties to avoid shared references
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = { ...data.properties };  // Clone properties
        this.subscribeToEvent();  // Resubscribe to the event when the node is reloaded
    }
}

// Register the node
LiteGraph.registerNodeType("Events/EventBusHandler", EventBusHandlerNode);





//refactored code
/*class EventBusHandlerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Event Bus Handler";
        this.size = [200, 60];
        this.properties = { eventType: "light_settings" };  // Default event type

        this.lastEventData = null;
        this.debounceTimeout = null;
        this.DEBUG = true;  // Enable debugging

        this.eventTypes = ["light_settings", "light_infio", "device_control", "device_settings", "Other..."];

        // Outputs
        this.addOutput("On Event", LiteGraph.EVENT);
        this.addOutput("Event Data", "object");

        // Event listener initialization
        this.eventListener = null;

        // Add a combo widget for event type selection
        this.eventTypeWidget = this.addWidget("combo", "Event Type", this.properties.eventType, (value) => {
            if (value === "Other...") {
                this.addWidget("text", "Custom Event Type", "", (customValue) => {
                    this.properties.eventType = customValue;
                    this.subscribeToEvent();  // Subscribe to the new custom event type
                });
            } else {
                this.properties.eventType = value;
                this.subscribeToEvent();
            }
        }, { values: this.eventTypes });

        this.subscribeToEvent();  // Subscribe to the initial event type
    }

    emitEventIfChanged(eventData) {
        if (!eventData) {
            this.logDebug("EventBusHandler: Invalid event data received.");
            return;
        }

        if (JSON.stringify(this.lastEventData) !== JSON.stringify(eventData)) {
            this.logDebug("EventBusHandler: Emitting new event data:", eventData);
            this.setOutputData(1, eventData);  // Output the data
            this.triggerSlot(0, eventData);    // Trigger the event
            this.lastEventData = eventData;    // Store last data to prevent duplicates
        }
    }

    debouncedEmitEvent(eventData) {
        clearTimeout(this.debounceTimeout);  // Clear any existing debounce
        this.debounceTimeout = setTimeout(() => {
            this.emitEventIfChanged(eventData);  // Emit event if the data has changed
        }, 300);  // Debounce delay of 300ms
    }

    subscribeToEvent() {
        const eventBus = window.EventBus;
        if (eventBus) {
            if (this.eventListener) {
                eventBus.unsubscribe(this.properties.eventType, this.eventListener);
                this.logDebug(`EventBusHandler: Unsubscribed from ${this.properties.eventType}`);
            }

            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = null;
            }

            if (this.properties.eventType) {
                this.eventListener = (data) => {
                    this.logDebug(`EventBusHandler: Received event for ${this.properties.eventType}`, data);
                    this.debouncedEmitEvent(data);
                };
                eventBus.subscribe(this.properties.eventType, this.eventListener);
                this.logDebug(`EventBusHandler: Subscribed to ${this.properties.eventType}`);
            }
        }
    }

    onRemoved() {
        const eventBus = window.EventBus;
        if (eventBus && this.eventListener) {
            eventBus.unsubscribe(this.properties.eventType, this.eventListener);
            this.logDebug(`EventBusHandler: Unsubscribed from event ${this.properties.eventType} on removal`);
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);  // Clear debounce on removal
            this.debounceTimeout = null;
        }
    }

    logDebug(message, ...optionalParams) {
        if (this.DEBUG) {
            console.log(message, ...optionalParams);
        }
    }

    serialize() {
        const data = super.serialize();
        data.properties = { ...this.properties };  // Clone properties to avoid shared references
        return data;
    }

    configure(data) {
        super.configure(data);
        this.properties = { ...data.properties };  // Clone properties
        this.subscribeToEvent();  // Resubscribe to the event when the node is reloaded
    }
}

// Register the node
LiteGraph.registerNodeType("Events/EventBusHandler", EventBusHandlerNode);




//prior code
/*class EventBusHandlerNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Event Bus Handler";
        this.size = [200, 60];
        this.properties = { eventType: "light_settings" }; // Default to 'light_settings'

        this.lastEventData = null;  // Store the last emitted event data
        this.debounceTimeout = null;

        // Adjusted outputs
        this.addOutput("On Event", LiteGraph.EVENT);  // Output trigger
        this.addOutput("Event Data", "object");       // Output data

        this.eventListener = null;

        // Event types list with a default empty array
        this.eventTypes = ["light_settings", "light_infio", "device_control", "device_settings", "Other..."];

        this.eventTypeWidget = this.addWidget("combo", "Event Type", this.properties.eventType, (value) => {
            if (value === "Other...") {
                const customEventType = prompt("Enter custom event type:");
                if (customEventType) {
                    this.properties.eventType = customEventType;
                }
            } else {
                this.properties.eventType = value;
            }
            this.subscribeToEvent();  // Subscribe to the newly selected event type
        }, { values: this.eventTypes });

        this.subscribeToEvent();  // Initialize subscription
    }

    // Ensure the event is only emitted when the data changes
    emitEventIfChanged(eventData) {
        if (JSON.stringify(this.lastEventData) !== JSON.stringify(eventData)) {
            console.log("EventBusHandler: Emitting new event data:", eventData);
            this.setOutputData(1, eventData);  // Set output data at index 1
            this.triggerSlot(0, eventData);    // Trigger output slot at index 0
            this.lastEventData = eventData;    // Store the last event data to avoid duplicate emissions
        }
    }

    // Debounce the event emission to prevent excessive calls
    debouncedEmitEvent(eventData) {
        clearTimeout(this.debounceTimeout);  // Clear any existing debounce timeout
        this.debounceTimeout = setTimeout(() => {
            this.emitEventIfChanged(eventData);  // Emit event if the data has changed
        }, 300);  // 300ms debounce delay
    }

    // Subscribe to the selected event type
    subscribeToEvent() {
        const eventBus = window.EventBus;
        if (eventBus) {
            // Unsubscribe from the previous event listener
            if (this.eventListener) {
                eventBus.unsubscribe(this.properties.eventType, this.eventListener);
                console.log(`EventBusHandler: Unsubscribed from event ${this.properties.eventType}`);
            }

            // Set up a new listener for the selected event type
            if (this.properties.eventType) {
                this.eventListener = (data) => {
                    console.log(`EventBusHandler: Received event for ${this.properties.eventType}`, data);
                    this.debouncedEmitEvent(data);  // Debounced event emission
                };
                eventBus.subscribe(this.properties.eventType, this.eventListener);
                console.log(`EventBusHandler: Subscribed to ${this.properties.eventType}`);
            }
        }
    }

    // Called when the node is removed from the graph
    onRemoved() {
        const eventBus = window.EventBus;
        if (eventBus && this.eventListener) {
            eventBus.unsubscribe(this.properties.eventType, this.eventListener);
            console.log(`EventBusHandler: Unsubscribed from event ${this.properties.eventType} on removal`);
        }
    }

    // Function to update event types dynamically (optional, can be customized)
    updateEventTypes() {
        // Updated event types to include "device_settings"
        this.eventTypes = ["light_settings", "light_infio", "device_control", "device_settings", "Other..."];
        this.eventTypeWidget.options.values = this.eventTypes;
    }

    // Serialization for saving the node
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    // Configure the node with saved data
    configure(data) {
        super.configure(data);
        this.properties = data.properties || this.properties;
        this.subscribeToEvent();  // Resubscribe to the event when the node is reloaded
    }
}

LiteGraph.registerNodeType("Events/EventBusHandler", EventBusHandlerNode);*/
