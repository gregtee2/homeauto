import requests

try:
    response = requests.get('http://localhost:5000/api/lights')
    if response.status_code == 200:
        light_info = response.json()
        print("Fetched light data:", light_info)
    else:
        print(f"Failed to fetch lights. Status code: {response.status_code}")
except Exception as e:
    print(f"An error occurred: {e}")
