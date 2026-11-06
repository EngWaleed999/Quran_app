import xml.etree.ElementTree as ET

with open('quran_svg_1/svg/003.svg', 'r', encoding='utf-8') as f:
    content = f.read()

root = ET.fromstring(content)
for elem in root.iter():
    tr = elem.attrib.get('transform', '')
    if any(y in tr for y in ['406', '434']):
        print(f"Tag: {elem.tag}, attribs: {elem.attrib}")
        d = elem.attrib.get('d', '')
        print(f"  d start: {d[:60]}, len={len(d)}")
