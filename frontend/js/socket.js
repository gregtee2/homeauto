// /frontend/js/socket.js

import { io } from "socket.io-client";
import toastr from 'toastr'; // Optional: Install and import Toastr for notifications
import 'toastr/build/toastr.min.css'; // Import Toastr CSS

/**
 * Function to display notifications to the user.
 * @param {String} message - The notification message.
 * @param {String} type - The type of notification ('success', 'error', 'info', 'warning').
 */
function showNotification(message, type) {
    switch(type) {
        case 'success':
            toastr.success(message);
            break;
        case 'error':
            toastr.error(message);
            break;
        case 'info':
            toastr.info(message);
            break;
        case 'warning':
            toastr.warning(message);
            break;
        default:
            toastr.info(message);
    }
}

/**
 * Function to retrieve the JWT token after user authentication.
 * Replace this with your actual token retrieval logic.
 * @returns {String|null} - The JWT token or null if not found.
 */
function getAuthToken() {
    // Example: Retrieve token from localStorage
    return localStorage.getItem('authToken');
}

// Obtain the token after user authentication
const token = getAuthToken();

// Establish a Socket.IO connection with authentication
const socket = io("http://localhost:8081", {
    auth: {
        token: token
    }
});

// Listen for connection events
socket.on("connect", () => {
    console.log(`Connected to backend with ID: ${socket.id}`);
    showNotification("Connected to backend successfully.", "success");
});

socket.on("disconnect", () => {
    console.log("Disconnected from backend");
    showNotification("Disconnected from backend.", "warning");
});

// Listen for 'graph-processed' event from the Backend
socket.on('graph-processed', (response) => {
    if (response.success) {
        console.log('Backend successfully processed the graph');
        showNotification("Graph processed successfully!", "success");
    } else {
        console.error('Error processing graph on backend:', response.error);
        showNotification(`Error processing graph: ${response.error}`, "error");
    }
});

// Listen for 'error' events from the Socket.IO connection
socket.on('error', (error) => {
    console.error('Socket encountered error:', error);
    showNotification(`Socket error: ${error}`, "error");
});

export default socket;
