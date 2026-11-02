"""Accept self-contained vector logo artwork without changing its pixels/paths."""
import json, math, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

def inspect(file):
    raw = Path(file).read_bytes()
    if len(raw) > 1500000:
        return {'valid': False, 'reason': 'size'}
    text = raw.decode('utf-8-sig')
    if re.search(r'<!DOCTYPE|<!ENTITY|<\?xml-stylesheet', text, re.I):
        return {'valid': False, 'reason': 'external-declaration'}
    root = ET.fromstring(text)
    allowed = {'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'use', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc', 'metadata'}
    shapes = 0
    for element in root.iter():
        name = element.tag.rsplit('}', 1)[-1]
        if name not in allowed:
            return {'valid': False, 'reason': 'non-vector-or-unsupported-element'}
        if name in {'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'}:
            shapes += 1
        for key, value in element.attrib.items():
            key = key.rsplit('}', 1)[-1].lower()
            if key.startswith('on') or (key in {'href', 'src'} and not re.fullmatch(r'#[\w.:-]+', value)):
                return {'valid': False, 'reason': 'active-or-external-reference'}
            if re.search(r'javascript:|@import|expression\s*\(', value, re.I):
                return {'valid': False, 'reason': 'active-style'}
            stripped = re.sub(r'url\(\s*([\'"]?)(#[\w.:-]+)\1\s*\)', '', value, flags=re.I)
            if re.search(r'url\s*\(', stripped, re.I):
                return {'valid': False, 'reason': 'external-style-reference'}
    if root.tag.rsplit('}', 1)[-1] != 'svg' or not shapes or shapes > 20000:
        return {'valid': False, 'reason': 'no-vector-shapes'}
    box = [float(v) for v in re.split(r'[\s,]+', root.attrib.get('viewBox', '').strip())]
    if len(box) != 4 or not all(math.isfinite(v) for v in box) or not (0 < box[2] <= 100000 and 0 < box[3] <= 100000):
        return {'valid': False, 'reason': 'invalid-viewbox'}
    return {'valid': True, 'vectorShapes': shapes, 'width': box[2], 'height': box[3], 'embeddedBitmaps': False, 'externalReferences': False}

try:
    print(json.dumps(inspect(sys.argv[1])))
except Exception:
    print(json.dumps({'valid': False, 'reason': 'unreadable-svg'}))
