
import base64
import os

html_path = '/Users/apple/Desktop/goat app/assets/images/download-play-assets.html'
logo_path = '/Users/apple/Desktop/goat app/assets/images/applogo.png'

with open(logo_path, 'rb') as f:
    logo_data = base64.b64encode(f.read()).decode('utf-8')

with open(html_path, 'r') as f:
    html_content = f.read()

# Replace the src with the base64 data
new_content = html_content.replace("logo.src = 'applogo.png';", f"logo.src = 'data:image/png;base64,{logo_data}';")

with open(html_path, 'w') as f:
    f.write(new_content)

print("Successfully inlined logo as base64.")
