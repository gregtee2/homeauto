Refer to InstallationReadMe.txt for instructions on install and initial setup.




What's new? 8/26

Summary of Recent Changes
Dynamic Color Swatch Implementation

HueLightNodePlus:
Added a dynamic color swatch to visually display the color being sent to the Hue Bridge.
Integrated the color swatch feature, updating the node UI to reflect current HSV values dynamically.
Node Size Enforcement

HueLightNodePlus:
Ensured consistent node size to accommodate the new color swatch and other UI elements.
Node size is enforced during node initialization, resizing, and graph loading.
Days of the Week Node Enhancements

Special Day Priority:
Implemented logic to prioritize special days over regular day selections.
Special days now trigger the "On" command even if other days are selected.
User Interface Improvements:
Added an "Everyday" toggle for easy selection of all days.
Improved the display of selected days and special days, ensuring clear and accurate UI feedback.
Updated the background color of text displays to match the node's background for consistency.
Bug Fixes:
Fixed the issue where the "Add Special Day" input would persist incorrectly.
Corrected behavior to ensure special days are correctly loaded from saved graphs.
Serialization and Deserialization:
Enhanced serialization to ensure all settings, including special days, are saved and restored accurately.
Project Management and Node Documentation

Updated project documentation to reflect the recent enhancements and bug fixes.
Improved clarity on node functionality and interactions, making it easier for developers and users to understand the system.
Next Steps:
Testing: Further testing is recommended to validate the enhancements in different scenarios.
Documentation: Continued updates to project documentation to reflect the latest changes.





What's new?  8/25/24

# Hue Light Control System Using LiteGraph.js

## Overview
This project leverages LiteGraph.js to create a dynamic, node-based interface for controlling Philips Hue lights. 

## Recent Enhancements
### HSVRotationNode
- **Retention of Original Features**: Continued support for speed, throttle, brightness, hue range, bounce, hue shift, and saturation controls.
- **New Output Capabilities**: Includes `hueStart` and `hueEnd` values in its output.
- **Saturation Control**: Added a saturation slider.

### OffsetValueNode
- **Dynamic Range Fetching**: Fetches `hueStart` and `hueEnd` values from HSVRotationNode.
- **Wrap-Around Logic**: Ensures hue offset stays within defined boundaries.

### Null Node (Pass-Through Node)
- **Purpose**: Acts as an anchor point for easier graph management.

## Issue Resolutions
- **Console Logging Management**: Reduced unnecessary logs.
- **Geolocation Fetching**: Fixed issues in SunriseSunsetNode.
- **Final On and Off Time Calculation**: Corrected trigger time updates.

## Next Steps
- Further Testing
- Documentation
- UI Refinements







Home Automation with LightGraph UI Overview
This project provides a web-based interface using the LightGraph UI to control Philips Hue lights. The application allows users to interact with their Hue Bridge and connected lights through an intuitive, node-based graphical interface.

Getting Started
Prerequisites
Philips Hue Bridge: Ensure you have a Hue Bridge connected to your local network.
Hue Bridge IP Address: You will need the IP address of your Hue Bridge. You can usually find this in your router’s settings or through the Philips Hue mobile app.
Web Browser: This application is web-based, so you'll need a modern web browser (e.g., Chrome, Firefox, Edge).
Setup
Clone the Repository:

Duplicate the directory structure of this repository to your local machine. You can do this by cloning the repository:

bash
Copy code
git clone https://github.com/gregtee2/homeauto.git
Navigate into the project directory:

bash
Copy code
cd homeauto
Starting the Server:

Use the start_servers.bat batch file included in the repository to start the necessary servers. Simply double-click the start_servers.bat file from your file explorer, or run it from the command line:

bash
Copy code
./start_servers.bat
This will set up the local servers required to run the web application.

Accessing the Application:

Once the servers are running, open your web browser and navigate to:

arduino
Copy code
http://localhost:8081/
You should see the LightGraph UI interface load up.

Configuring the Hue Bridge
Hue Bridge IP Address:
When you first launch the application, press the "Fetch Globals" button in the interface. This will prompt you to enter your Hue Bridge IP address. Enter the IP address you identified earlier.

Obtaining the API Key:
After entering the IP address, the application will guide you to press the button on your Hue Bridge. Once you have pressed the button, click the "Fetch API Key" button in the interface. You will have 30 seconds once you've pushed Hue Bridge top button to then press the UI button again. The application will automatically retrieve and store the API key needed to control the lights.

Using LightGraph UI
Node-based Interface: The application uses a node-based graphical interface where you can drag and drop nodes to create workflows for controlling your lights.
Use the Hue Light Node to connect and control individual lights. The node will present a dropdown menu to select from the available lights on your bridge.
You can link different nodes to create custom automation flows, such as turning on lights with specific colors or brightness levels.
Troubleshooting
Connection Issues: Ensure that your Hue Bridge is on the same local network as your computer.
Fetching API Key: If the API key retrieval fails, double-check that you’ve entered the correct IP address and that you pressed the button on the Hue Bridge as instructed.
Light Control: If lights aren’t responding, ensure the node configurations (IP, API key, light ID) are correct and that the server is running.
Contributing
Contributions are welcome! If you have suggestions, improvements, or find issues, feel free to create a pull request or raise an issue on the repository.

This version clarifies the necessary steps to take before entering the IP address and should provide clear guidance to users on how to get started with your project.
