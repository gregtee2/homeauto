# Home Automation Setup

## Installation and Configuration Guide

### Prerequisites
- Ensure you have [Docker](https://docs.docker.com/get-docker/) installed on your system if you choose the Docker installation.
- For non-Docker installation, ensure you have Python 3.8 or higher installed.

### Docker Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/gregtee2/homeauto.git
   cd homeauto


Build the Docker Image:
docker build -t homeauto .


Run the Docker Container:
docker run -d --name homeauto-container -p 8081:8081 homeauto

Non-Docker Installation
Clone the Repository:

git clone https://github.com/gregtee2/homeauto.git
cd homeauto

Install Dependencies:
pip install -r requirements.txt


Start the Application:

Run the start_servers.bat file.
This will start the necessary servers and automatically open the application in your default web browser.


Configuration
Fetch Bridge IP and API Key:

Click on the Fetch Globals button in the web application.
Enter your Hue Bridge IP address when prompted.
After entering the IP, a second prompt will ask you to press the link button on your Hue Bridge.
Press the link button on your Hue Bridge, then return to the UI and press the prompt button within 30 seconds to fetch the API key.
The application will store the API key in your browser's memory.
Confirmation:

Once configured, the application is ready to control your Hue lights. You should see a confirmation message indicating successful configuration.

