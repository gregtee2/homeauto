// /frontend/custom_nodes/v1/BaseNode.js

class BaseNode {
    constructor(nodeID, nodeType) {
        this.nodeID = nodeID;
        this.nodeType = nodeType;
        this.previousNodes = [];
        this.nextNodes = [];
        this.state = {};
    }

    // Method to collect metadata about the node
    collectMetadata() {
        return {
            id: this.nodeID,
            type: this.nodeType,
            state: this.state,
            previousNodes: this.previousNodes.map(node => node.nodeID),
            nextNodes: this.nextNodes.map(node => node.nodeID)
        };
    }

    // Method to send metadata and state to backend
    sendToBackend() {
        const metadata = this.collectMetadata();
        fetch('/api/update-node', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        })
        .then(response => response.json())
        .then(data => console.log('Node state sent to backend:', data))
        .catch(error => console.error('Error sending node data:', error));
    }

    // Called when the node receives input or changes state
    updateState(newState) {
        this.state = newState;
        this.sendToBackend(); // Automatically send updated state
    }

    // Handle input from other nodes and manage connections
    connectToNode(node) {
        this.nextNodes.push(node);
        node.previousNodes.push(this);
        this.sendToBackend();
    }
}

export default BaseNode;
