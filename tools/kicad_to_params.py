# SPDX-License-Identifier: Apache-2.0
#
# Generates model/params/keyboard.json and model/params/board.json from the KiCad part
# lists in research/data/ (made by research/tools/kicad_parts.py from RetroStack's boards)
# and the placements in model/params/machine.json:
#   pnpm params            (python3 -I tools/kicad_to_params.py)
# The outputs are generated: never edit them by hand; change this script or the inputs.
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, 'research', 'data')
PARAMS = os.path.join(ROOT, 'model', 'params')

machine = json.load(open(os.path.join(PARAMS, 'machine.json')))
kbd = json.load(open(os.path.join(DATA, 'kicad_keyboard_alps_e1_parts.json')))
board = json.load(open(os.path.join(DATA, 'kicad_mainboard_rev_g_parts.json')))

# The keyboard matrix (research/how-it-worked.md, section 4; rs-info keyboard):
# rows are selected by A0-A7, bits come back on D0-D7.
MATRIX_ROWS = [
    ['@', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
    ['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'],
    ['X', 'Y', 'Z'],
    ['0', '1', '2', '3', '4', '5', '6', '7'],
    ['8', '9', ':', ';', ',', '-', '.', '/'],
    ['ENTER', 'CLEAR', 'BREAK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE'],
    ['SHIFT'],
]
MATRIX = {name: (r, b) for r, row in enumerate(MATRIX_ROWS) for b, name in enumerate(row)}
MATRIX['LSHIFT'] = MATRIX['RSHIFT'] = MATRIX['SHIFT']  # both SHIFT keys are one switch

# What SHIFT gives on the number and punctuation keys, from the ROM's XOR 10h
# (rs-info keyboard, "The map the ROM computes"). The keycap legends must still be
# checked against photos (open item O4).
SHIFTED = {'1': '!', '2': '"', '3': '#', '4': '$', '5': '%', '6': '&', '7': "'", '8': '(',
           '9': ')', ':': '*', ';': '+', ',': '<', '-': '=', '.': '>', '/': '?'}
LEGEND = {'UP': '↑', 'DOWN': '↓', 'LEFT': '←', 'RIGHT': '→', 'SPACE': '',
          'LSHIFT': 'SHIFT', 'RSHIFT': 'SHIFT'}
# Key widths in units of the pitch: estimates, to be checked against photos (open item O4).
WIDTH_U = {'LSHIFT': 1.75, 'RSHIFT': 1.5, 'ENTER': 2.0, 'SPACE': 7.3}  # ENTER: refitted below
NODE = {'@': 'at', ':': 'colon', ';': 'semicolon', ',': 'comma', '-': 'minus', '.': 'period',
        '/': 'slash'}


def v(entry):
    return entry['v']


kp = machine['keyboard_pcb']
ox, oy = v(kp['origin_x']), v(kp['origin_y'])
keys = []
for p in sorted((p for p in kbd['parts'] if p['ref'].startswith('SW')), key=lambda p: int(p['ref'][2:])):
    name = p['value']
    n = int(p['ref'][2:])
    keypad = n >= 54
    row, bit = MATRIX[name]
    ident = NODE.get(name, name.lower())
    keys.append({
        'node': ('key.pad.' if keypad else 'key.') + ident,
        'ref': p['ref'],
        'name': name,
        'legend': LEGEND.get(name, name),
        'shift_legend': '' if keypad else SHIFTED.get(name, ''),
        'keypad': keypad,
        'matrix_row': row,
        'matrix_bit': bit,
        'address': '%04X' % (0x3800 | (1 << row)),
        'x': round(ox + p['x'], 2),
        'y': round(oy - p['y'], 2),
        'width_u': 1.0 if keypad else WIDTH_U.get(name, 1.0),
    })

assert len(keys) == 65, len(keys)

# Keycaps. Each cap sits on its visual row; a wide key's cap is offset from its switch
# (stabilised keys), and ENTER fills the gap between its neighbours. The ENTER and right
# SHIFT switches sit about 5 mm off their rows on the board, so caps centred on them would
# overlap the keys around them. Widths of the wide keys are estimates (open item O4).
CAP = v(kp['keycap_size_1u'])[0]
PITCH = v(kp['key_pitch'])
GAP = PITCH - CAP
MAIN_ROWS_Y = sorted({round(oy - p['y'], 2) for p in kbd['parts'] if p['ref'].startswith('SW')
                      and 1 <= int(p['ref'][2:]) <= 53 and p['value'] not in ('ENTER', 'LSHIFT', 'RSHIFT')})
by_name = {k['name'] + ('pad' if k['keypad'] else ''): k for k in keys}
for k in keys:
    w = CAP + (k['width_u'] - 1) * PITCH
    cx, cy = k['x'], k['y']
    if not k['keypad']:
        cy = min(MAIN_ROWS_Y, key=lambda r: abs(r - k['y']))
    k['cap'] = {'x': round(cx, 2), 'y': round(cy, 2), 'w': round(w, 2), 'd': CAP}
# ENTER spans from ';' to CLEAR; LSHIFT ends a gap before Z; RSHIFT starts a gap after '/'.
semi, clear = by_name[';']['cap'], by_name['CLEAR']['cap']
x0, x1 = semi['x'] + CAP / 2 + GAP, clear['x'] - CAP / 2 - GAP
by_name['ENTER']['cap'].update(x=round((x0 + x1) / 2, 2), w=round(x1 - x0, 2))
z = by_name['Z']['cap']
ls = by_name['LSHIFT']['cap']
x1 = z['x'] - CAP / 2 - GAP
ls.update(x=round(x1 - ls['w'] / 2, 2))
sl = by_name['/']['cap']
rs = by_name['RSHIFT']['cap']
x0 = sl['x'] + CAP / 2 + GAP
rs.update(x=round(x0 + rs['w'] / 2, 2))
for k in keys:
    k['width_u'] = round((k['cap']['w'] - CAP) / PITCH + 1, 2)
# no two caps may overlap
caps = [(k['node'], k['cap']) for k in keys]
for i, (na, a) in enumerate(caps):
    for nb, b in caps[i + 1:]:
        ox_ = min(a['x'] + a['w'] / 2, b['x'] + b['w'] / 2) - max(a['x'] - a['w'] / 2, b['x'] - b['w'] / 2)
        oy_ = min(a['y'] + a['d'] / 2, b['y'] + b['d'] / 2) - max(a['y'] - a['d'] / 2, b['y'] - b['d'] / 2)
        assert ox_ <= 0.01 or oy_ <= 0.01, ('caps overlap', na, nb)
assert len({k['node'] for k in keys}) == 65, 'node names must be unique'
assert len({k['node'].replace('.', '') for k in keys}) == 65, 'names must not collide without dots'

json.dump({
    '_generated': 'by tools/kicad_to_params.py from research/data/kicad_keyboard_alps_e1_parts.json and model/params/machine.json; do not edit',
    'frame': 'machine frame, mm; x, y are key centres; z from machine.json keyboard_pcb',
    'conf': 'model (positions, from rs-kicad ALPS E1, a 1:1 replica); est (widths); matrix from rs-info keyboard',
    'keys': keys,
}, open(os.path.join(PARAMS, 'keyboard.json'), 'w'), indent=1, ensure_ascii=False)

mb = machine['main_board']
bx, by = v(mb['origin_x']), v(mb['origin_y'])
labels = {k: s for k, s in mb['labelled_parts'].items() if k != 'src'}
for r in mb['video_ram_refs']:
    labels[r] = 'video RAM (2102)'
packages = mb['packages']
parts = []
for p in board['parts']:
    fp = p['footprint'].replace('TRS80_Model_I_', '')
    x0, y0, x1, y1 = p['body']
    # The board is mounted components down (machine.json main_board.mounting): seen from
    # above it is mirrored left to right, X = origin_x - x_kicad; Y = origin_y - y_kicad.
    bx0, bx1 = bx - x1, bx - x0
    by0, by1 = by - y1, by - y0
    width, height = packages.get(fp, [0, 3.0])
    if width:  # DIPs: the silkscreen box is narrower than the body; use the standard width
        if bx1 - bx0 < by1 - by0:
            cx = (bx0 + bx1) / 2
            bx0, bx1 = cx - width / 2, cx + width / 2
        else:
            cy = (by0 + by1) / 2
            by0, by1 = cy - width / 2, cy + width / 2
    parts.append({
        'ref': p['ref'], 'footprint': fp, 'value': p['value'],
        'x': round(bx - p['x'], 2), 'y': round(by - p['y'], 2),
        'body': [round(bx0, 2), round(by0, 2), round(bx1, 2), round(by1, 2)],
        'height': height,
        'label': labels.get(p['ref'], ''),
    })
json.dump({
    '_generated': 'by tools/kicad_to_params.py from research/data/kicad_mainboard_rev_g_parts.json and model/params/machine.json; do not edit',
    'frame': 'machine frame, mm; x, y are footprint origins, body the part\'s outline [x0, y0, x1, y1]; the board is mounted components down and mirrored (machine.json main_board.mounting), so each part hangs `height` mm below board_z',
    'conf': 'model (rs-kicad rev G); placement of the whole board est (machine.json main_board)',
    'outline': board['outline_mm'],
    'parts': parts,
}, open(os.path.join(PARAMS, 'board.json'), 'w'), indent=1, ensure_ascii=False)

print('keyboard.json: %d keys; board.json: %d parts' % (len(keys), len(parts)))
