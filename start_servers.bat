


@echo off
REM Start the Flask server
start "Flask Server" cmd /k "cd /d C:\toggle_project && python app.py"

REM Wait for a few seconds to ensure Flask server starts
timeout /t 5

REM Start the HTTP server
start "HTTP Server" cmd /k "cd /d C:\toggle_project && python -m http.server 8081"

REM Wait for a few seconds to ensure HTTP server starts
timeout /t 5

REM Open the default web browser and navigate to the URL
start "Web Browser" "http://localhost:8081"

