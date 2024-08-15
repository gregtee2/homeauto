class HSVRotationNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "HSV Rotation";
        this.size = [286.4, 201.5]; // Set the size based on the example provided
        this.properties = { 
            speed: 0.5, 
            throttle: 1000, 
            brightness: 254, 
            hueStart: 0, 
            hueEnd: 360, 
            bounce: false 
        };

        this.addOutput("HSV Info", "hsv_info");
        this.hue = 0;
        this.startTime = Date.now();
        this.lastUpdateTime = 0;
        this.direction = 1;  // To manage the bounce effect

        // Add widgets for speed, throttle, brightness, hue range, and bounce toggle
        this.addWidget("slider", "Speed", this.properties.speed, (value) => {
            this.properties.speed = value;
        }, { min: 0, max: 10 });

        this.addWidget("slider", "Throttle (ms)", this.properties.throttle, (value) => {
            this.properties.throttle = value;
        }, { min: 100, max: 5000 });

        this.addWidget("slider", "Brightness", this.properties.brightness, (value) => {
            this.properties.brightness = value;
        }, { min: 0, max: 254 });

        this.addWidget("slider", "Hue Start", this.properties.hueStart, (value) => {
            this.properties.hueStart = value;
            this.setDirtyCanvas(true);
        }, { min: 0, max: 360 });

        this.addWidget("slider", "Hue End", this.properties.hueEnd, (value) => {
            this.properties.hueEnd = value;
            this.setDirtyCanvas(true);
        }, { min: 0, max: 360 });

        this.addWidget("toggle", "Bounce", this.properties.bounce, (value) => {
            this.properties.bounce = value;
        });
    }

    onExecute() {
        const currentTime = Date.now();

        // Throttle updates based on the throttle value
        if (currentTime - this.lastUpdateTime < this.properties.throttle) {
            return; // Skip update if it's too soon
        }

        this.lastUpdateTime = currentTime;

        // Update the hue based on time, speed, and range
        const elapsedTime = (currentTime - this.startTime) / 1000; // in seconds
        let hueRange = this.properties.hueEnd - this.properties.hueStart;

        if (this.properties.bounce) {
            this.hue += this.direction * (elapsedTime * this.properties.speed) % 360;
            if (this.hue > this.properties.hueEnd || this.hue < this.properties.hueStart) {
                this.direction *= -1;  // Reverse direction when limits are hit
            }
        } else {
            this.hue = (elapsedTime * this.properties.speed) % hueRange + this.properties.hueStart;
        }

        const hsvInfo = {
            hue: this.hue / 360, // Normalize to 0-1
            saturation: 1.0, // Fixed at full saturation
            brightness: this.properties.brightness // Adjustable brightness
        };

        // Output the HSV info
        this.setOutputData(0, hsvInfo);
    }

    // Draw the color bar in the background
    onDrawBackground(ctx) {
        // Ensure we're calling the superclass method first
        if (super.onDrawBackground) {
            super.onDrawBackground(ctx);
        }

        // Draw the color bar below the sliders
        const gradient = ctx.createLinearGradient(10, this.size[1] - 30, this.size[0] - 10, this.size[1] - 30);

        // We want to draw the full spectrum from hueStart to hueEnd
        const hueRange = this.properties.hueEnd - this.properties.hueStart;

        // Add multiple stops to create a smooth gradient
        for (let i = 0; i <= 10; i++) {
            const hue = this.properties.hueStart + (hueRange * i / 10);
            gradient.addColorStop(i / 10, `hsl(${hue}, 100%, 50%)`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(10, this.size[1] - 30, this.size[0] - 20, 20);
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
        this.properties = data.properties || { speed: 0.5, throttle: 1000, brightness: 254, hueStart: 0, hueEnd: 360, bounce: false };

        // Force the size when loading the node
        this.size = [286.4, 201.5];

        // Update the widget values
        this.widgets[0].value = this.properties.speed;
        this.widgets[1].value = this.properties.throttle;
        this.widgets[2].value = this.properties.brightness;
        this.widgets[3].value = this.properties.hueStart;
        this.widgets[4].value = this.properties.hueEnd;
        this.widgets[5].value = this.properties.bounce;
    }

    // Ensure the node size is correct when added to the graph
    onAdded() {
        this.size = [286.4, 201.5];
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("custom/hsv_rotation", HSVRotationNode);
