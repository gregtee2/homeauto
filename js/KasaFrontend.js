// KasaFrontend.js

class KasaFrontend {
    constructor() {
        this.initTabs();
        this.registerStateChangeListener();

        // Wait for SmartPlugDeviceManager to be ready before populating devices
        if (window.SmartPlugDeviceManager && typeof window.SmartPlugDeviceManager.onReady === 'function') {
            window.SmartPlugDeviceManager.onReady(() => {
                console.log("KasaFrontend - SmartPlugDeviceManager is ready. Populating devices.");
                this.populateDevices();
            });
        } else {
            console.error("KasaFrontend - SmartPlugDeviceManager is not available.");
        }
    }

    /**
     * Initializes tab functionality for device categorization.
     */
    initTabs() {
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                // Add active class to selected tab and corresponding content
                tab.classList.add('active');
                const activeContent = document.getElementById(tab.getAttribute('data-tab'));
                activeContent.classList.add('active');
            });
        });
    }

    /**
     * Populates the UI with devices.
     */
    async populateDevices() {
        try {
            const devices = await window.KasaDeviceManager.fetchDevices();

            // Separate lights and smart plugs
            const lights = devices.filter(device => device.type === 'bulb');
            const smartPlugs = devices.filter(device => device.type === 'plug');

            // Populate All Devices
            this.populateSection('all', devices, 'all');

            // Populate Lights
            this.populateSection('lights', lights, 'light');

            // Populate Smart Plugs
            this.populateSection('smartplugs', smartPlugs, 'smartplug');

        } catch (error) {
            console.error('KasaFrontend - Error populating devices:', error);
        }
    }

    /**
     * Populates a specific section with devices.
     * @param {string} sectionId - The ID of the section to populate.
     * @param {Array} devices - Array of device objects.
     * @param {string} deviceType - Type of device ('all', 'light', or 'smartplug').
     */
    populateSection(sectionId, devices, deviceType) {
        const section = document.getElementById(sectionId);
        if (!section) {
            console.error(`KasaFrontend - Section with id '${sectionId}' not found in the DOM.`);
            return;
        }
        section.innerHTML = ''; // Clear existing content

        devices.forEach(device => {
            const deviceCard = document.createElement('div');
            deviceCard.classList.add('device');

            const deviceTitle = document.createElement('h3');
            deviceTitle.textContent = device.alias;
            deviceCard.appendChild(deviceTitle);

            // Power On Button
            const powerOnBtn = document.createElement('button');
            powerOnBtn.textContent = 'Turn On';
            powerOnBtn.addEventListener('click', () => this.turnOnDevice(device.deviceId));
            deviceCard.appendChild(powerOnBtn);

            // Power Off Button
            const powerOffBtn = document.createElement('button');
            powerOffBtn.textContent = 'Turn Off';
            powerOffBtn.addEventListener('click', () => this.turnOffDevice(device.deviceId));
            deviceCard.appendChild(powerOffBtn);

            if (deviceType === 'light' || device.type === 'bulb') {
                // Set Color Button
                const setColorBtn = document.createElement('button');
                setColorBtn.textContent = 'Set Color';
                setColorBtn.addEventListener('click', () => this.setColorDevice(device.deviceId));
                deviceCard.appendChild(setColorBtn);
            }

            // Energy Usage for Smart Plugs
            if (deviceType === 'smartplug' || device.type === 'plug') {
                // Get Energy Usage Button
                const getEnergyBtn = document.createElement('button');
                getEnergyBtn.textContent = 'Get Energy Usage';
                getEnergyBtn.addEventListener('click', () => this.getEnergyUsage(device.deviceId));
                deviceCard.appendChild(getEnergyBtn);

                // Display Energy Usage Data
                const energyDataDiv = document.createElement('div');
                energyDataDiv.id = `energy-${device.deviceId}`;
                energyDataDiv.style.marginTop = '10px';
                energyDataDiv.style.display = 'none'; // Hidden by default
                energyDataDiv.innerHTML = `
                    <p><strong>Energy Usage:</strong></p>
                    <p>Current: <span id="current-${device.deviceId}">-</span> mA</p>
                    <p>Voltage: <span id="voltage-${device.deviceId}">-</span> V</p>
                    <p>Power: <span id="power-${device.deviceId}">-</span> W</p>
                    <p>Total: <span id="total-${device.deviceId}">-</span> Wh</p>
                `;
                deviceCard.appendChild(energyDataDiv);
            }

            section.appendChild(deviceCard);
        });
    }

    /**
     * Turns on a device.
     * @param {string} deviceId - The ID of the device.
     */
    async turnOnDevice(deviceId) {
        try {
            await window.KasaDeviceManager.turnOn(deviceId);
            alert(`Device turned on successfully.`);
        } catch (error) {
            console.error(`KasaFrontend - Error turning on device ${deviceId}:`, error);
            alert(`Failed to turn on device.`);
        }
    }

    /**
     * Turns off a device.
     * @param {string} deviceId - The ID of the device.
     */
    async turnOffDevice(deviceId) {
        try {
            await window.KasaDeviceManager.turnOff(deviceId);
            alert(`Device turned off successfully.`);
        } catch (error) {
            console.error(`KasaFrontend - Error turning off device ${deviceId}:`, error);
            alert(`Failed to turn off device.`);
        }
    }

    /**
     * Sets the color of a light device.
     * @param {string} deviceId - The ID of the light device.
     */
    async setColorDevice(deviceId) {
        try {
            const hue = prompt("Enter Hue (0-360):", "240");
            const saturation = prompt("Enter Saturation (0-100):", "100");
            const brightness = prompt("Enter Brightness (0-100):", "100");

            const hsv = {
                hue: parseInt(hue),
                saturation: parseInt(saturation),
                brightness: parseInt(brightness)
            };

            // Validate inputs
            if (
                isNaN(hue) || hue < 0 || hue > 360 ||
                isNaN(saturation) || saturation < 0 || saturation > 100 ||
                isNaN(brightness) || brightness < 0 || brightness > 100
            ) {
                alert("Invalid HSV values entered.");
                return;
            }

            await window.KasaDeviceManager.setLightColor(deviceId, hsv);
            alert("Light color set successfully.");
        } catch (error) {
            console.error("KasaFrontend - Error setting light color:", error);
            alert("Failed to set light color.");
        }
    }

    /**
     * Retrieves and displays energy usage for a smart plug.
     * @param {string} deviceId - The ID of the smart plug.
     */
    async getEnergyUsage(deviceId) {
        try {
            const energyData = await window.KasaDeviceManager.getSmartPlugEnergy(deviceId);
            // Update the energy data display
            document.getElementById(`current-${deviceId}`).textContent = energyData.current_ma;
            document.getElementById(`voltage-${deviceId}`).textContent = (energyData.voltage_mv / 1000).toFixed(2);
            document.getElementById(`power-${deviceId}`).textContent = (energyData.power_mw / 1000).toFixed(2);
            document.getElementById(`total-${deviceId}`).textContent = energyData.total_wh;

            // Show the energy data div
            document.getElementById(`energy-${deviceId}`).style.display = 'block';
        } catch (error) {
            console.error("KasaFrontend - Error fetching energy usage:", error);
            if (error.response && error.response.status === 404) {
                console.warn(`KasaFrontend - State endpoint for device ${deviceId} not found.`);
                alert(`State information for device ${deviceId} is unavailable.`);
            } else {
                alert("Failed to fetch energy usage.");
            }
        }
    }


    /**
     * Registers a callback to handle state changes.
     */
    registerStateChangeListener() {
        window.KasaDeviceManager.onStateChange((deviceId, newState) => {
            // Check if the device is a smart plug
            const smartPlug = window.KasaDeviceManager.getSmartPlug(deviceId);
            if (smartPlug && newState) {
                // Update energy usage data display if energy data is present
                if (newState.current_ma !== undefined && newState.voltage_mv !== undefined && newState.power_mw !== undefined && newState.total_wh !== undefined) {
                    const currentEl = document.getElementById(`current-${deviceId}`);
                    const voltageEl = document.getElementById(`voltage-${deviceId}`);
                    const powerEl = document.getElementById(`power-${deviceId}`);
                    const totalEl = document.getElementById(`total-${deviceId}`);
                    const energyDiv = document.getElementById(`energy-${deviceId}`);

                    if (currentEl && voltageEl && powerEl && totalEl && energyDiv) {
                        currentEl.textContent = newState.current_ma;
                        voltageEl.textContent = (newState.voltage_mv / 1000).toFixed(2);
                        powerEl.textContent = (newState.power_mw / 1000).toFixed(2);
                        totalEl.textContent = newState.total_wh;

                        // Ensure the energy data div is visible
                        energyDiv.style.display = 'block';
                    } else {
                        console.warn(`KasaFrontend - Energy data elements not found for device ${deviceId}.`);
                    }
                }
            }
        });
    }
}

// Initialize the frontend controls
document.addEventListener('DOMContentLoaded', () => {
    new KasaFrontend();
    console.log("KasaFrontend - Initialized.");
});
