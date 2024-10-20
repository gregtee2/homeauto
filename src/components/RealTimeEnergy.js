// File: src/components/RealTimeEnergy.js

import React, { useEffect, useState } from 'react';

const RealTimeEnergy = () => {
    const [energyData, setEnergyData] = useState({});

    useEffect(() => {
        // Register state change listener
        const handleStateChange = (deviceId, newState) => {
            if (newState.power !== undefined && newState.total !== undefined) {
                setEnergyData(prevData => ({
                    ...prevData,
                    [deviceId]: newState
                }));
            }
        };

        window.KasaDeviceManager.onStateChange(handleStateChange);

        return () => {
            // Cleanup listener on unmount
            window.KasaDeviceManager.stateChangeCallbacks = window.KasaDeviceManager.stateChangeCallbacks.filter(cb => cb !== handleStateChange);
        };
    }, []);

    return (
        <div>
            <h2>Real-Time Energy Monitoring</h2>
            <ul>
                {Object.entries(energyData).map(([deviceId, data]) => (
                    <li key={deviceId}>
                        {deviceId}: {data.power} W / {data.total} Wh
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RealTimeEnergy;
