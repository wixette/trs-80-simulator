# SPDX-License-Identifier: Apache-2.0
"""The TRS-80 Model I keyboard unit, built from params (design/decisions.md, D8).

Builds, in the keyboard unit's frame (mm; origin at the centre of the case footprint on
its bottom face, +X right, +Y back, +Z up), under the empty `unit.keyboard`:
  case.bottom          the bottom half, with the feet, the DIN panel and the rear cut-outs   (static)
  case.top             the top half: rim, raised rear block, vents, the key-well opening      (path)
  keyboard             the keyboard assembly                                                  (path)
    board.keyboard       the keyboard PCB with its switches and chips
    keyboard.bezel       the black bezel with its key holes, frame and the name plate
    key.*, key.pad.*     the 65 keycaps                                                       (translate)
    led.power            the power LED
  board.main           the main board, upside down, with every part as a block               (path)
    part.<ref>           the parts the page names (CPU, ROMs, video RAM, character generator, ...)
  cable.ribbon         the keyboard's flat cable to J100                                      (static)
  button.power         the power switch's button in the DIN panel                            (toggle)

Run from the desk build (build_desk.py), or alone for previews.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

from lib import bl, params, shapes  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402
from lib.shapes import boolean, box_obj, prism_obj, rounded_rect  # noqa: E402

W2 = 212.0      # half width
D2 = 102.5      # half depth


def load_json(name):
    with open(os.path.join(params.MACHINE_DIR, "params", name), encoding="utf-8") as f:
        return json.load(f)


def fillet_polygon(corners, radii, step_deg=7.5):
    """A closed polygon [(Y, Z)] with each corner rounded by a tangent arc of its radius."""
    out = []
    n = len(corners)
    for i, (p, r) in enumerate(zip(corners, radii)):
        a, b = corners[i - 1], corners[(i + 1) % n]
        u1 = (a[0] - p[0], a[1] - p[1]); l1 = math.hypot(*u1); u1 = (u1[0] / l1, u1[1] / l1)
        u2 = (b[0] - p[0], b[1] - p[1]); l2 = math.hypot(*u2); u2 = (u2[0] / l2, u2[1] / l2)
        th = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1])))
        if r <= 0 or th > math.pi - 1e-6:
            out.append(p)
            continue
        t = r / math.tan(th / 2)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); lb = math.hypot(*bis); bis = (bis[0] / lb, bis[1] / lb)
        cdist = r / math.sin(th / 2)
        cx, cy = p[0] + bis[0] * cdist, p[1] + bis[1] * cdist
        t1 = (p[0] + u1[0] * t, p[1] + u1[1] * t)
        t2 = (p[0] + u2[0] * t, p[1] + u2[1] * t)
        a1 = math.atan2(t1[1] - cy, t1[0] - cx)
        a2 = math.atan2(t2[1] - cy, t2[0] - cx)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        k = max(2, int(abs(math.degrees(da)) / step_deg) + 1)
        for j in range(k + 1):
            ang = a1 + da * j / k
            out.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return out


def offset_polygon(pts, d):
    """Offset a closed polygon by d to the right of its direction (inward for the housing's
    profile, drawn front-bottom, up the front, over the top, down the rear), mitred."""
    n = len(pts)
    out = []
    for i in range(n):
        p, a, b = pts[i], pts[i - 1], pts[(i + 1) % n]
        e1 = (p[0] - a[0], p[1] - a[1]); l1 = math.hypot(*e1) or 1.0
        e2 = (b[0] - p[0], b[1] - p[1]); l2 = math.hypot(*e2) or 1.0
        n1 = (e1[1] / l1, -e1[0] / l1)
        n2 = (e2[1] / l2, -e2[0] / l2)
        m = (n1[0] + n2[0], n1[1] + n2[1])
        k = 1.0 + n1[0] * n2[0] + n1[1] * n2[1]
        out.append((p[0] + d * m[0] / k, p[1] + d * m[1] / k))
    return out


def build_case(p, col, root):
    c = p.raw["case"]
    hs = c["housing"]
    seam = c["seam_z"]["v"]
    wall = c["wall_thickness"]["v"]
    prof = fillet_polygon([tuple(q) for q in hs["corners"]["v"]], hs["radii"]["v"])
    xw = hs["wedge_side_x"]["v"]
    bt = hs["base_top"]["v"]
    pr, bd = hs["side_panel"]["proud"]["v"], hs["side_panel"]["border"]["v"]

    # --- one housing: the side profile across the wedge's width, the base's raised side
    # panels, hollowed, then cut (well, vents, rear openings, groove) and split at the seam
    case = prism_obj("_case", prof, "YZ", -xw, xw, "case_silver", col)
    panel_poly = offset_polygon(prof, bd)
    for x0, x1 in ((xw - 0.5, xw + pr), (-xw - pr, -xw + 0.5)):
        pn = prism_obj("_panel", panel_poly, "YZ", x0, x1, "case_silver", col)
        boolean(pn, box_obj("_ptop", -W2 - 5, -D2 - 5, bt - bd, W2 + 5, D2 + 5, 200, "case_silver", col))
        boolean(case, pn, "UNION")
    inner = prism_obj("_in", offset_polygon(prof, wall), "YZ", -xw + wall, xw - wall, "case_silver", col)
    boolean(case, inner)
    # the key well
    wo = c["well_opening"]
    (wx0, wx1), (wy0, wy1) = wo["x"]["v"], wo["y"]["v"]
    boolean(case, prism_obj("_well", rounded_rect(wx0, wy0, wx1, wy1, wo["corner_radius"]["v"]), "XY", 30, 140, "case_silver", col))
    # rear vents: each slot follows the surface from the base's top (y_top), over the
    # rounded rear edge and down the rear face to vz0, through the wall
    v = c["vents"]
    vx0, vx1 = v["x"]["v"]
    vz0 = v["z"]["v"][0]
    pitch, slot = v["pitch"]["v"], v["slot"]["v"]
    yt = v["y_top"]["v"]
    run = [(yt, bt)] + [q for q in prof if q[0] > yt + 0.5 and q[1] > vz0 + 0.5 and q[0] > 80.0] + [(D2, vz0)]
    band = shapes.offset_polyline(run, -1.5) + list(reversed(shapes.offset_polyline(run, wall + 1.0)))
    n = int((vx1 - vx0) / pitch) + 1
    cut = MeshBuilder()
    for i in range(n):
        x = vx0 + i * pitch
        cut.prism(band, "YZ", x - slot / 2, x + slot / 2, "case_silver")
    boolean(case, cut.build("_vents", col))
    xs = [vx0 + i * pitch for i in range(n)]
    shapes.recolour_faces(case, "plastic_black", lambda x, y, z: y > yt - 1.0 and z > vz0 - 1.0 and min(abs(x - xc) for xc in xs) <= slot / 2 + 0.05)
    rear_cuts(p, col, case)
    # the groove round the base's whole perimeter, at the seam
    gr = hs["groove"]
    gz, gw, gd = gr["z"]["v"], gr["width"]["v"], gr["depth"]["v"]
    ring = box_obj("_groove", -W2 - 5, -D2 - 5, gz - gw / 2, W2 + 5, D2 + 5, gz + gw / 2, "case_silver", col)
    boolean(ring, box_obj("_gi", -(xw + pr) + gd, -D2 + gd, gz - gw, (xw + pr) - gd, D2 - gd, gz + gw, "case_silver", col))
    boolean(case, ring)
    case.data.materials[0] = bl.material("case_silver")

    # --- the two halves, parted at the seam inside the groove
    top = case
    top.name = "case.top"
    top.data.name = "case.top"
    bot_mesh = case.data.copy()
    bot = bpy.data.objects.new("case.bottom", bot_mesh)
    col.objects.link(bot)
    boolean(top, box_obj("_lo", -W2 - 10, -D2 - 10, -10, W2 + 10, D2 + 10, seam, "case_silver", col))
    boolean(bot, box_obj("_hi", -W2 - 10, -D2 - 10, seam, W2 + 10, D2 + 10, 200, "case_silver", col))
    shapes.shade_auto(top)
    shapes.shade_auto(bot)
    bl.set_labels(top, "Case top: the upper half, with the key well, the sloped key surface, the ridge and the vents")
    bl.parent(top, root)
    mb = MeshBuilder()
    fw, fd, fh = c["feet"]["size"]
    for fx, fy in c["feet"]["v"]:
        mb.prism(rounded_rect(fx - fw / 2, fy - fd / 2, fx + fw / 2, fy + fd / 2, 4), "XY", -fh, 0.5, "rubber_black")
    feet = mb.build("case.feet", col)
    bl.set_labels(feet, "Rubber feet")
    bl.set_labels(bot, "Case bottom: the lower half, holding the main board")
    bl.parent(bot, root)
    bl.parent(feet, bot)
    return top, bot


def rear_cuts(p, col, obj):
    c = p.raw["case"]
    dr = c["din_recess"]
    (x0, x1), (z0, z1) = dr["x"]["v"], dr["z"]["v"]
    boolean(obj, box_obj("_din", x0, D2 - 8, z0, x1, D2 + 5, z1, "case_silver", col))
    eo = c["expansion_opening"]
    (x0, x1), (z0, z1) = eo["x"]["v"], eo["z"]["v"]
    boolean(obj, box_obj("_exp", x0, D2 - 12, z0, x1, D2 + 5, z1, "case_silver", col))


# --- the main board -------------------------------------------------------------------

def cyl(mb, cx, cy, cz, r, axis, length, mat, n=12):
    """A cylinder of radius r centred at (cx, cy, cz) along axis 'X', 'Y' or 'Z'."""
    circle = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    if axis == "Z":
        mb.prism([(cx + u, cy + w) for u, w in circle], "XY", cz - length / 2, cz + length / 2, mat)
    elif axis == "X":
        mb.prism([(cy + u, cz + w) for u, w in circle], "YZ", cx - length / 2, cx + length / 2, mat)
    else:
        mb.prism([(cx + u, cz + w) for u, w in circle], "XZ", cy - length / 2, cy + length / 2, mat)


def part_geometry(mb, part, z_board):
    """Add one board part, hanging below z_board (the component side faces down)."""
    fp = part["footprint"]
    x0, y0, x1, y1 = part["body"]
    h = part["height"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    lx, ly = x1 - x0, y1 - y0
    along_x = lx >= ly
    z_top = z_board
    if fp.startswith("DIP"):
        ceramic = "4116" in part["value"] or "2102" in part["value"]
        mat = "ic_ceramic" if ceramic else "ic_black"
        mb.prism(rounded_rect(x0, y0, x1, y1, 0.4, 2), "XY", z_top - h, z_top - 0.8, mat)
        # the two rows of legs
        if along_x:
            for yy in (y0 - 0.3, y1 + 0.3):
                mb.prism([(x0 + 0.6, yy - 0.25), (x1 - 0.6, yy - 0.25), (x1 - 0.6, yy + 0.25), (x0 + 0.6, yy + 0.25)], "XY", z_top - 3.0, z_top, "tin")
        else:
            for xx in (x0 - 0.3, x1 + 0.3):
                mb.prism([(xx - 0.25, y0 + 0.6), (xx + 0.25, y0 + 0.6), (xx + 0.25, y1 - 0.6), (xx - 0.25, y1 - 0.6)], "XY", z_top - 3.0, z_top, "tin")
    elif fp.startswith(("R_0", "R_2", "R_3", "D")) and not fp.startswith("D_Bridge") and not fp.startswith("DIN"):
        r = max(h / 2, 0.8)
        L = max(lx, ly) * 0.62
        mat = "ic_black" if fp == "D" else "resistor_tan"
        cyl(mb, cx, cy, z_top - r - 0.6, r, "X" if along_x else "Y", L, mat, 8)
    elif fp.startswith("C_Disc"):
        r = h / 2
        t = min(lx, ly) * 0.7
        cyl(mb, cx, cy, z_top - r - 1.0, r, "Y" if along_x else "X", t, "cap_disc", 12)
    elif fp.startswith("C_Box"):
        mb.prism(rounded_rect(x0, y0, x1, y1, 0.5, 2), "XY", z_top - h, z_top - 0.5, "cap_disc")
    elif fp.startswith("C_Pol_Radial"):
        r = min(lx, ly) / 2
        cyl(mb, cx, cy, z_top - h / 2 - 0.5, r, "Z", h - 1.0, "cap_blue", 14)
    elif fp.startswith("C_Pol_Axial"):
        r = h / 2
        L = max(lx, ly) * 0.72
        cyl(mb, cx, cy, z_top - r - 0.5, r, "X" if along_x else "Y", L, "cap_blue", 16)
    elif fp.startswith("Q_Heatsink"):
        mb.prism(rounded_rect(x0, y0, x1, y1, 1.0, 2), "XY", z_top - 3.0, z_top - 0.5, "heat_sink")
        nf = 7
        for i in range(nf):
            if along_x:
                xx = x0 + (i + 0.5) * lx / nf
                mb.prism([(xx - 1.0, y0), (xx + 1.0, y0), (xx + 1.0, y1), (xx - 1.0, y1)], "XY", z_top - h, z_top - 3.0, "heat_sink")
            else:
                yy = y0 + (i + 0.5) * ly / nf
                mb.prism([(x0, yy - 1.0), (x1, yy - 1.0), (x1, yy + 1.0), (x0, yy + 1.0)], "XY", z_top - h, z_top - 3.0, "heat_sink")
        cyl(mb, cx, cy, z_top - 6.0, min(lx, ly) * 0.28, "Z", 6.0, "tin", 20)
    elif fp.startswith("Q_Circle"):
        cyl(mb, cx, cy, z_top - h / 2 - 1.5, 2.3, "Z", h, "ic_black", 10)
    elif fp == "Crystal":
        mb.prism(rounded_rect(x0, y0, x1, y1, 1.5, 3), "XY", z_top - h, z_top - 0.5, "tin")
    elif fp == "DIN5":
        # body under the board, its round mouth facing the rear (+Y)
        mb.prism([(x0 + 1, y0), (x1 - 1, y0), (x1 - 1, y1 - 3), (x0 + 1, y1 - 3)], "XY", z_top - h, z_top, "plastic_black")
        cyl(mb, cx, y1 - 1.5, z_top - h / 2, 7.6, "Y", 3.0 + 1.0, "plastic_black", 20)
        cyl(mb, cx, y1 + 0.6, z_top - h / 2, 5.2, "Y", 0.6, "ic_black", 20)
    elif fp in ("Edge_Connector", "Keyboard_Connector"):
        pass  # drawn as fingers / pads on the board itself
    elif fp.startswith("Sw_"):
        mb.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "XY", z_top - h, z_top, "switch_white")
    else:
        mb.prism(rounded_rect(x0, y0, x1, y1, 0.5, 2), "XY", z_top - h, z_top - 0.3, "ic_black")


def build_main_board(p, col, root):
    mbp = p.raw["main_board"]
    bd = load_json("board.json")
    z = mbp["board_z"]["v"]
    t = mbp["thickness"]["v"]
    W, D = bd["outline"]
    ox, oy = mbp["origin_x"]["v"], mbp["origin_y"]["v"]
    xa, xb, ya, yb = ox - W, ox, oy - D, oy
    mb = MeshBuilder()
    mb.prism(rounded_rect(xa, ya, xb, yb, 1.5, 3), "XY", z, z + t, "pcb_green")
    # the edge connector's fingers (both faces), its own node (design/decisions.md, D6), and the
    # keyboard connector's pads
    fingers = MeshBuilder()
    edge = None
    for part in bd["parts"]:
        if part["footprint"] == "Edge_Connector":
            edge = part
            x0, _, x1, _ = part["body"]
            for i in range(20):
                xx = x0 + (i + 0.5) * (x1 - x0) / 20
                for zz0, zz1 in ((z + t, z + t + 0.05), (z - 0.05, z)):
                    fingers.prism([(xx - 0.8, yb - 7.0), (xx + 0.8, yb - 7.0), (xx + 0.8, yb - 0.3), (xx - 0.8, yb - 0.3)], "XY", zz0, zz1, "copper_gold")
        if part["footprint"] == "Keyboard_Connector":
            x0, y0, x1, _ = part["body"]
            mb.prism([(x0, y0 - 1.5), (x1, y0 - 1.5), (x1, y0 + 1.5), (x0, y0 + 1.5)], "XY", z - 2.5, z, "plastic_black")
    named = []
    for part in bd["parts"]:
        if part["label"]:
            named.append(part)
            continue
        part_geometry(mb, part, z)
    board = mb.build("board.main", col)
    bl.set_labels(board, "Main board (revision G), mounted upside down: its parts face the floor")
    bl.parent(board, root)
    if edge:
        fo = fingers.build("part." + edge["ref"].lower(), col)
        bl.set_labels(fo, f"{edge['ref']}: {edge['label']}")
        bl.parent(fo, board)
    for part in named:
        if part is edge:
            continue
        pm = MeshBuilder()
        part_geometry(pm, part, z)
        if not pm.faces:
            continue
        o = pm.build("part." + part["ref"].lower(), col)
        bl.set_labels(o, f"{part['ref']}: {part['label']} ({part['value']})")
        bl.parent(o, board)
    return board


# --- the keyboard ---------------------------------------------------------------------

LEGEND_WORDS = {"BREAK", "CLEAR", "ENTER", "SHIFT"}


def arrow_poly(length, stem, head_w, head_l, direction):
    """An arrow as one flat outline: a hairline stem and a large solid head."""
    L2, sw, hw = length / 2, stem / 2, head_w / 2
    pts = [(-sw, -L2), (sw, -L2), (sw, L2 - head_l), (hw, L2 - head_l), (0.0, L2), (-hw, L2 - head_l), (-sw, L2 - head_l)]
    a = math.radians({"UP": 0, "LEFT": 90, "DOWN": 180, "RIGHT": 270}[direction])
    ca, sa = math.cos(a), math.sin(a)
    return [(u * ca - w * sa, u * sa + w * ca) for u, w in pts]


def key_row(k, tops):
    """Row 0 (numbers) to 3, or 4 for the space bar; the keypad's rows are 0-3 from its top."""
    if k["name"] == "SPACE":
        return 4
    top = tops[1] if k["keypad"] else tops[0]
    return max(0, min(3, round((top - k["cap"]["y"]) / 19.15)))


