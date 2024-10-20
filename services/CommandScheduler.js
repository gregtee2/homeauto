// File: src/services/CommandScheduler.js

class CommandScheduler {
    constructor() {
        this.scheduledCommands = [];
    }

    /**
     * Schedules a command to be executed at a specific UNIX timestamp.
     * @param {string} command - The command to execute (e.g., "Turn on light").
     * @param {number} executionTimeInSeconds - UNIX timestamp in seconds when the command should execute.
     */
    scheduleNextCommand(command, executionTimeInSeconds) {
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const delayInMilliseconds = (executionTimeInSeconds - currentTimeInSeconds) * 1000;

        if (delayInMilliseconds <= 0) {
            console.warn(`CommandScheduler - Execution time for "${command}" is in the past.`);
            return;
        }

        const timeoutId = setTimeout(() => {
            this.executeCommand(command);
            // Remove the executed command from the list
            this.scheduledCommands = this.scheduledCommands.filter(cmd => cmd.timeoutId !== timeoutId);
        }, delayInMilliseconds);

        // Store the scheduled command
        this.scheduledCommands.push({ command, executionTimeInSeconds, timeoutId });

        console.log(`CommandScheduler - Scheduled "${command}" at ${new Date(executionTimeInSeconds * 1000).toLocaleString()}`);
    }

    /**
     * Executes a scheduled command.
     * @param {string} command - The command to execute.
     */
    executeCommand(command) {
        console.log(`CommandScheduler - Executing command: ${command}`);
        // Implement the actual command execution logic here.
        // For example, interfacing with HueDeviceManager to turn lights on/off.

        if (command === "Turn on light") {
            window.HueDeviceManager.getSelectedLights().forEach(light => {
                window.HueDeviceManager.setLightState(light.light_id, true)
                    .then(() => console.log(`CommandScheduler - Turned on light ${light.name}`))
                    .catch(error => console.error(`CommandScheduler - Error turning on light ${light.name}:`, error));
            });
        } else if (command === "Turn off light") {
            window.HueDeviceManager.getSelectedLights().forEach(light => {
                window.HueDeviceManager.setLightState(light.light_id, false)
                    .then(() => console.log(`CommandScheduler - Turned off light ${light.name}`))
                    .catch(error => console.error(`CommandScheduler - Error turning off light ${light.name}:`, error));
            });
        }
    }

    /**
     * Cancels all scheduled commands.
     */
    cancelAllCommands() {
        this.scheduledCommands.forEach(cmd => {
            clearTimeout(cmd.timeoutId);
        });
        this.scheduledCommands = [];
        console.log("CommandScheduler - All scheduled commands have been canceled.");
    }
}

// Instantiate and attach to the global window object
window.CommandScheduler = new CommandScheduler();
console.log("CommandScheduler - Defined and attached to window.CommandScheduler");
