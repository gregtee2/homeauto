let graph;
let canvas;

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.canvas.width = window.innerWidth * ratio;
    canvas.canvas.height = window.innerHeight * ratio;
    canvas.canvas.style.width = window.innerWidth + "px";
    canvas.canvas.style.height = window.innerHeight + "px";
    canvas.setDirty(true, true);
}

function initializeGraph() {
    console.log("Initializing graph...");

    graph = new LiteGraph.LGraph();  // Initialize graph
    canvas = new LiteGraph.LGraphCanvas("#graphcanvas", graph);
    graph.start();
    resizeCanvas();

    // Add onLoad call to reinitialize nodes after loading the graph
    graph.onAfterLoad = function() {
        console.log("Executing nodes after graph load...");
        for (const node of graph._nodes) {
            if (node.onLoad) {
                node.onLoad();  // Call the onLoad function if it exists
                console.log(`Node ${node.title} - onLoad called`);
            }
            if (node.onExecute) {
                node.onExecute();  // Trigger execution on all nodes
                console.log(`Node ${node.title} - onExecute called`);
            }
        }

        // Manually trigger data flow from Brightness Control to HueLightNode
        const brightnessControlNode = graph.findNodeByTitle("Brightness Control");
        const executeNode = graph.findNodeByTitle("Execute");
        if (brightnessControlNode && executeNode) {
            brightnessControlNode.onExecute();
            executeNode.onExecute();
            console.log("Brightness and Execute nodes manually executed after load.");
        }

        graph.start();  // Ensure the graph is running after loading
        console.log('Graph has been initialized and is running after loading');
    };
}

window.addEventListener("load", initializeGraph);
window.addEventListener('resize', resizeCanvas);

document.getElementById("loadGraphBtn").addEventListener("click", function () {
    console.log("Load button clicked. Opening file dialog...");
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            console.log(`File selected: ${file.name}`);
            const reader = new FileReader();
            reader.onload = function(e) {
                const graphData = e.target.result;
                console.log("Graph data loaded from file.");

                // Clear the graph and reset it without reloading the UI
                graph.clear();
                graph.configure(JSON.parse(graphData));
                console.log("Graph reconfigured within the same session.");

                // Reinitialize and execute nodes
                graph.onAfterLoad();
            };
            reader.readAsText(file);
        } else {
            console.log("No file selected.");
        }
    });

    fileInput.click();
});

const saveButton = document.getElementById("saveGraphBtn");
if (saveButton) {
    saveButton.addEventListener("click", function () {
        console.log("Save button clicked.");
        const graphData = JSON.stringify(graph.serialize());
        console.log("Saving graph data:", graphData);

        fetch('http://127.0.0.1:5000/api/saveGraph', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ graph: graphData })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to save graph');
            }
        })
        .then(data => {
            console.log("Graph saved successfully:", data);
        })
        .catch(error => {
            console.error("Error saving graph:", error);
        });
    });
} else {
    console.error("saveGraphBtn not found.");
}