def build_key(k, kp, col, parent, tops):
    cap = k["cap"]
    w, d = cap["w"], cap["d"]
    z0 = kp["keycap_bottom_z"]["v"]
    h, tilt_deg = kp["keycap_rows"]["v"][key_row(k, tops)]
    tilt = math.radians(tilt_deg)
    skirt_h = 5.0
    tw = 1.2
    cream = k["name"] == "ENTER"
    body = "key_cream" if cream else "key_black"
    ink = "ink_black" if cream else "ink_white"
    mb = MeshBuilder()
    # skirt (an open box round the switch)
    hw, hd = w / 2, d / 2
    for (ax0, ay0, ax1, ay1) in ((-hw, -hd, hw, -hd + tw), (-hw, hd - tw, hw, hd), (-hw, -hd + tw, -hw + tw, hd - tw), (hw - tw, -hd + tw, hw, hd - tw)):
        mb.prism([(ax0, ay0), (ax1, ay0), (ax1, ay1), (ax0, ay1)], "XY", 0.0, skirt_h, body)
    # the solid, tapered top: lofted from the skirt's outline to a smaller top face whose
    # corners are rounded in its own plane, the face tilted by the cap's row
    kt = kp["keycap_top"]
    ti_x, ti_y = kt["inset"]["v"]
    rt = kt["corner_radius"]["v"]
    lo = rounded_rect(-hw, -hd, hw, hd, 0.8, 4)
    hi = rounded_rect(-hw + ti_x, -hd + ti_y, hw - ti_x, hd - ti_y, rt, 4)
    n = len(lo)
    verts = [(x, y, skirt_h) for x, y in lo] + [(x, y, h + math.tan(tilt) * y) for x, y in hi]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces.append(tuple(range(n, 2 * n)))            # the top face
    faces.append(tuple(reversed(range(n))))         # its underside, over the skirt
    if (lo[1][0] - lo[0][0]) * (lo[2][1] - lo[0][1]) - (lo[1][1] - lo[0][1]) * (lo[2][0] - lo[0][0]) < 0:
        faces = [tuple(reversed(f)) for f in faces]  # keep normals outward whatever the outline's turn
    mb.add_mesh_data(verts, faces, Matrix.Identity(4), body)
    # legends, printed on the tilted top face
    face_m = Matrix.Translation((0.0, 0.0, h + 0.03)) @ Matrix.Rotation(tilt, 4, "X")
    lg = kp["legends"]
    bold = lg["bold"]["v"]

    def text(t, cx, cy, size, b=bold, sp=1.0):
        v, f = bl.glyph_mesh_flat(t, size, bold_mm=b, spacing=sp)
        mb.add_mesh_data(v, f, face_m @ Matrix.Translation((cx, cy, 0.0)), ink)

    name = k["name"]
    main = k["legend"]
    pair = lg["pair_size"]["v"]
    if name in ("UP", "DOWN", "LEFT", "RIGHT"):
        ar = lg["arrow"]
        poly = arrow_poly(ar["length"]["v"], ar["stem"]["v"], ar["head"][0], ar["head"][1], name)
        mb.add_mesh_data([(x, y, 0.0) for x, y in poly], [tuple(range(len(poly)))], face_m, ink)
    elif name in LEGEND_WORDS or name in ("LSHIFT", "RSHIFT"):
        text(main, 0, 0, lg["word_size"]["v"], lg["word_bold"]["v"], lg["word_spacing"]["v"])
    elif k["shift_legend"]:
        text(k["shift_legend"], 0, 2.5, pair)
        text("Ø" if main == "0" else main, 0, -2.6, pair)
    elif main == "0" and not k["keypad"]:
        text("Ø", 0, -2.6, pair)                     # on the digits' baseline: it has no shifted legend
    elif name != "SPACE":
        text("Ø" if main == "0" else main, 0, 0, lg["letter_size"]["v"])
    o = mb.build(k["node"], col, location_mm=(cap["x"], cap["y"], z0))
    bl.set_motion(o, "translate", (0, 0, -1), f"Key {name}" + (" (keypad)" if k["keypad"] else ""), unit="mm")
    o["travel"] = kp["key_travel"]["v"]
    o["matrix_row"] = k["matrix_row"]
    o["matrix_bit"] = k["matrix_bit"]
    o["address"] = k["address"]
    o["key_name"] = name
    o["keypad"] = k["keypad"]
    bl.parent(o, parent)
    return o


