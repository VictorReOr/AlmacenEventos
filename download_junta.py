import urllib.request
import re

url = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Logotipo_de_la_Junta_de_Andaluc%C3%ADa_2020.svg'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    svg_data = response.read().decode('utf-8')

# Let's save the raw SVG for inspection
with open('public/junta_logo_raw.svg', 'w', encoding='utf-8') as f:
    f.write(svg_data)
print("Saved raw SVG.")
