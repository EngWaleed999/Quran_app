import os
import re

svg_dir = 'quran_svg_1/svg'
unboxed_titles = []

for p in range(1, 605):
    fname = f'{p:03d}.svg'
    path = os.path.join(svg_dir, fname)
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        svg = f.read()
    
    # Check if viewBox is -53.3 -198.5 345 550 or similar
    vb = re.search(r'viewBox="([^"]+)"', svg)
    vb_val = vb.group(1) if vb else ''
    
    # Look for paths with transforms having large Y like 400+
    large_y_transforms = re.findall(r'transform="translate\([^)]+?\s(4\d\d[^\)]*)\)"', svg)
    if large_y_transforms or p in [1, 2]:
        unboxed_titles.append((p, vb_val, large_y_transforms))

print(f"Pages with Y >= 400 transforms: {len(unboxed_titles)}")
for p, vb_val, tr in unboxed_titles:
    print(f"Page {p}: viewBox='{vb_val}', transforms={tr}")
