@echo off
REM start_servers.bat
REM This script starts the backend and frontend servers and opens the frontend in the default web browser.

REM Start the Backend server
start "Backend Server" cmd /k "cd /d C:\T2Auto\backend && npm run dev"

REM Start the Frontend server
start "Frontend Server" cmd /k "cd /d C:\T2Auto\frontend && npm start"

REM Wait for servers to initialize
echo Waiting for servers to start...
timeout /t 10 /nobreak

REM Open the default web browser and navigate to the Frontend URL
start "Web Browser" "http://localhost:3000"

REM Optional: Open a new browser tab for the Backend API (if needed)
REM start "Backend API" "http://localhost:8081"

echo Servers have been started successfully.
pause
