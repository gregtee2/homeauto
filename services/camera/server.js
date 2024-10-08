// server.js
const express = require('express');
const onvif = require('onvif');
const cors = require('cors'); // Import the cors middleware

const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for all routes

// Endpoint to discover ONVIF cameras
app.get('/discover_cameras', (req, res) => {
    onvif.Discovery.probe((err, cams) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to discover cameras' });
        }
        res.json({ cameras: cams.map(cam => ({ name: cam.name, xaddr: cam.xaddr })) });
    });
});

// Endpoint to get the RTSP URL from a specific camera
app.get('/get_rtsp_url', (req, res) => {
    const { ip, username, password } = req.query;

    if (!ip || !username || !password) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`Attempting to connect to camera at IP: ${ip} with username: ${username}`);

    new onvif.Cam({
        hostname: ip,
        username: username,
        password: password,
        port: 80, // ONVIF communication port
        path: '/onvif/device_service', // Common ONVIF service path
        auth: 'digest' // Try 'digest' or 'basic' if the camera needs basic authentication
    }, function (err, camera) {
        if (err) {
            console.error('Error connecting to the camera:', err);
            return res.status(500).json({ error: 'Failed to connect to camera' });
        }

        console.log('Successfully connected to the camera');

        // Get profiles
        camera.getProfiles((err, profiles) => {
            if (err) {
                console.error('Error getting profiles:', err);
                return res.status(500).json({ error: 'Failed to get profiles' });
            }

            if (profiles.length === 0) {
                console.error('No profiles found for the camera');
                return res.status(500).json({ error: 'No profiles found for the camera' });
            }

            console.log('Profiles retrieved:', profiles);

            // Get the stream URI for the first profile
            const profileToken = profiles[0].$.token;
            camera.getStreamUri({ protocol: 'RTSP', profileToken: profileToken }, (err, stream) => {
                if (err) {
                    console.error('Error getting stream URI:', err);
                    return res.status(500).json({ error: 'Failed to get stream URI' });
                }

                console.log('Stream URI:', stream.uri);
                res.json({ rtspUrl: stream.uri });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`ONVIF discovery service listening at http://localhost:${port}`);
});
