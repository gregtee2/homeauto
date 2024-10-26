// js/custom.js

document.addEventListener("DOMContentLoaded", function() {
    // Initialize LiteGraph
    var graph = new LGraph();
    var canvas = new LGraphCanvas("#litegraph-container", graph);

    graph.start();

    // Example: Add a simple node to the graph
    var node = LiteGraph.createNode("basic/const");
    node.pos = [200, 200];
    node.setValue(42);
    graph.add(node);

    // Import the TimerNode class
    import TimerNode from '../custom_nodes/v1/Timers/TimerNode.js';

    // Register the TimerNode with LiteGraph
    LiteGraph.registerNodeType("custom/TimerNode", TimerNode);

    // Add a button to turn on a light
    var button = LiteGraph.createNode("basic/button");
    button.pos = [400, 200];
    button.properties = { label: "Turn On Light" };
    graph.add(button);

    button.onExecute = function() {
        fetch('/api/lights/1/on', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if(data.success) {
                    console.log('Light turned on');
                } else {
                    console.error('Failed to turn on light:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
    };

    // Add a slider to set brightness
    var slider = LiteGraph.createNode("basic/slider");
    slider.pos = [400, 300];
    slider.properties = { min: 0, max: 254, value: 128 };
    graph.add(slider);

    slider.onExecute = function() {
        const brightness = this.properties.value;
        fetch('/api/lights/1/brightness', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brightness })
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                console.log('Brightness set to', brightness);
            } else {
                console.error('Failed to set brightness:', data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    };
});