def build_keyboard(p, col, root):
    kp = p.raw["keyboard_pcb"]
    kb = load_json("keyboard.json")
    kparts = json.load(open(os.path.join(params.REPO_DIR, "research", "data", "kicad_keyboard_alps_e1_parts.json"), encoding="utf-8"))
    asm = bl.empty("keyboard", col)
    bl.set_labels(asm, "The keyboard: 53 keys and a 12-key pad on one PCB, read by the computer as memory at 3800H")
    bl.parent(asm, root)
    ox, oy = kp["origin_x"]["v"], kp["origin_y"]["v"]
    W, D = kp["outline"]["v"]
    zb = kp["pcb_z"]["v"]
    t = kp["thickness"]["v"]
    zt = zb + t
    # the PCB, the switches and its chips
    mb = MeshBuilder()
    mb.prism(rounded_rect(ox, oy - D, ox + W, oy, 1.5, 3), "XY", zb, zt, "pcb_keyboard")
    s = kp["switch_size"]["v"] / 2
    sh = kp["switch_height"]["v"]
    for k in kb["keys"]:
        mb.prism(rounded_rect(k["x"] - s, k["y"] - s, k["x"] + s, k["y"] + s, 1.0, 2), "XY", zt, zt + sh, "switch_dark")
    for part in kparts["parts"]:
        if part["ref"].startswith("SW") or part["ref"] == "CR1":
            continue
        x0, y0, x1, y1 = part["body"]
        X0, X1, Y0, Y1 = ox + x0, ox + x1, oy - y1, oy - y0
        if part["footprint"].startswith("PinHeader"):
            mb.prism([(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)], "XY", zt, zt + 2.5, "plastic_black")
        elif "DIP" in part["footprint"]:
            cx = (X0 + X1) / 2
            mb.prism(rounded_rect(cx - 3.2, Y0, cx + 3.2, Y1, 0.4, 2), "XY", zt + 0.8, zt + 4.3, "ic_black")
        elif part["footprint"].startswith("R_Array"):
            mb.prism([(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)], "XY", zt, zt + 5.0, "ic_black")
        else:
            mb.prism(rounded_rect(X0, Y0, X1, Y1, 0.5, 2), "XY", zt, zt + 4.0, "cap_disc")
    pcb = mb.build("board.keyboard", col)
    bl.set_labels(pcb, "Keyboard PCB: an 8 x 8 matrix of switches with no diodes, two 74LS05 and two 74LS368")
    bl.parent(pcb, asm)

    # the bezel: a deck with a hole round every key, a raised frame and the name plate's wedge
    c = p.raw["case"]
    wo = c["well_opening"]
    (wx0, wx1), (wy0, wy1) = wo["x"]["v"], wo["y"]["v"]
    # the bezel is built flat and then tilted (below): stretch its depth so that, tilted,
    # it still reaches the opening's rear edge
    th_, py0 = math.radians(kp["tilt"]["v"]), kp["tilt"]["pivot"]["v"][0]
    wy1 = py0 + (wy1 - py0) / math.cos(th_)
    bz = kp["bezel"]
    dz0, dz1 = bz["deck_z"]["v"]
    fz = bz["frame_top_z"]["v"]
    fw = bz["frame_width"]["v"]
    cl = bz["hole_clearance"]["v"]
    g = 0.6
    deck = prism_obj("keyboard.bezel", rounded_rect(wx0 + g, wy0 + g, wx1 - g, wy1 - g, wo["corner_radius"]["v"] - g), "XY", dz0, dz1, "well_black", col)
    holes = MeshBuilder()
    for k in kb["keys"]:
        cp = k["cap"]
        holes.prism(rounded_rect(cp["x"] - cp["w"] / 2 - cl, cp["y"] - cp["d"] / 2 - cl, cp["x"] + cp["w"] / 2 + cl, cp["y"] + cp["d"] / 2 + cl, 1.5, 2), "XY", dz0 - 1, dz1 + 1, "well_black")
    lx, ly = p.raw["power_led"]["position"]["v"]
    cyl(holes, lx, ly, (dz0 + dz1) / 2, 2.8, "Z", dz1 - dz0 + 2, "well_black", 16)
    boolean(deck, holes.build("_holes", col))
    frame = MeshBuilder()
    frame.prism(rounded_rect(wx0 + g, wy0 + g, wx1 - g, wy1 - g, wo["corner_radius"]["v"] - g), "XY", dz1, fz, "well_black")
    fr = frame.build("keyboard.bezel_frame", col)
    boolean(fr, prism_obj("_fi", rounded_rect(wx0 + g + fw, wy0 + g + fw, wx1 - g - fw, wy1 - g - fw, 4.0), "XY", dz1 - 1, fz + 1, "well_black", col))
    np_ = kp["nameplate"]
    # a skirt round the bezel's edge, reaching under the rim, so the gap round the bezel
    # shows black, not the keyboard PCB (wider than the bezel on the left) or the board
    sk = prism_obj("_skirt", rounded_rect(wx0 - 2.0, wy0 - 2.0, wx1 + 2.0, wy1 + 2.0, wo["corner_radius"]["v"] + 2.0), "XY", dz0 - 10.0, dz1, "well_black", col)
    boolean(sk, prism_obj("_ski", rounded_rect(wx0 + g + 1.2, wy0 + g + 1.2, wx1 - g - 1.2, wy1 - g - 1.2, wo["corner_radius"]["v"] - g - 1.2), "XY", dz0 - 11.0, dz1 + 1.0, "well_black", col))
    deck = shapes.merge("keyboard.bezel", [deck, fr, sk], col)
    bl.set_labels(deck, "Keyboard bezel: the black panel round the keys")
    bl.parent(deck, asm)
    build_nameplate(np_, col, asm)

    # the keys and the LED
    tops = (max(k["cap"]["y"] for k in kb["keys"] if not k["keypad"]), max(k["cap"]["y"] for k in kb["keys"] if k["keypad"]))
    for k in kb["keys"]:
        build_key(k, kp, col, asm, tops)
    led = MeshBuilder()
    led.lathe([(0.0, 46.4), (1.4, 46.2), (2.2, 45.6), (2.5, 44.8), (2.5, 40.0), (0.0, 40.0)], 16, "led_red", axis="Z")
    lo = led.build("led.power", col, location_mm=(lx, ly, 0))
    bl.set_labels(lo, "Power LED (CR1), on the keyboard PCB")
    lo["motion"] = "light"
    bl.parent(lo, asm)
    # built flat, the whole assembly now lies on the case's key-surface slope: turned
    # rear-up about the bezel frame's front edge (keys keep travelling along its normal)
    tl = kp["tilt"]
    th = math.radians(tl["v"])
    py_, pz_ = tl["pivot"]["v"]
    asm.rotation_euler = (th, 0.0, 0.0)
    asm.location = (0.0, (py_ - (py_ * math.cos(th) - pz_ * math.sin(th))) * bl.MM, (pz_ - (py_ * math.sin(th) + pz_ * math.cos(th))) * bl.MM)
    return asm


