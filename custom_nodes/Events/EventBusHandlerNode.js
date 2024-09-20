class EventBusHandlerNode extends LiteGraph.LGraphNode {
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

LiteGraph.registerNodeType("Events/EventBusHandler", EventBusHandlerNode);
