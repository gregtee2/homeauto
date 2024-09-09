class GroupedLightNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Grouped Light Control";
        this.size = [360, 200];  // Adjust size as needed

        // Properties to hold light IDs and their settings
        this.properties = {
            light_ids: [],  // Array to hold selected light IDs
            hsv: { hue: 0.5, saturation: 1, brightness: 254 },  // Shared HSV settings
            group_name: "",  // Optional: Name of the group
        };

        this.addInput("HSV Info", "hsv_info");
        this.addOutput("Light Group Info", "light_group_info");

        // Initialize widgets
        this.setupWidgets();
    }

    setupWidgets() {
        // Multi-select or list for choosing lights
        this.addWidget("multiselect", "Select Lights", this.properties.light_ids, (v) => {
            this.properties.light_ids = v;
        }, { values: this.fetchAvailableLights() });

        // HSV Control Widgets
        this.addWidget("slider", "Hue", this.properties.hsv.hue, (v) => {
            this.properties.hsv.hue = v;
        }, { min: 0, max: 1 });

        this.addWidget("slider", "Saturation", this.properties.hsv.saturation, (v) => {
            this.properties.hsv.saturation = v;
        }, { min: 0, max: 1 });

        this.addWidget("slider", "Brightness", this.properties.hsv.brightness, (v) => {
            this.properties.hsv.brightness = v;
        }, { min: 0, max: 254 });

        // Optional: Group name
        this.addWidget("text", "Group Name", this.properties.group_name, (v) => {
            this.properties.group_name = v;
        });
    }

    fetchAvailableLights() {
        // Fetch and return a list of available lights from the Hue Bridge
        // For this example, assume an API call returns the light list
        return ["Light 1", "Light 2", "Light 3", "Light 4"];  // Example light names/IDs
    }

    onExecute() {
        // Logic to control the group of lights with shared settings
        const hsvInfo = this.getInputData(0);
        if (hsvInfo) {
            this.properties.hsv = hsvInfo;
        }

        const lightGroupInfo = {
            light_ids: this.properties.light_ids,
            hsv: this.properties.hsv,
            group_name: this.properties.group_name
        };

        this.setOutputData(0, lightGroupInfo);
    }

    onSerialize(o) {
        o.properties = LiteGraph.cloneObject(this.properties);
    }

    onConfigure(o) {
        this.properties = LiteGraph.cloneObject(o.properties);
        this.setupWidgets();
    }
}

LiteGraph.registerNodeType("custom/grouped_light", GroupedLightNode);
