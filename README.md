Refer to InstallationReadMe.txt for instructions on install and initial setup.

# What's new? 9/20/24

## Git Push Summary: Event Bus Architecture, Device Bus Node, and HSV Node with Color Swatch Pickers
Since the last Git push, we have introduced significant improvements to the system’s architecture and features. This summary focuses on the Event Bus architecture, the Device Bus Node, and the new HSV Node with color swatch pickers.

# 1. Event Bus Architecture Implementation
The system now fully embraces an event-driven architecture with the Event Bus serving as the communication hub between nodes. This shift greatly enhances scalability, modularity, and flexibility.

# A. Event Bus Overview:
Event-Driven Workflow: Events are now propagated through the Event Bus, which distributes them to relevant nodes, decoupling components and improving modularity.
Decoupling: Components no longer need direct connections. Instead, they communicate via the Event Bus, making the system more adaptable and easier to extend.
# B. New Nodes Supporting Event Bus:
EventBusHandlerNode:

# Role: Listens for and routes events published on the Event Bus, ensuring commands reach the correct devices.
Functionality: Processes event types and forwards them to downstream nodes, such as the ExecuteNode.
Trigger Node (Time-Based and Manual Triggers):

# Role: Triggers time-based or manual events (e.g., sunset, 10 PM) and publishes them to the Event Bus.
Device Integration: Allows users to attach devices or groups to triggers, which are sent through the Event Bus to control the devices.
ExecuteEventNode:

# Role: Receives commands from the Event Bus and sends the appropriate API requests to devices (Hue, Govee, etc.).
Enhancements: Now efficiently processes event-driven commands, ensuring precise execution based on trigger conditions.
# 2. Device Bus Node Enhancements
The Device Bus Node has been optimized to improve device management and trigger integration. It plays a central role in aggregating device data and attaching it to various triggers.

# A. Device Aggregation and Management:
Purpose: The Device Bus Node gathers device data (such as Hue and Govee lights) and prepares it for event-based control.
Trigger Integration: Attaches triggers (manual or time-based) to devices, simplifying the process of controlling multiple devices simultaneously.
Enhanced Data Handling: Improved validation of device data and handling of multiple devices in a single flow.
# B. Event Publishing:
Once devices are attached to the triggers, the Device Bus Node sends events to the Event Bus, which manages routing to the ExecuteEventNode for action.
# 3. HSV Node with Color Swatch Pickers
The new HSV Node significantly enhances user control over lighting configurations, with a focus on color selection and adjustment.

# A. HSV Control Node:
Purpose: Provides control over hue, saturation, and brightness for smart lighting systems.
Color Swatch Picker: Users can interactively choose colors via a swatch picker, improving ease of use and accuracy for color adjustments.
# B. Real-Time Visual Feedback:
The HSV Node provides real-time color feedback via the swatch picker on the node itself, allowing users to see their color choices immediately.
Color Transformation: The node converts the selected color into HSV or RGB format, depending on the device, and passes it to the Event Bus for execution.
# 4. Key Benefits of the Event Bus, Device Bus Node, and HSV Node:
Scalability: The Event Bus and Device Bus Node architecture enable seamless addition of new devices and triggers.
Modularity: Nodes are designed to operate independently, making future updates and maintenance easier.
Enhanced User Experience: The HSV Node’s color swatch picker and real-time feedback simplify user interaction with lighting control.
Efficient Event Routing: The Event Bus ensures commands and events are handled efficiently across multiple devices and triggers.
Next Steps:
Further Testing: Additional testing of the Event Bus system and Device Bus Node with complex event scenarios.
Documentation: Update the system documentation to reflect the new Event Bus architecture and Device Bus Node functionality.
Expand Device Support: Continue working on device integration, such as additional smart lights and other IoT devices.




# What's new? 9/09/24

Project Overview:
The Hue Light Control System Using LiteGraph.js continues to evolve with several key updates. Recent work has focused on enhancing the functionality of various nodes and improving user experience, interface layout, and integration with Philips Hue lights.

## Key Accomplishments:
1. ## Custom Color Node:
The Custom Color Node was thoroughly refined to handle color transformations accurately, ensuring compatibility with downstream nodes. The node is now capable of generating precise RGB outputs based on user input and ensures that the changes propagate correctly to the Hue Light Node.
Adjustments were made to ensure seamless operation with the brightness and color temperature controls, preventing unexpected behavior during color transformations.

2. # Hue Light LUT Node:
The Hue Light LUT Node was developed and integrated. It uses a custom lookup table (LUT) for color transformations, applying predefined values to adjust the RGB output for more accurate control of Hue lights.
This node works by taking HSV input, converting it to RGB, applying the LUT for fine-tuning, and then sending the final adjusted output back in HSV format for further use in the system.

3. # UI Enhancements:
We redesigned the main user interface (UI) to streamline the button layout. The position of controls such as Load/Save Graph, Fetch Globals, and Light Controls were optimized for ease of use.
Unnecessary buttons like Main Event were removed, and the layout now ensures better organization and user flow.
The top-level button structure was revised to ensure that crucial actions, like loading and saving graphs, are easily accessible.

4. # Hue Light Node Plus:
Enhancements were made to the Hue Light Node Plus, where we integrated color and brightness controls more effectively. This node now handles manual and automatic state toggling, ensuring that changes are reflected in the Hue lights without introducing errors.
Integration of the LUT functionality into the Hue Light Node was planned but ultimately managed separately for flexibility and modularity.

5. # Light Control System Updates:
Work was done to ensure all nodes (like the Custom Multiplier, Execute Nodes, Pushbutton Node, and Trigger Bus Node) operate correctly within the overall system.
Several improvements were made to Govee Light Integration, with a focus on expanding light control beyond just the Philips Hue ecosystem, allowing for greater flexibility in automation.

6. # Refactoring and Node Organization:
Node classification was improved by reorganizing them into appropriate directories, such as Lighting, Timers, Utility, and Execution. This ensures a cleaner, more structured development environment and easier navigation for future expansion.
Specific nodes such as Offset Value Node and Merge Light Node were also refined for better performance and integration into more complex lighting workflows.
Current Focus:
Further testing and refinement of the Custom Color Node to ensure precise control across a wide range of scenarios.
Ongoing integration of LUT transformations to improve color accuracy when working with Philips Hue lights.
Optimizing UI responsiveness and functionality as the system scales.
Documentation updates to reflect new node structures, workflows, and features for easier onboarding of future developers.
This phase of the project has enhanced the stability, usability, and extendability of the Hue Light Control System, setting the stage for future expansions and integrations.








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
