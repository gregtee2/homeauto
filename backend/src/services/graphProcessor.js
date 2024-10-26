// /backend/src/services/graphProcessor.js
const nodeRegistry = require('./NodeRegistry');
const { executeNode } = require('./nodeExecutors');

function processGraphData(graphData) {
    nodeRegistry.clear();
    graphData.nodes.forEach(node => nodeRegistry.addNode(node));
    graphData.connections.forEach(conn => nodeRegistry.addConnection(conn));
    executeWorkflow();
}

function executeWorkflow() {
    const nodes = nodeRegistry.getNodes();
    const connections = nodeRegistry.getConnections();

    const startNodes = Object.values(nodes).filter(node => !connections.some(conn => conn.target_id === node.id));
    startNodes.forEach(startNode => traverseAndExecute(startNode, nodes, connections));
}

function traverseAndExecute(currentNode, nodes, connections, inputData = {}) {
    const outputData = executeNode(currentNode, inputData);
    const outgoingConnections = connections.filter(conn => conn.origin_id === currentNode.id);

    outgoingConnections.forEach(conn => {
        const targetNode = nodes.find(node => node.id === conn.target_id);
        if (targetNode) traverseAndExecute(targetNode, nodes, connections, outputData);
    });
}

module.exports = { processGraphData, executeWorkflow };
