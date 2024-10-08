




// CameraConfigNode.js
class CameraConfigNode {
    constructor() {
        // Add outputs for RTSP URL and Media Server Address
        this.addOutput("RTSP URL", "string");
        this.addOutput("Media Server Address", "string");
        this.size = [300, 250]; // Adjusted size to accommodate widgets

        // Initialize default values
        this.ipAddress = "";
        this.username = "";
        this.password = "";
        this.rtspPath = ""; // Optional, can be left empty
        this.mediaServerAddress = "localhost:8888"; // Updated to match MediaMTX HLS port
        this.rtspUrl = "";

        // Adding widgets for user inputs
        this.addWidget("text", "IP Address", this.ipAddress, (value) => {
            this.ipAddress = value;
        });
        this.addWidget("text", "Username", this.username, (value) => {
            this.username = value;
        });
        this.addWidget("text", "Password", this.password, (value) => {
            this.password = value;
        });
        this.addWidget("text", "RTSP Path", this.rtspPath, (value) => {
            this.rtspPath = value;
        });
        this.addWidget("text", "Media Server Address", this.mediaServerAddress, (value) => {
            this.mediaServerAddress = value;
        });
        this.addWidget("button", "Fetch RTSP URL", null, () => {
            if (this.ipAddress && this.username && this.password) {
                const params = new URLSearchParams({
                    ip: this.ipAddress,
                    username: this.username,
                    password: this.password
                });
                fetch(`http://localhost:3000/get_rtsp_url?${params.toString()}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.rtspUrl) {
                            this.rtspUrl = data.rtspUrl;
                            console.log("Fetched RTSP URL:", this.rtspUrl);
                        } else {
                            console.error("Error fetching RTSP URL:", data.error);
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching RTSP URL:", error);
                    });
            } else {
                console.error("IP Address, Username, and Password are required to fetch the RTSP URL");
            }
        });
    }

    onExecute() {
        if (this.rtspUrl) {
            this.setOutputData(0, this.rtspUrl); // Output RTSP URL
        }
        if (this.mediaServerAddress) {
            this.setOutputData(1, this.mediaServerAddress); // Output Media Server Address
        }
    }

    onSerialize(o) {
        // Store the current values of the node settings
        o.ipAddress = this.ipAddress;
        o.username = this.username;
        o.password = this.password;
        o.rtspPath = this.rtspPath;
        o.mediaServerAddress = this.mediaServerAddress;
        o.rtspUrl = this.rtspUrl;
    }

    onConfigure(o) {
        // Restore the node settings from serialized data
        this.ipAddress = o.ipAddress || "";
        this.username = o.username || "";
        this.password = o.password || "";
        this.rtspPath = o.rtspPath !== undefined ? o.rtspPath : ""; // Allow empty string
        this.mediaServerAddress = o.mediaServerAddress || "localhost:8888"; // Updated default
        this.rtspUrl = o.rtspUrl || "";

        // Update the widgets with the restored values
        this.widgets[0].value = this.ipAddress;
        this.widgets[1].value = this.username;
        this.widgets[2].value = this.password;
        this.widgets[3].value = this.rtspPath;
        this.widgets[4].value = this.mediaServerAddress;
    }
}

// Register the node with LiteGraph
LiteGraph.registerNodeType("camera/CameraConfigNode", CameraConfigNode);

