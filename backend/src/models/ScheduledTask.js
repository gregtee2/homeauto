// /backend/src/models/ScheduledTask.js

const mongoose = require('mongoose');

const ScheduledTaskSchema = new mongoose.Schema({
    nodeId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    time: { type: String, required: true }, // e.g., "14:30"
    // Add other necessary fields if needed
});

module.exports = mongoose.model('ScheduledTask', ScheduledTaskSchema);
