class HLSViewerNode {
    constructor() {
        this.addInput("RTSP URL", "string");
        this.size = [400, 300];

        // Create a video element
        this.videoElement = document.createElement("video");
        this.videoElement.width = 400;
        this.videoElement.height = 300;
        this.videoElement.controls = true;
        this.videoElement.autoplay = true;
        this.videoElement.style.display = "none";

        // Append the video element to the DOM
        document.body.appendChild(this.videoElement);

        // Initialize HLS.js
        if (Hls.isSupported()) {
            this.hls = new Hls();
        } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // For Safari
            this.hls = null;
        } else {
            console.error("HLS not supported");
        }
    }

    onExecute() {
        const rtspUrl = this.getInputData(0);

        if (rtspUrl && rtspUrl !== this.currentRtspUrl) {
            this.currentRtspUrl = rtspUrl;
            this.videoElement.style.display = "block";

            // Convert RTSP URL to HLS URL
            const hlsUrl = this.convertRtspToHlsUrl(rtspUrl);

            if (hlsUrl) {
                if (this.hls) {
                    this.hls.loadSource(hlsUrl);
                    this.hls.attachMedia(this.videoElement);
                } else {
                    // For Safari
                    this.videoElement.src = hlsUrl;
                }
            } else {
                console.error("Failed to convert RTSP URL to HLS URL");
            }
        }
    }

    convertRtspToHlsUrl(rtspUrl) {
        // Implement the logic to convert RTSP URL to HLS URL based on your media server's configuration

        // Example implementation:
        try {
            // Parse the RTSP URL
            const url = new URL(rtspUrl);

            // Extract the stream name from the RTSP URL path
            // Assuming the stream name is the last segment of the path
            const pathSegments = url.pathname.split('/');
            const streamName = pathSegments[pathSegments.length - 1] || 'default';

            // Construct the HLS URL
            // Replace 'yourserver' and '8083' with your media server's address and port
            const hlsUrl = `http://yourserver:8083/streams/${streamName}/0/hls.m3u8`;

            return hlsUrl;
        } catch (error) {
            console.error("Error converting RTSP URL to HLS URL:", error);
            return null;
        }
    }

    onRemoved() {
        if (this.videoElement) {
            document.body.removeChild(this.videoElement);
            this.videoElement = null;
        }
        if (this.hls) {
            this.hls.destroy();
        }
    }

    onDrawForeground(ctx) {
        if (!this.videoElement.src) {
            ctx.fillStyle = "#222";
            ctx.fillRect(0, 0, this.size[0], this.size[1]);
            ctx.fillStyle = "#aaa";
            ctx.fillText("HLS Feed (No URL)", 10, this.size[1] / 2);
        }
    }
}

LiteGraph.registerNodeType("camera/HLSViewerNode", HLSViewerNode);
