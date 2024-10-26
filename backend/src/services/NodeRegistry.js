// /backend/src/services/NodeRegistry.js

class NodeRegistry {
    constructor() {
        this.nodes = {}; // Key: nodeId, Value: nodeData
        this.connections = []; // Array of connection objects
    }

    addNode(node) {
        this.nodes[node.id] = { ...node };
    }

    removeNode(nodeId) {
        delete this.nodes[nodeId];
        this.connections = this.connections.filter(conn => conn.origin_id !== nodeId && conn.target_id !== nodeId);
    }

    updateNode(node) {
        if (this.nodes[node.id]) {
            this.nodes[node.id] = { ...node };
        }
    }

    addConnection(connection) {
        this.connections.push(connection);
    }

    removeConnection(connection) {
        this.connections = this.connections.filter(conn => {
            return !(conn.origin_id === connection.origin_id &&
                     conn.origin_slot === connection.origin_slot &&
                     conn.target_id === connection.target_id &&
                     conn.target_slot === connection.target_slot);
        });
    }

    getNodes() {
        return this.nodes;
    }

    getConnections() {
        return this.connections;
    }

    clear() {
        this.nodes = {};
        this.connections = [];
    }
}

module.exports = NodeRegistry;
