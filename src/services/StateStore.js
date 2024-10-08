// File: src/services/StateStore.js

class StateStore {
    constructor() {
        this.states = {};
        this.listeners = {};
    }

    getState(deviceId) {
        return this.states[deviceId];
    }

    updateState(deviceId, newState) {
        this.states[deviceId] = newState;
        if (this.listeners[deviceId]) {
            this.listeners[deviceId].forEach(callback => callback(newState));
        }
    }

    subscribe(deviceId, callback) {
        if (!this.listeners[deviceId]) {
            this.listeners[deviceId] = [];
        }
        this.listeners[deviceId].push(callback);
    }

    unsubscribe(deviceId, callback) {
        if (!this.listeners[deviceId]) return;
        this.listeners[deviceId] = this.listeners[deviceId].filter(cb => cb !== callback);
    }
}

// Create and attach the instance to the global window object
window.stateStore = new StateStore();