def build_nameplate(np_, col, parent):
    (nx0, nx1), (ny0, ny1), (nz0, nz1) = np_["x"]["v"], np_["y"]["v"], np_["z"]["v"]
    L = math.hypot(ny1 - ny0, nz1 - nz0)
    up = ((ny1 - ny0) / L, (nz1 - nz0) / L)
    origin = ((nx0 + nx1) / 2, (ny0 + ny1) / 2, (nz0 + nz1) / 2)
    nrm = (0.0, -up[1], up[0])
    m = bl.frame_matrix((origin[0] + nrm[0] * 0.4, origin[1] + nrm[1] * 0.4, origin[2] + nrm[2] * 0.4), (1, 0, 0), (0, up[0], up[1]))
    W, H = nx1 - nx0, L - 1.5
    mb = MeshBuilder()
    plate = MeshBuilder()
    plate.prism(rounded_rect(-W / 2, -H / 2, W / 2, H / 2, 0.8, 2), "XY", -0.6, 0.0, "aluminium_brushed")
    v, f = bl.mesh_data(plate.build("_np", col))
    bpy.data.objects.remove(bpy.data.objects["_np"])
    mb.add_mesh_data(v, f, m, "aluminium_brushed")
    # three fields: "Radio Shack" in a black box, "TRS-80" plain, "MICROCOMPUTER SYSTEM" boxed
    w1, w2 = W * 0.37, W * 0.22
    boxes = [(-W / 2 + 1.0, -W / 2 + w1), (W / 2 - (W - w1 - w2) + 1.0, W / 2 - 1.0)]
    for bx0, bx1 in boxes:
        bm = MeshBuilder()
        bm.prism(rounded_rect(bx0, -H / 2 + 1.0, bx1, H / 2 - 1.0, 0.6, 2), "XY", -0.1, 0.2, "ink_black")
        v, f = bl.mesh_data(bm.build("_b", col))
        bpy.data.objects.remove(bpy.data.objects["_b"])
        mb.add_mesh_data(v, f, m, "ink_black")
    # the two logos (assets/logos, public domain), then the plain lettering
    bh = H - 2.0
    v, f = bl.svg_mesh_flat(os.path.join(bl.LOGOS, "Radio_Shack_1974_logo.svg"), w1 - 4.5, bh * 0.62)
    mb.add_mesh_data(v, f, m @ Matrix.Translation((-W / 2 + w1 / 2 + 0.5, 0.0, 0.4)), "aluminium_brushed")
    v, f = bl.svg_mesh_flat(os.path.join(bl.LOGOS, "TRS-80_logo.svg"), w2 * 0.8, H * 0.42)
    mb.add_mesh_data(v, f, m @ Matrix.Translation((-W / 2 + w1 + w2 / 2, 0.0, 0.4)), "ink_black")
    # the plain words in Michroma (assets/fonts, OFL): a wide, extended sans like the plate's
    bw = (boxes[1][1] - boxes[1][0]) * 0.86
    for word, yy in (("MICROCOMPUTER", 1.15), ("SYSTEM", -1.45)):
        v, f = bl.glyph_mesh_flat(word, 2.6, font=bl.FONT_PLATE, max_width_mm=bw, bold_mm=0.05)
        mb.add_mesh_data(v, f, m @ Matrix.Translation(((boxes[1][0] + boxes[1][1]) / 2, yy, 0.4)), "aluminium_brushed")
    o = mb.build("keyboard.nameplate", col)
    bl.set_labels(o, "Name plate: Radio Shack, TRS-80, Microcomputer System")
    bl.parent(o, parent)


