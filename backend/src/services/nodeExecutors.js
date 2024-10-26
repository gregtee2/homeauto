// /backend/src/services/nodeExecutors.js
const { commandScheduler } = require('./CommandScheduler');
const Jexl = require('jexl');

async function executeNode(node, inputData) {
    switch (node.type) {
        case "custom/TimerNode":
            return executeTimerNode(node, inputData);
        case "custom/ConditionNode":
            return executeConditionNode(node, inputData);
        case "custom/ActionNode":
            return executeActionNode(node, inputData);
        default:
            console.warn(`Unknown node type: ${node.type}`);
            return {};
    }
}

function executeTimerNode(node, inputData) {
    const { time, isActive } = node.properties;
    if (isActive) {
        commandScheduler.scheduleCommand(node.id, 'TimerNode', time, () => console.log(`TimerNode ${node.id} triggered`));
        return { timerTriggered: true, time };
    } else {
        commandScheduler.cancelCommand(node.id);
        return { timerTriggered: false };
    }
}

async function executeConditionNode(node, inputData) {
    const { condition } = node.properties;
    const result = await Jexl.eval(condition, inputData);
    return { conditionMet: result };
}

async function executeActionNode(node, inputData) {
    const { actionType, targetId } = node.properties;
    // Implement toggle or other action logic based on actionType and targetId
    return { action: actionType, targetId, success: true };
}

module.exports = { executeNode };
