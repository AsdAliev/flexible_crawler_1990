import requests
import json
import os


url = "http://127.0.0.1:8000/start_crawler"

with open(os.path.join(os.path.dirname(__file__), "request.json"), "r") as f:
    data = json.load(f)

response = requests.post(url, json=data)
print(response.json())