def build_rear(p, col, bot, board):
    """The DIN panel in the recess, the power button, and the reset button's cap."""
    c = p.raw["case"]
    dr = c["din_recess"]
    (x0, x1), (z0, z1) = dr["x"]["v"], dr["z"]["v"]
    yb = D2 - dr["depth"]["v"]
    bd = load_json("board.json")
    by = {q["ref"]: q for q in bd["parts"]}
    panel = prism_obj("case.din_panel", rounded_rect(x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, 1.5, 3), "XZ", yb - 1.2, yb, "plastic_black", col)
    holes = MeshBuilder()
    zb = p.raw["main_board"]["board_z"]["v"]
    for ref in ("J1", "J2", "J3"):
        q = by[ref]
        cx = (q["body"][0] + q["body"][2]) / 2
        cyl(holes, cx, yb, zb - q["height"] / 2, 7.9, "Y", 6.0, "plastic_black", 24)
    s1 = by["S1"]
    sx = (s1["body"][0] + s1["body"][2]) / 2
    sz = zb - s1["height"] / 2
    cyl(holes, sx, yb, sz, 5.0, "Y", 6.0, "plastic_black", 20)
    boolean(panel, holes.build("_h", col))
    # labels under the sockets, as on the panel: POWER, VIDEO, TAPE (photos)
    legend_mb = MeshBuilder()
    m = bl.frame_matrix((0, yb + 0.02, 0), (1, 0, 0), (0, 0, 1))
    m = Matrix.Rotation(math.pi, 4, "Z") @ m  # facing +Y (the rear)
    for ref, text in (("J1", "POWER"), ("J2", "VIDEO"), ("J3", "TAPE")):
        q = by[ref]
        cx = (q["body"][0] + q["body"][2]) / 2
        v, f = bl.glyph_mesh_flat(text, 2.2)
        legend_mb.add_mesh_data(v, f, Matrix.Translation((cx, yb + 0.05, z0 + 3.0)) @ Matrix.Rotation(math.pi / 2, 4, "X") @ Matrix.Rotation(math.pi, 4, "Y"), "ink_white")
    lo = legend_mb.build("_legends", col)
    panel = shapes.merge("case.din_panel", [panel, lo], col)
    bl.set_labels(panel, "Rear panel: power switch, then the POWER, VIDEO and TAPE sockets")
    bl.parent(panel, bot)
    btn = MeshBuilder()
    cyl(btn, 0, 0, 0, 4.3, "Y", 4.0, "plastic_black", 20)
    b = btn.build("button.power", col, location_mm=(sx, s1["body"][3] + 2.0, sz))
    bl.set_motion(b, "translate", (0, -1, 0), "Power switch (S1): push on, push off", unit="mm")
    b["travel"] = 2.0
    bl.parent(b, board)
    s2 = by["S2"]
    rb = MeshBuilder()
    cyl(rb, 0, 0, 0, 2.8, "Y", 5.0, "plastic_black", 16)
    r = rb.build("button.reset", col, location_mm=((s2["body"][0] + s2["body"][2]) / 2, s2["body"][3] + 2.5, zb - s2["height"] / 2))
    bl.set_labels(r, "Reset button (S2), reached through the expansion opening")
    bl.parent(r, board)


