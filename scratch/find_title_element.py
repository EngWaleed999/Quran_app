import xml.etree.ElementTree as ET

for page in ['001', '002']:
    with open(f'quran_svg_1/svg/{page}.svg', 'r', encoding='utf-8') as f:
        content = f.read()
    root = ET.fromstring(content)
    print(f"=== Page {page} ===")
    for elem in root.iter():
        transform = elem.attrib.get('transform', '')
        if 'translate(197.29 406.52)' in transform or 'translate(191.3 407.03)' in transform:
            print(f"Found matching element: tag={elem.tag}, attrib={elem.attrib}")
            print(f"Parent info: {elem.attrib}")
