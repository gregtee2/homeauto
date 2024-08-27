from flask import Flask, request, jsonify
from flask_cors import CORS
from phue import Bridge
import os

app = Flask(__name__)
CORS(app)

# Philips Hue Bridge Setup
bridge_ip = os.getenv('BRIDGE_IP', None)  # Get IP from environment variable or use None
config_file_path = 'python_hue_config.json'  # Path to your config file

bridge = None

if bridge_ip:
    try:
        bridge = Bridge(bridge_ip, config_file_path=config_file_path)
        bridge.connect()
    except Exception as e:
        print(f"Could not connect to the Hue Bridge. Error: {e}")
        print("Please press the link button on your Hue Bridge and try again.")
else:
    print("No bridge IP provided. Set the BRIDGE_IP environment variable or fetch the IP using the UI.")

@app.route('/api/light/<int:light_id>/state', methods=['POST'])
def set_light_state(light_id):
    if not bridge:
        return jsonify(success=False, error="Hue Bridge is not initialized"), 500

    data = request.json
    state = data.get('on', None)
    brightness = data.get('bri', None)
    color = data.get('color', None)
    
    try:
        if state is not None:
            bridge.set_light(light_id, 'on', state)
        
        if brightness is not None:
            bridge.set_light(light_id, 'bri', int(brightness * 254 / 100))
        
        if color is not None:
            bridge.set_light(light_id, 'hue', int(color['h'] * 65535 / 360))
            bridge.set_light(light_id, 'sat', int(color['s'] * 254))
        
        return jsonify(success=True)
    except Exception as e:
        print(f"Error setting light state: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/api/lights', methods=['GET'])
def get_lights():
    if not bridge:
        return jsonify(success=False, error="Hue Bridge is not initialized"), 500

    try:
        lights = bridge.get_light_objects('name')
        light_info = {
            name: {
                "id": light.light_id,
                "state": light.on
            }
            for name, light in lights.items()
        }
        return jsonify(light_info)
    except Exception as e:
        print(f"Error fetching lights: {e}")
        return jsonify(success=False, error=str(e)), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
