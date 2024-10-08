class HLSViewerNode {
    constructor() {
        // Add inputs for RTSP URL and Media Server Address
        this.addInput("RTSP URL", "string");
        this.addInput("Media Server Address", "string");
        this.size = [400, 300];

        // Define properties with default values
        this.properties = {
            mute: false // Default state: not muted
        };

        // Adding mute control widget
        this.addWidget("toggle", "Mute", this.properties.mute, (value) => {
            this.properties.mute = value;
            if (this.videoElement) {
                this.videoElement.muted = value;
            }
            this.setDirtyCanvas(true, true);
        });

        // Create a video element
        this.videoElement = document.createElement("video");
        this.videoElement.width = 400;
        this.videoElement.height = 300;
        this.videoElement.controls = true;
        this.videoElement.autoplay = true;
        this.videoElement.style.display = "none"; // Hide it initially
        this.videoElement.style.objectFit = "contain"; // Maintain aspect ratio

        // Append the video element to the DOM
        document.body.appendChild(this.videoElement);

        // Initialize HLS.js
        if (window.Hls && window.Hls.isSupported()) {
            console.log("HLS.js is supported, initializing HLS instance.");
            this.hls = new window.Hls();
            // Optional: Handle HLS.js events
            this.hls.on(window.Hls.Events.ERROR, (event, data) => {
                console.error("HLS.js Error:", data);
            });
        } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // For Safari
            console.log("Safari detected, using native HLS support.");
            this.hls = null;
        } else {
            console.error("HLS not supported in this browser.");
        }
    }

    onExecute() {
        // Log the current input values
        const rtspUrl = this.getInputData(0);
        const mediaServerAddress = this.getInputData(1) || "localhost:8888"; // Updated default port to 8888

        console.log("Executing HLSViewerNode with inputs:");
        console.log("RTSP URL:", rtspUrl);
        console.log("Media Server Address:", mediaServerAddress);

        // If either RTSP URL or Media Server Address is provided, try to load the HLS stream
        if (rtspUrl && mediaServerAddress) {
            console.log(`Received RTSP URL: ${rtspUrl}, Media Server Address: ${mediaServerAddress}`);

            // Convert RTSP URL to HLS URL
            const hlsUrl = this.convertRtspToHlsUrl(rtspUrl, mediaServerAddress);

            if (hlsUrl) {
                console.log("Using HLS URL:", hlsUrl);
                this.videoElement.style.display = "block";

                if (this.hls) {
                    console.log("Loading HLS stream...");
                    this.hls.loadSource(hlsUrl);
                    this.hls.attachMedia(this.videoElement);

                    // Add listeners to confirm the video is playing
                    this.videoElement.addEventListener('canplay', () => {
                        console.log("Video can start playing");
                    });

                    this.videoElement.addEventListener('play', () => {
                        console.log("Video is playing");
                    });

                    this.videoElement.addEventListener('error', (e) => {
                        console.error("Video element error:", e);
                    });
                } else {
                    // For Safari
                    console.log("Setting video element source for Safari.");
                    this.videoElement.src = hlsUrl;

                    this.videoElement.addEventListener('canplay', () => {
                        console.log("Video can start playing");
                    });

                    this.videoElement.addEventListener('play', () => {
                        console.log("Video is playing");
                    });

                    this.videoElement.addEventListener('error', (e) => {
                        console.error("Video element error:", e);
                    });
                }

                // Apply the mute setting based on the property
                this.videoElement.muted = this.properties.mute;
                console.log(`Video muted state set to: ${this.properties.mute}`);
            } else {
                console.error("Failed to convert RTSP URL to HLS URL");
            }
        } else {
            console.log("RTSP URL or Media Server Address missing, cannot load HLS stream.");
        }
    }

    convertRtspToHlsUrl(rtspUrl, mediaServerAddress) {
        try {
            // Using the currentRtspUrl (or camera ID) to generate the stream name
            const streamName = this.currentRtspUrl ? this.currentRtspUrl.split('/')[this.currentRtspUrl.split('/').length - 1] : 'camera1';
            const hlsUrl = `http://${mediaServerAddress}/${streamName}/index.m3u8`;
            console.log("Constructed HLS URL:", hlsUrl);
            return hlsUrl;
        } catch (error) {
            console.error("Error converting RTSP URL to HLS URL:", error);
            return null;
        }
    }

    onExecute() {
        const rtspUrl = this.getInputData(0);
        const mediaServerAddress = this.getInputData(1) || "localhost:8888";

        console.log("Executing HLSViewerNode with inputs:");
        console.log("RTSP URL:", rtspUrl);
        console.log("Media Server Address:", mediaServerAddress);

        if (!rtspUrl || !mediaServerAddress) {
            console.error("RTSP URL or Media Server Address missing, cannot load HLS stream.");
            return;
        }

        if (rtspUrl !== this.currentRtspUrl || mediaServerAddress !== this.currentMediaServerAddress) {
            this.currentRtspUrl = rtspUrl;
            this.currentMediaServerAddress = mediaServerAddress;
            this.videoElement.style.display = "block";

            // Convert RTSP URL to HLS URL
            const hlsUrl = this.convertRtspToHlsUrl(rtspUrl, mediaServerAddress);

            if (hlsUrl) {
                console.log("Using HLS URL:", hlsUrl);
                if (this.hls) {
                    this.hls.loadSource(hlsUrl);
                    this.hls.attachMedia(this.videoElement);
                } else {
                    // For Safari
                    this.videoElement.src = hlsUrl;
                }

                // Apply the mute setting based on the property
                this.videoElement.muted = this.properties.mute;
            } else {
                console.error("Failed to convert RTSP URL to HLS URL");
            }
        } else {
            console.log("No new RTSP URL or Media Server Address detected, skipping update.");
        }
    }



    onDrawForeground(ctx) {
        if (this.flags.collapsed) return;

        if (this.videoElement) {
            // Calculate aspect ratio
            const videoWidth = this.videoElement.videoWidth;
            const videoHeight = this.videoElement.videoHeight;
            const videoAspectRatio = videoWidth / videoHeight || 1;
            const nodeWidth = this.size[0];
            const nodeHeight = this.size[1];
            const nodeAspectRatio = nodeWidth / nodeHeight;

            let drawWidth, drawHeight;

            if (nodeAspectRatio > videoAspectRatio) {
                // Node is wider than video
                drawHeight = nodeHeight;
                drawWidth = drawHeight * videoAspectRatio;
            } else {
                // Node is taller than video
                drawWidth = nodeWidth;
                drawHeight = drawWidth / videoAspectRatio;
            }

            // Calculate position to center the video
            const offsetX = (nodeWidth - drawWidth) / 2;
            const offsetY = (nodeHeight - drawHeight) / 2;

            ctx.drawImage(this.videoElement, offsetX, offsetY, drawWidth, drawHeight);

            // Optional: Draw mute icon if muted
            if (this.properties.mute) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
                ctx.font = "20px Arial";
                ctx.fillText("🔇", nodeWidth - 30, 30);
            }
        } else {
            // Draw placeholder
            ctx.fillStyle = "#222";
            ctx.fillRect(0, 0, this.size[0], this.size[1]);
            ctx.fillStyle = "#aaa";
            ctx.fillText("HLS Feed (No URL)", 10, this.size[1] / 2);
        }
    }
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("camera/HLSViewerNode", HLSViewerNode);
