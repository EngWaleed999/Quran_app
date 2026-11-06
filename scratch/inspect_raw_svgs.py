import os
import xml.etree.ElementTree as ET

for page_str in ['001', '002', '003', '050', '077', '604']:
    path = f'quran_svg_1/svg/{page_str}.svg'
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f"--- Page {page_str} ({len(content)} chars) ---")
    # Parse XML
    try:
        root = ET.fromstring(content)
        # print top level children
        print("Root tag:", root.tag, "attribs:", root.attrib)
        # count path and g elements
        paths = root.findall('.//{http://www.w3.org/2000/svg}path') or root.findall('.//path')
        groups = root.findall('.//{http://www.w3.org/2000/svg}g') or root.findall('.//g')
        print(f"Found {len(paths)} paths, {len(groups)} groups")
        # Check first 5 groups
        for idx, g in enumerate(groups[:5]):
            print(f"  Group {idx}: {g.attrib}")
    except Exception as e:
        print("XML error:", e)
