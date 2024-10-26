// /backend/src/services/CommandScheduler.js

const cron = require('node-cron');
const ScheduledTask = require('../models/ScheduledTask'); // Ensure this path is correct

class CommandScheduler {
    constructor() {
        this.tasks = {}; // Store tasks with node IDs as keys
    }

    /**
     * Schedules a command based on the provided details and persists it.
     * @param {Object} command - The command details.
     * @param {Function} callback - The function to execute when the task triggers.
     */
    async scheduleCommand(command, callback) {
        const { nodeId, type, time } = command;

        // Convert 'time' (e.g., "14:30") to cron expression
        const [hour, minute] = time.split(':').map(Number);
        const cronExpression = `${minute} ${hour} * * *`; // Every day at specified time

        // Cancel existing task if any
        if (this.tasks[nodeId]) {
            console.log(`A task for node ${nodeId} is already scheduled. Overwriting.`);
            this.tasks[nodeId].stop();
        }

        // Schedule the task
        const task = cron.schedule(cronExpression, callback, {
            timezone: "America/New_York" // Replace with your timezone
        });

        this.tasks[nodeId] = task;
        console.log(`Scheduled task for node ${nodeId} at ${time} daily.`);

        // Persist the task in the database
        try {
            await ScheduledTask.findOneAndUpdate(
                { nodeId },
                { type, time },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`Persisted task for node ${nodeId} in the database.`);
        } catch (error) {
            console.error(`Error persisting task for node ${nodeId}:`, error);
        }
    }

    /**
     * Cancels a scheduled command based on the node ID and removes it from persistence.
     * @param {String} nodeId - The ID of the node whose task should be canceled.
     */
    async cancelCommand(nodeId) {
        const task = this.tasks[nodeId];
        if (task) {
            task.stop();
            delete this.tasks[nodeId];
            console.log(`Cancelled scheduled task for node ${nodeId}.`);

            // Remove the task from the database
            try {
                await ScheduledTask.findOneAndDelete({ nodeId });
                console.log(`Removed task for node ${nodeId} from the database.`);
            } catch (error) {
                console.error(`Error removing task for node ${nodeId}:`, error);
            }
        } else {
            console.log(`No scheduled task found for node ${nodeId}.`);
        }
    }

    /**
     * Loads all scheduled tasks from the database and schedules them.
     * This should be called during server startup to resume tasks.
     */
    async loadScheduledTasks() {
        try {
            const tasks = await ScheduledTask.find({});
            tasks.forEach(task => {
                this.scheduleCommand(task, () => {
                    // Define the callback for each task type
                    switch(task.type) {
                        case 'TimerNode':
                            // Example action: Turn on a light
                            api.lights.setLightState('1', new v3.lightStates.LightState().on())
                                .then(() => {
                                    console.log(`Light 1 turned on by TimerNode ${task.nodeId}`);
                                })
                                .catch(error => {
                                    console.error(`Error turning on light 1 by TimerNode ${task.nodeId}:`, error);
                                });
                            break;
                        // Handle other node types here
                        default:
                            console.warn(`Unknown task type: ${task.type}`);
                    }
                });
            });
            console.log(`Loaded and scheduled ${tasks.length} tasks from the database.`);
        } catch (error) {
            console.error('Error loading scheduled tasks:', error);
        }
    }
}

module.exports = CommandScheduler;
