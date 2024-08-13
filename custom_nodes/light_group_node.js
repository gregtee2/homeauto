class LightGroupNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Light Group";

        // Set initial size of the node
        this.size = [400, 300];  // Adjust these dimensions as needed

        // Only one input for HSV
        this.addInput("HSV Info", "hsv_info");

        // Output for aggregated light info (device IDs)
        this.addOutput("Light Info", "light_info");

        // Internal storage for selected light nodes
        this.selectedLights = [];
        
        // Available lights in the graph
        this.availableLights = [];

        // Widget to fetch lights from the Hue Bridge
        this.addWidget("button", "Fetch Lights", null, () => {
            this.fetchLights();
        });

        // Track the combo widgets for light selection
        this.lightSelectionWidgets = [];
        this.addLightSelectionWidget();
    }

    fetchLights() {
        fetch('http://localhost:5000/api/lights')
            .then(response => response.json())
            .then(data => {
                // Process the lights and update the availableLights list
                this.availableLights = Object.entries(data).map(([name, info]) => ({
                    title: name,
                    properties: { light_id: info.id }
                }));

                // Update the first light selection widget with the available lights
                this.updateLightSelectionWidget(0);
                this.graph.dirty_canvas = true; // Mark the canvas as needing a redraw
            })
            .catch(error => {
                console.error('Error fetching lights:', error);
            });
    }

    addLightSelectionWidget() {
        // Add a new combo widget for light selection
        const index = this.lightSelectionWidgets.length;
        const widget = this.addWidget("combo", `Select Light ${index + 1}`, null, (value) => {
            this.toggleLightSelection(value, index);
            this.addLightSelectionWidget(); // Add another widget for the next light
            this.forceResize();  // Force resize after adding a new widget
        }, { values: this.availableLights.map(light => light.title) });

        this.lightSelectionWidgets.push(widget);
        this.forceResize();  // Force resize after adding a new widget
    }

    updateLightSelectionWidget(index) {
        // Update the available options for a specific widget based on current selection
        const selectedTitles = this.selectedLights.map(light => light.title);
        const availableTitles = this.availableLights
            .map(light => light.title)
            .filter(title => !selectedTitles.includes(title));

        this.lightSelectionWidgets[index].options.values = availableTitles;
        this.graph.dirty_canvas = true; // Mark the canvas as needing a redraw
    }

    toggleLightSelection(lightTitle, widgetIndex) {
        // Find the light node by title
        const lightNode = this.availableLights.find(light => light.title === lightTitle);
        if (lightNode && !this.selectedLights.includes(lightNode)) {
            this.selectedLights.push(lightNode); // Add to selected lights

            // Update the remaining widgets to exclude the selected light
            this.lightSelectionWidgets.forEach((widget, index) => {
                if (index > widgetIndex) {
                    this.updateLightSelectionWidget(index);
                }
            });

            this.forceResize();  // Force resize after updating selection
        }
    }

    forceResize() {
        // Adjust this size as needed to fit the widgets comfortably
        const minHeight = 300 + (this.lightSelectionWidgets.length * 30);
        this.size = [400, Math.max(minHeight, this.size[1])];
    }

    onConfigure() {
        // Force size when node is reconfigured
        this.forceResize();
    }

    onExecute() {
        // Retrieve HSV values
        const hsvInfo = this.getInputData(0);

        // Distribute HSV values to all selected light nodes
        if (hsvInfo) {
            this.selectedLights.forEach(lightNode => {
                // Implement the logic to send HSV values to each light
            });
        }

        // Aggregate and output device IDs from all selected lights
        const deviceIDs = this.selectedLights.map(light => light.properties.light_id);
        this.setOutputData(0, { device_ids: deviceIDs });
    }

    onAdded() {
        // Force size when the node is first added to the graph
        this.forceResize();
    }
}

// Register the node type
LiteGraph.registerNodeType("custom/light_group", LightGroupNode);
