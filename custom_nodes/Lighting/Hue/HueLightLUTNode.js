class HueLightLUTNode extends LiteGraph.LGraphNode {
    constructor() {
        super();
        this.title = "Hue Light LUT"; // Set the title here
        this.addInput("HSV Info", "hsv_info");
        this.addOutput("HSV Info", "hsv_info");

        // Predefined LUT structure
        this.lut = {
            red: {}, green: {}, blue: {}
        };

        // Populate LUT with predefined data points and interpolate values
        this.generateLUT();
    }

    // Populate LUT with provided data points and interpolate
    generateLUT() {
        const dataPoints = [
        { l: 32, r: 23, g: 24, b: 32 },  // Sliders at (23, 24, 32), Bridge reports (99, 99, 100)
        { l: 64, r: 47, g: 49, b: 64 },  // Sliders at (47, 49, 64), Bridge reports (137, 137, 137)
        { l: 96, r: 70, g: 74, b: 96 },  // Sliders at (70, 74, 96), Bridge reports (164, 165, 165)
        { l: 128, r: 94, g: 99, b: 128 },  // Sliders at (120, 124, 160), Bridge reports (188, 188, 187)
        { l: 160, r: 118, g: 124, b: 160 },  // Sliders at (143, 149, 192), Bridge reports (208, 207, 207)
        { l: 192, r: 143, g: 148, b: 192 },  // Sliders at (173, 180, 232), Bridge reports (225, 225, 225)
        { l: 225, r: 167, g: 174, b: 225 },  // Sliders at (190, 196, 254), Bridge reports (244, 245, 244)
        { l: 254, r: 191, g: 195, b: 255 }   // Sliders at max (255, 255, 255), Bridge reports (255, 254, 255)
    ];

        const interpolate = (start, end, t) => start + t * (end - start);

        // Interpolate between data points
        for (let i = 0; i <= 255; i++) {
            let lowerPoint = dataPoints[0];
            let upperPoint = dataPoints[dataPoints.length - 1];

            // Find the correct interval for interpolation
            for (let j = 0; j < dataPoints.length - 1; j++) {
                if (i >= dataPoints[j].l && i <= dataPoints[j + 1].l) {
                    lowerPoint = dataPoints[j];
                    upperPoint = dataPoints[j + 1];
                    break;
                }
            }

            const t = (i - lowerPoint.l) / (upperPoint.l - lowerPoint.l);

            this.lut.red[i] = interpolate(lowerPoint.r, upperPoint.r, t);
            this.lut.green[i] = interpolate(lowerPoint.g, upperPoint.g, t);
            this.lut.blue[i] = interpolate(lowerPoint.b, upperPoint.b, t);
        }
    }

    onExecute() {
        const inputHSV = this.getInputData(0);
        if (!inputHSV) {
            console.log("No input HSV data received.");
            return;
        }

        //console.log("Input HSV:", inputHSV);

        const rgb = this.hsvToRgb(inputHSV.hue, inputHSV.saturation, inputHSV.brightness / 255);

        //console.log("Initial RGB from HSV:", rgb);

        // Apply the LUT to the RGB values
        const adjustedRGB = [
            Math.min(255, this.lut.red[Math.round(rgb[0])] || rgb[0]),
            Math.min(255, this.lut.green[Math.round(rgb[1])] || rgb[1]),
            Math.min(255, this.lut.blue[Math.round(rgb[2])] || rgb[2])
        ];

        //console.log("Adjusted RGB after LUT:", adjustedRGB);

        // Convert back to HSV
        const outputHSV = this.rgbToHsv(adjustedRGB[0], adjustedRGB[1], adjustedRGB[2]);

        //console.log("Output HSV:", outputHSV);

        this.setOutputData(0, {
            hue: outputHSV.hue,
            saturation: outputHSV.saturation,
            brightness: outputHSV.brightness * 255
        });
    }

    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { hue: h, saturation: s, brightness: v };
    }
}

// Register the node type with LiteGraph
LiteGraph.registerNodeType("Lighting/Hue/HueLightLUT", HueLightLUTNode);
