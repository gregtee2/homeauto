class EventBus {
    constructor() {
        this.listeners = {};
        this.eventTypes = new Set(); // Use a Set to store unique event types
    }

    subscribe(eventType, listener) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(listener);
    }

    unsubscribe(eventType, listener) {
        if (!this.listeners[eventType]) return;
        this.listeners[eventType] = this.listeners[eventType].filter(l => l !== listener);
    }

    publish(eventType, data) {
        // Add eventType to the set of event types
        this.eventTypes.add(eventType);

        if (!this.listeners[eventType]) return;
        this.listeners[eventType].forEach(listener => {
            listener(data);
        });
    }

    // New method to get the list of event types
    getEventTypes() {
        return Array.from(this.eventTypes);
    }
}

// Attach EventBus to the global window object so it can be accessed globally
window.EventBus = new EventBus();

// Add debug statement to confirm initialization
console.log("EventBus initialized", window.EventBus);
