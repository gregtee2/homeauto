class HSVRotationNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Rotation";
        this.size = [200, 140];
        this.properties = { speed: 0.5, throttle: 1000, brightness: 254 }; // Adding brightness property

        this.addOutput("HSV Info", "hsv_info");
        this.hue = 0;
        this.startTime = Date.now();
        this.lastUpdateTime = 0;

        // Add widgets to control speed, throttle, and brightness
        this.addWidget("slider", "Speed", this.properties.speed, (value) => {
            this.properties.speed = value;
        }, { min: 0, max: 10 });

        this.addWidget("slider", "Throttle (ms)", this.properties.throttle, (value) => {
            this.properties.throttle = value;
        }, { min: 100, max: 5000 });

        this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
        }, { min: 0, max: 254 }); // Brightness range from 0 to 254
    }

    onExecute() {
        const currentTime = Date.now();

        // Throttle updates based on the throttle value
        if (currentTime - this.lastUpdateTime < this.properties.throttle) {
            return; // Skip update if it's too soon
        }

        this.lastUpdateTime = currentTime;

        // Calculate the hue based on time and speed
        const elapsedTime = (currentTime - this.startTime) / 1000; // in seconds
        this.hue = (elapsedTime * this.properties.speed) % 360;

        // Log the current hue value
        // console.log("Current Hue:", this.hue);

        // Create the HSV object with brightness
        const hsvInfo = {
            hue: this.hue / 360, // Normalize to 0-1
            saturation: 1.0, // Fixed at full saturation
            brightness: this.properties.brightness // Adjustable brightness
        };

        // Output the HSV info
        this.setOutputData(0, hsvInfo);
    }

    // Serialize the node's properties to save its state
    serialize() {
        const data = super.serialize();
        data.properties = this.properties;
        return data;
    }

    // Configure the node's properties when loading from a saved state
    configure(data) {
        super.configure(data);
        this.properties = data.properties || { speed: 0.5, throttle: 1000, brightness: 254 };

        // Update the widget values
        this.widgets[0].value = this.properties.speed;
        this.widgets[1].value = this.properties.throttle;
        this.widgets[2].value = this.properties.brightness;
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("custom/hsv_rotation", HSVRotationNode);
