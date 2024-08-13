from flask import Flask, request, jsonify
from flask_cors import CORS
from phue import Bridge

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Philips Hue Bridge Setup
bridge_ip = '192.168.1.39'  # Your Philips Hue Bridge IP
config_file_path = 'python_hue_config.json'  # Path to your config file

# Initialize the bridge first
try:
    bridge = Bridge(bridge_ip, config_file_path=config_file_path)
    bridge.connect()
except Exception as e:
    print(f"Could not connect to the Hue Bridge. Error: {e}")
    print("Please press the link button on your Hue Bridge and try again.")

@app.route('/api/light/<int:light_id>/state', methods=['POST'])
def set_light_state(light_id):
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

@app.route('/api/saveGraph', methods=['POST'])
def save_graph():
    graph_data = request.json.get('graph')
    filename = request.json.get('filename', 'graph_data.json')
    try:
        with open(f'{filename}.json', 'w') as f:
            f.write(graph_data)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e))

@app.route('/api/loadGraph', methods=['GET'])
def load_graph():
    try:
        with open('graph_data.json', 'r') as f:
            graph_data = f.read()
        return jsonify(graph=graph_data)
    except Exception as e:
        return jsonify(success=False, error=str(e))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
