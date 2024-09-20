// File: globals/globals.js

// This module will hold and manage all global variables
const Globals = {
    apiKey: null,
    bridgeIp: null,
    eventBus: new EventBus() // Add EventBus to globals
};

// Function to set global variables
function setGlobal(key, value) {
    Globals[key] = value;
}

// Function to get global variables
function getGlobal(key) {
    return Globals[key];
}

// Attach Globals to the window object to make it globally accessible
window.Globals = Globals;










/*// File: globals/globals.js  (original code)

// This module will hold and manage all global variables
const Globals = {
    apiKey: null,
    bridgeIp: null
};

// Function to set global variables
function setGlobal(key, value) {
    Globals[key] = value;
}

// Function to get global variables
function getGlobal(key) {
    return Globals[key];
}

// Exposing the functions and Globals object
export { Globals, setGlobal, getGlobal };*/

