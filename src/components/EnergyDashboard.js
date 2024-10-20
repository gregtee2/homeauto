// File: src/components/EnergyDashboard.js

import React, { useEffect, useState } from 'react';

const EnergyDashboard = () => {
    const [plugs, setPlugs] = useState([]);

    useEffect(() => {
        // Fetch all smart plugs on component mount
        fetch('http://localhost:3000/api/kasa/smartplugs')
            .then(response => response.json())
            .then(data => setPlugs(data))
            .catch(error => console.error('Error fetching smart plugs:', error));
    }, []);

    return (
        <div>
            <h2>Smart Plugs Energy Consumption</h2>
            <table>
                <thead>
                    <tr>
                        <th>Plug Name</th>
                        <th>Power Consumption (W)</th>
                        <th>Total Energy (Wh)</th>
                    </tr>
                </thead>
                <tbody>
                    {plugs.map(plug => (
                        <tr key={plug.deviceId}>
                            <td>{plug.alias || plug.host}</td>
                            <td>{plug.energy?.power || 'N/A'}</td>
                            <td>{plug.energy?.total || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default EnergyDashboard;