def build_ribbon(p, col, root):
    """The keyboard's flat cable: from J100 under the main board, round the board's front
    edge and up to the keyboard PCB's header."""
    bd = load_json("board.json")
    j100 = next(q for q in bd["parts"] if q["ref"] == "J100")
    x0, y0, x1, _ = j100["body"]
    zb = p.raw["main_board"]["board_z"]["v"]
    kpz = p.raw["keyboard_pcb"]["pcb_z"]["v"]
    pts = [(y0, zb - 3.0), (-89.5, zb - 3.0), (-93.5, zb), (-93.5, kpz + 2.0), (-89.0, kpz + 4.6), (-86.0, kpz + 4.6)]
    a = shapes.offset_polyline(pts, 0.45)
    b = shapes.offset_polyline(pts, -0.45)
    poly = a + list(reversed(b))
    o = prism_obj("cable.ribbon", poly, "YZ", x0, x1, "ribbon_grey", col)
    bl.set_labels(o, "Flat cable: the keyboard's 8 row and 8 column lines to the main board")
    o["motion"] = "stretch"
    bl.parent(o, root)
    return o


def build(p, col, root):
    top, bot = build_case(p, col, root)
    board = build_main_board(p, col, root)
    build_rear(p, col, bot, board)
    kbd = build_keyboard(p, col, root)
    build_ribbon(p, col, root)
    paths = {
        "case.top": [(0, 0, 140)],
        "keyboard": [(0, 0, 95)],
        "board.main": [(0, 0, 45), (0, -250, 0)],   # up, then out in front of the case, where it turns over
    }
    for name, moves in paths.items():
        o = bpy.data.objects[name]
        bl.set_path(o, moves)
    bpy.data.objects["board.main"]["flip"] = True
    return root


if __name__ == "__main__":
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("unit.keyboard", col)
    build(params.load(), col, root)
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"KEYBOARD_UNIT_OK objects={len(bpy.data.objects)} triangles~{tris}")
