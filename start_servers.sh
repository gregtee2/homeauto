#!/bin/sh

# Start the Flask server
cd /usr/src/app
python app.py &

# Wait for Flask server to start
sleep 5

# Start the HTTP server
python -m http.server 8081 &

# Wait for HTTP server to start
sleep 5

# Open the default web browser to the URL (this line is usually not needed in a server environment)
# You would typically not start a web browser in a server environment, but the line below is left
# as a placeholder to show how you might navigate to the app locally.
# xdg-open http://localhost:8081

# In most Docker setups, you might expose the port to the host machine
# Then you can manually open your browser and navigate to http://localhost:8081



