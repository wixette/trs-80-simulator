# SPDX-License-Identifier: Apache-2.0
# Lists the footprints of a KiCad 6+ board: reference, footprint, value, position,
# rotation, pad count and body rectangle (from the footprint's F.Fab outline, else
# F.SilkS, else F.CrtYd, else its pads), plus the board outline (Edge.Cuts), as JSON.
# Usage: python3 -I kicad_parts.py board.kicad_pcb > parts.json
# Positions are KiCad's (mm, +Y down), relative to the outline's top-left corner.
import json, re, sys
t = open(sys.argv[1], encoding='utf-8').read()

def blocks(text, head):
    """Yield the balanced s-expression blocks that start with '(' + head."""
    i = 0
    while True:
        i = text.find('(' + head, i)
        if i < 0:
            return
        depth = 0
        for j in range(i, len(text)):
            c = text[j]
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    yield text[i:j + 1]
                    i = j + 1
                    break

xs, ys = [], []
for kind in ('gr_line', 'gr_arc', 'gr_rect', 'gr_poly', 'gr_circle'):
    for b in blocks(t, kind):
        if b[len(kind) + 1] not in ' \n\t\r':
            continue  # a longer name such as gr_line_x
        if '"Edge.Cuts"' in b:
            for x, y in re.findall(r'\((?:start|end|mid|xy|center) ([-\d.]+) ([-\d.]+)\)', b):
                xs.append(float(x)); ys.append(float(y))
ox, oy = min(xs), min(ys)
import math


def body_box(b, fx, fy, rot):
    """The footprint's body rectangle in board coordinates (min x, min y, max x, max y)."""
    shapes = {}
    for kind in ('fp_rect', 'fp_line', 'fp_circle', 'fp_arc', 'fp_poly'):
        for s in blocks(b, kind):
            if s[len(kind) + 1] not in ' \n\t\r':
                continue
            layer = re.search(r'\(layer "([^"]+)"', s)
            if not layer:
                continue
            pts = [(float(x), float(y)) for x, y in re.findall(r'\((?:start|end|mid|xy) ([-\d.]+) ([-\d.]+)\)', s)]
            if kind == 'fp_circle':
                c = re.search(r'\(center ([-\d.]+) ([-\d.]+)\)', s)
                e = re.search(r'\(end ([-\d.]+) ([-\d.]+)\)', s)
                cx, cy, ex, ey = float(c.group(1)), float(c.group(2)), float(e.group(1)), float(e.group(2))
                r = math.hypot(ex - cx, ey - cy)
                pts = [(cx - r, cy - r), (cx + r, cy + r)]
            shapes.setdefault(layer.group(1), []).extend(pts)
    pads = [(float(x), float(y)) for x, y in re.findall(r'\(pad "[^"]*" \w+ \w+\s*\(at ([-\d.]+) ([-\d.]+)', b)]
    for layer in ('F.Fab', 'B.Fab', 'F.SilkS', 'B.SilkS', 'F.CrtYd', 'B.CrtYd'):
        if len(shapes.get(layer, [])) >= 2:
            pts = shapes[layer]
            break
    else:
        pts = pads or [(0.0, 0.0)]
    a = math.radians(rot)
    out = [(fx + x * math.cos(a) + y * math.sin(a), fy - x * math.sin(a) + y * math.cos(a)) for x, y in pts]
    xs = [p[0] for p in out]; ys = [p[1] for p in out]
    return [round(min(xs) - ox, 2), round(min(ys) - oy, 2), round(max(xs) - ox, 2), round(max(ys) - oy, 2)], len(pads)


parts = []
for b in blocks(t, 'footprint "'):
    name = re.match(r'\(footprint "([^"]+)"', b).group(1)
    at = re.search(r'\n\s*\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)', b)
    ref = re.search(r'\(property "Reference" "([^"]*)"', b) or re.search(r'\(fp_text reference "([^"]*)"', b)
    val = re.search(r'\(property "Value" "([^"]*)"', b) or re.search(r'\(fp_text value "([^"]*)"', b)
    layer = re.search(r'\(layer "([^"]+)"', b).group(1)
    parts.append({'ref': ref.group(1) if ref else '', 'footprint': name.split(':')[-1],
                  'value': val.group(1) if val else '', 'layer': layer,
                  'x': round(float(at.group(1)) - ox, 2), 'y': round(float(at.group(2)) - oy, 2),
                  'rot': float(at.group(3) or 0)})
    parts[-1]['body'], parts[-1]['pads'] = body_box(b, float(at.group(1)), float(at.group(2)), parts[-1]['rot'])
json.dump({'outline_mm': [round(max(xs) - ox, 2), round(max(ys) - oy, 2)], 'parts': parts}, sys.stdout, indent=0)
