class CustomColorTestNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Custom Color Test Node";
        this.size = [552.12, 414.89];
        this.properties = {
            red: 127.5,
            green: 127.5,
            blue: 127.5,
            colorTemp: 4150, // Default neutral position
            hue: 0.5, // Default neutral position
            brightness: 127.5
        };

        this.updateRGB = this.updateRGB.bind(this);
        this.updateColorTempFromRGB = this.updateColorTempFromRGB.bind(this);
        this.updateHueFromRGB = this.updateHueFromRGB.bind(this);
        this.updateRGBSliders = this.updateRGBSliders.bind(this);
        this.updateLuminanceWidget = this.updateLuminanceWidget.bind(this);
        this.resetSliders = this.resetSliders.bind(this);

        // RGB Sliders
        this.redSlider = this.addWidget("slider", "Red", this.properties.red, (value) => {
            this.properties.red = value;
            this.updateRGB();
        }, { min: 0, max: 255 });

        this.addSpacer();

        this.greenSlider = this.addWidget("slider", "Green", this.properties.green, (value) => {
            this.properties.green = value;
            this.updateRGB();
        }, { min: 0, max: 255 });

        this.addSpacer();

        this.blueSlider = this.addWidget("slider", "Blue", this.properties.blue, (value) => {
            this.properties.blue = value;
            this.updateRGB();
        }, { min: 0, max: 255 });

        this.addSpacer();

        // Color Temp Slider
        this.colorTempSlider = this.addWidget("slider", "Color Temp", this.properties.colorTemp, (value) => {
            this.properties.colorTemp = value;
            this.updateRGBFromColorTemp();
        }, { min: 1800, max: 6500 });

        this.addSpacer();

        // Hue Slider
        this.hueSlider = this.addWidget("slider", "Hue", this.properties.hue, (value) => {
            this.properties.hue = value;
            this.updateRGBFromHue();
        }, { min: 0, max: 1, step: 0.01 });

        this.addSpacer();

        // Luminance Slider
        this.luminanceSlider = this.addWidget("slider", "Luminance", this.properties.brightness, (value) => {
            this.properties.brightness = value;
            this.updateRGBFromLuminance();
        }, { min: 0, max: 255 });

        this.addSpacer();

        this.addWidget("button", "Reset", null, this.resetSliders);

        this.updateRGBSliders();
        this.updateLuminanceWidget();
    }

    addSpacer() {
        this.widgets.push({ type: "null", name: "", value: null });
    }

    updateRGB() {
        // Update Color Temp and Hue based on the RGB values
        this.updateColorTempFromRGB();
        this.updateHueFromRGB();
        this.updateLuminanceWidget();
    }

    updateColorTempFromRGB() {
        if (this.properties.red === this.properties.green && this.properties.green === this.properties.blue) {
            this.properties.colorTemp = 4150; // Neutral
        } else {
            // Logic to calculate color temp from RGB
            const totalDiff = Math.abs(this.properties.red - this.properties.blue);
            this.properties.colorTemp = this.interpolate(totalDiff, 0, 255, 4150, 1800);
        }
        this.colorTempSlider.value = this.properties.colorTemp;
    }

    updateHueFromRGB() {
        if (this.properties.red === this.properties.green && this.properties.green === this.properties.blue) {
            this.properties.hue = 0.5; // Neutral
        } else {
            // Logic to calculate hue from RGB
            const totalDiff = Math.abs(this.properties.red - this.properties.green);
            this.properties.hue = this.interpolate(totalDiff, 0, 255, 0.5, 0);
        }
        this.hueSlider.value = this.properties.hue;
    }

    updateRGBFromColorTemp() {
        const tempChange = this.properties.colorTemp - 4150;
        const redAdjust = -tempChange * 0.01;
        const blueAdjust = tempChange * 0.01;

        this.properties.red = Math.min(255, Math.max(0, this.properties.red + redAdjust));
        this.properties.blue = Math.min(255, Math.max(0, this.properties.blue + blueAdjust));

        this.updateRGBSliders();
    }

    updateRGBFromHue() {
        const hueChange = this.properties.hue - 0.5;
        const redAdjust = -hueChange * 255;
        const greenAdjust = hueChange * 255;

        this.properties.red = Math.min(255, Math.max(0, this.properties.red + redAdjust));
        this.properties.green = Math.min(255, Math.max(0, this.properties.green + greenAdjust));

        this.updateRGBSliders();
    }

    updateRGBFromLuminance() {
        const scale = this.properties.brightness / 127.5;

        this.properties.red = Math.min(255, Math.max(0, this.properties.red * scale));
        this.properties.green = Math.min(255, Math.max(0, this.properties.green * scale));
        this.properties.blue = Math.min(255, Math.max(0, this.properties.blue * scale));

        this.updateRGBSliders();
    }

    updateRGBSliders() {
        this.redSlider.value = this.properties.red;
        this.greenSlider.value = this.properties.green;
        this.blueSlider.value = this.properties.blue;
    }

    updateLuminanceWidget() {
        this.luminanceSlider.value = this.properties.brightness;
    }

    resetSliders() {
        this.properties.red = 127.5;
        this.properties.green = 127.5;
        this.properties.blue = 127.5;
        this.properties.colorTemp = 4150;
        this.properties.hue = 0.5;
        this.properties.brightness = 127.5;

        this.updateRGBSliders();
        this.updateLuminanceWidget();
        this.colorTempSlider.value = this.properties.colorTemp;
        this.hueSlider.value = this.properties.hue;
    }

    interpolate(value, minVal, maxVal, start, end) {
        return start + ((value - minVal) / (maxVal - minVal)) * (end - start);
    }
}

LiteGraph.registerNodeType("custom/color_test", CustomColorTestNode);
