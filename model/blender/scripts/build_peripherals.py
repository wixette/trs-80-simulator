# SPDX-License-Identifier: Apache-2.0
"""The Realistic CTR-80 cassette recorder (design/decisions.md, D5), and the power supply.

Both are built from the reference photos (machine.json recorder, power_supply). Each has its own frame: origin at the
centre of the footprint, bottom face, +Y back.
  unit.recorder:  recorder.body, recorder.door (rotate: the hinge), recorder.cassette,
                  recorder.reel.left/right (rotate), recorder.key.<name> (translate)
  unit.psu:       psu.body
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

from lib import bl, params, shapes  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402
from lib.shapes import boolean, box_obj, prism_obj, rounded_rect, rounded_rect_corners  # noqa: E402
from build_keyboard_unit import cyl  # noqa: E402



def text_on(mb, txt, size, m, mat, bold=0.0, italic=0.0):
    """Flat lettering under matrix m (its local XY plane), optionally slanted."""
    v, f = bl.glyph_mesh_flat(txt, size, bold_mm=bold)
    if italic:
        v = [(x + italic * y, y, z) for x, y, z in v]
    mb.add_mesh_data(v, f, m, mat)


def build_recorder(p, col, root):
    r = p.raw["recorder"]
    W, D, H = r["size"]["v"]
    w2, d2 = W / 2, D / 2
    rc, re = r["plan_corner_radius"]["v"], r["top_edge_radius"]["v"]
    sd = r["sides"]
    # --- the body: three horizontal parts seen from the side (machine.json recorder sides):
    # a smooth lower part set in, a ribbed middle part at full width, a smooth upper part a
    # little in from the sides and the rear, carrying the rounded top edges
    (lz0, lz1), li = sd["lower"]["v"], sd["lower"]["inset"]
    (mz0, mz1) = sd["middle"]["v"]
    (uz0, uz1), ui = sd["upper"]["v"], sd["upper"]["inset"]
    # every rounding has its arc in the side plane (like the keyboard unit's housing): the
    # vertical corners are square, and only the top's front and rear edges are rounded
    def rect(x0, y0, x1, y1):
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

    body = prism_obj("_rb", rect(-w2, -d2, w2, d2), "XY", mz0, mz1, "plastic_black", col)
    lower = prism_obj("_rl", rect(-w2 + li, -d2 + li, w2 - li, d2 - li), "XY", lz0, mz0 + 0.5, "plastic_black", col)
    upper = prism_obj("_ru", rounded_rect_corners(-d2, uz0 - 0.5, d2 - ui, H, 0, 0, re, re, 6), "YZ", -w2 + ui, w2 - ui, "plastic_black", col)
    boolean(body, [lower, upper], "UNION")
    # the key well at the front (its floor at the middle part's top), the jack panel on the left
    k = r["keys"]
    pitch, kw, kx0, kz0 = k["pitch"]["v"], k["width"]["v"], k["x0"]["v"], k["bottom_z"]["v"]
    n = len(k["v"])
    ky0, ky1 = r["bands"]["keys"]["v"]
    kxa, kxb = kx0 - pitch / 2 - 0.4, kx0 + (n - 0.5) * pitch + 0.4
    boolean(body, box_obj("_kw", kxa, -d2 - 1, k["well_floor_z"]["v"], kxb, ky1 + 0.6, H + 1, "plastic_black", col))
    jp = r["jack_panel"]
    (jy0, jy1), (jz0, jz1) = jp["y"]["v"], jp["z"]["v"]
    # the front's black base, under the silver strip, indented across its middle third
    fr = r["front_recess"]
    (rx0, rx1), rdp = fr["x"]["v"], fr["depth"]["v"]
    boolean(body, box_obj("_fr", rx0, -d2 - 1, lz0 - 1, rx1, -d2 + li + rdp, lz1, "plastic_black", col))
    xp = -w2 + li + 0.8                               # the jack panel's face, let into the side
    boolean(body, box_obj("_jp", -w2 - 1, jy0, jz0, xp, jy1, jz1, "plastic_black", col))
    shapes.shade_auto(body)
    deco = MeshBuilder()
    # ribs along the middle part on both sides (on the left, above the jack panel only)
    rp = sd["rib_pitch"]["v"]
    ry0, ry1 = sd["ribs_y"]["v"]
    y = ry0
    while y <= ry1:
        for sgn in (-1, 1):
            z0 = max(jz1, mz0 + 1.0) if (sgn < 0 and jy0 - 1 < y < jy1 + 1) else mz0 + 1.0
            xa, xb = sorted((sgn * (w2 - 0.3), sgn * (w2 + 0.45)))
            deco.prism([(xa, y - 0.45), (xb, y - 0.45), (xb, y + 0.45), (xa, y + 0.45)], "XY", z0, mz1 - 1.0, "plastic_black")
        y += rp
    # the silver strip across the front, under the keys, up to the middle part's top
    fz0, fz1 = r["front_strip"]["z"]["v"]
    # (a thin plate in front of the body, so its top never shares a plane with the key well's floor)
    deco.prism([(-w2 + 3, -d2 - 0.5), (w2 - 3, -d2 - 0.5), (w2 - 3, -d2 - 0.02), (-w2 + 3, -d2 - 0.02)], "XY", fz0, fz1, "aluminium_brushed")

    # the speaker grille: a raised panel with rows of holes, the tape counter at its front right
    b = r["bands"]
    gy0, gy1 = b["grille"]["v"]
    deco.prism(rounded_rect(-w2 + 5, gy0, w2 - 5, gy1 - 2.5, 3.0, 3), "XY", H - 0.3, H + 0.8, "switch_dark")
    cx0, cx1 = r["counter"]["x"]["v"]
    cy0, cy1 = r["counter"]["y"]["v"]
    hp, hs = r["grille_holes"]["pitch"]["v"], r["grille_holes"]["size"]["v"]
    gx = -w2 + 5 + 3.0
    while gx < w2 - 5 - 2.5:
        gy = gy0 + 3.0
        while gy < gy1 - 5.0:
            if not (cx0 - 2 < gx < cx1 + 6 and cy0 - 2 < gy < cy1 + 2):
                deco.add_mesh_data([(gx - hs / 2, gy - hs / 2, 0), (gx + hs / 2, gy - hs / 2, 0), (gx + hs / 2, gy + hs / 2, 0), (gx - hs / 2, gy + hs / 2, 0)],
                                   [(0, 1, 2, 3)], Matrix.Translation((0, 0, H + 0.82)), "hole_black")
            gy += hp
        gx += hp
    # the counter's window is its own part: the page writes the three digits on it as the tape moves
    ctr = MeshBuilder()
    ctr.prism(rounded_rect(cx0, cy0, cx1, cy1, 0.8, 2), "XY", H + 0.8, H + 1.2, "smoke_window")
    deco.prism(rounded_rect(cx1 + 1.0, cy0 + 1.5, cx1 + 4.5, cy1 - 1.5, 0.8, 2), "XY", H + 0.8, H + 1.8, "recorder_silver")  # its reset button
    # silver lines either side of the door, the label panel, the key labels' strip
    dy0, dy1 = b["door"]["v"]
    for ya, yb in ((dy1, dy1 + 3.5), (dy0 - 3.0, dy0)):
        deco.prism([(-w2 + 5, ya), (w2 - 5, ya), (w2 - 5, yb), (-w2 + 5, yb)], "XY", H - 0.3, H + 0.4, "aluminium_brushed")
    mx0, mx1 = r["mic_grille"]["x"]["v"]
    my0, my1 = r["mic_grille"]["y"]["v"]
    deco.prism(rounded_rect(mx0, my0, mx1, my1, 1.0, 2), "XY", H - 0.3, H + 0.5, "recorder_silver")
    for i in range(6):
        for j in range(6):
            u, v = mx0 + 2.2 + i * (mx1 - mx0 - 4.4) / 5, my0 + 2.2 + j * (my1 - my0 - 4.4) / 5
            deco.add_mesh_data([(u - 0.8, v - 0.8, 0), (u + 0.8, v - 0.8, 0), (u + 0.8, v + 0.8, 0), (u - 0.8, v + 0.8, 0)], [(0, 1, 2, 3)], Matrix.Translation((0, 0, H + 0.52)), "hole_black")
    lp0, lp1 = b["label_panel"]["v"]
    ym = (lp0 + lp1) / 2
    text_on(deco, "REALISTIC", 3.6, Matrix.Translation((-6.0, ym + 3.0, H + 0.05)), "aluminium_brushed", bold=0.12, italic=0.3)
    text_on(deco, "CTR-80", 2.3, Matrix.Translation((22.0, ym + 3.0, H + 0.05)), "aluminium_brushed")
    text_on(deco, "AC/BATTERY CASSETTE RECORDER", 1.9, Matrix.Translation((6.0, ym - 3.5, H + 0.05)), "aluminium_brushed")
    lx, ly = r["led"]["v"]
    # the lamp is its own part: the page lights it while the deck records
    lamp = MeshBuilder()
    cyl(lamp, lx, ly, H + 0.3, 1.3, "Z", 1.0, "led_red", 12)
    text_on(deco, "RECORD/BATTERY", 1.1, Matrix.Translation((lx - 2.0, ly + 4.0, H + 0.05)), "aluminium_brushed")
    kl0, kl1 = b["key_labels"]["v"]
    deco.prism([(kxa, kl0), (kxb, kl0), (kxb, kl1), (kxa, kl1)], "XY", H - 0.3, H + 0.3, "aluminium_brushed")
    for i, name in enumerate(k["v"]):
        text_on(deco, name, 1.6, Matrix.Translation((kx0 + i * pitch, (kl0 + kl1) / 2, H + 0.32)), "ink_black")
    # the jacks on the left side, with their names
    face = bl.frame_matrix((0, 0, 0), (0, -1, 0), (0, 0, 1))     # lettering facing -X
    for name, jy, jz, kind in r["side_jacks"]["v"]:
        if kind in ("jack", "jack_small"):
            ro, ri = (3.0, 1.7) if kind == "jack" else (2.2, 1.15)
            cyl(deco, xp - 0.4, jy, jz, ro, "X", 0.8, "aluminium_brushed", 16)
            cyl(deco, xp - 0.85, jy, jz, ri, "X", 0.1, "hole_black", 12)
        elif kind == "ac":
            deco.prism([(jy - 5.0, jz - 3.5), (jy + 5.0, jz - 3.5), (jy + 5.0, jz + 3.5), (jy - 5.0, jz + 3.5)], "YZ", xp - 0.6, xp, "hole_black")
        elif kind == "wheel":
            deco.prism([(jy - 9.5, jz - 3.3), (jy + 9.5, jz - 3.3), (jy + 9.5, jz + 3.3), (jy - 9.5, jz + 3.3)], "YZ", xp - 0.05, xp, "hole_black")
            cyl(deco, xp + 1.2, jy, jz, 2.4, "Y", 16.0, "switch_dark", 14)
        text_on(deco, name, 1.4, Matrix.Translation((xp - 0.06, jy, jz + (6.0 if kind != "wheel" else 5.2))) @ face, "ink_white")
    # rubber feet
    fw, fd, fh = r["feet"]["size"]
    for fx, fy in r["feet"]["v"]:
        deco.prism(rounded_rect(fx - fw / 2, fy - fd / 2, fx + fw / 2, fy + fd / 2, 1.5, 2), "XY", -fh, 0.3, "rubber_black")
    do_ = deco.build("_deco", col)
    body = shapes.merge("recorder.body", [body, do_], col)
    bl.set_labels(body, "Realistic CTR-80 cassette recorder (26-1205): the computer's storage, on audio tape. "
                        "The cable from the computer plugs into EAR, AUX and REM on its left side")
    bl.parent(body, root)
    lmo = lamp.build("recorder.lamp", col)
    bl.set_labels(lmo, "RECORD/BATTERY lamp: lit while the deck records, dimmer as the batteries run down")
    lmo["motion"] = "light"
    bl.parent(lmo, body)
    cto = ctr.build("recorder.counter", col)
    bl.set_labels(cto, "Tape counter: three digits that count as the tape moves; its button sets it to 000")
    bl.parent(cto, body)
    # --- the cassette door, hinged at its back edge (the page lifts it about X for EJECT
    # and for a tape going in): an open frame round a see-through window, so the cassette
    # held in it shows, its label and its two reels (which turn while the tape moves)
    door = MeshBuilder()
    dx0, dx1 = -w2 + 6, w2 - 6
    wx0, wx1 = -w2 + 12, w2 - 12
    wy0, wy1 = dy0 + 7.0, dy1 - 4.0
    for fx0, fy0, fx1, fy1 in ((dx0, dy0, dx1, wy0), (dx0, wy1, dx1, dy1), (dx0, wy0, wx0, wy1), (wx1, wy0, dx1, wy1)):
        door.prism(rect(fx0, fy0, fx1, fy1), "XY", H - 0.3, H + 0.6, "plastic_black")
    door.prism(rect(wx0, wy0, wx1, wy1), "XY", H + 0.50, H + 0.55, "door_window")
    text_on(door, "AUTOMATIC STOP", 2.4, Matrix.Translation((0.0, dy0 + 3.6, H + 0.62)), "aluminium_brushed")
    dob = door.build("recorder.door", col)
    hinge = (0.0, dy1, H)
    dob.data.transform(Matrix.Translation(tuple(-c * bl.MM for c in hinge)))
    dob.location = tuple(c * bl.MM for c in hinge)
    bl.set_motion(dob, "rotate", (1, 0, 0), "Cassette door: EJECT lifts it", unit="deg")
    bl.set_labels(dob, "Cassette door: the cassette sits in it, seen through its window; EJECT lifts it open")
    bl.parent(dob, body)
    # the cassette: a compact cassette, 100.4 x 63.8 x 12 mm, lying flat under the window
    # with its hubs 42.5 mm apart along X (the spacing the photos were scaled by)
    cw, cd, ct = 100.4, 63.8, 12.0
    cy = (wy0 + wy1) / 2
    zt = H + 0.40
    zb = zt - ct
    hy = cy + 3.0
    cas = MeshBuilder()
    cas.prism(rounded_rect(-cw / 2, cy - cd / 2, cw / 2, cy + cd / 2, 2.0, 3), "XY", zb, zt, "cassette_shell")
    cas.prism(rect(-cw / 2 + 5, cy - cd / 2 + 14, cw / 2 - 5, cy + cd / 2 - 4), "XY", zt, zt + 0.04, "label_cream")
    cas.prism(rect(-30.0, hy - 6.5, 30.0, hy + 6.5), "XY", zt + 0.04, zt + 0.06, "tape_brown")
    for hx in (-21.25, 21.25):
        cyl(cas, hx, hy, zt + 0.065, 6.0, "Z", 0.01, "hole_black", 20)
    # the opening along its front edge, where the head meets the tape
    cas.prism(rect(-24.0, cy - cd / 2 - 0.01, 24.0, cy - cd / 2 + 6.0), "XY", zb + 2.0, zt + 0.07, "cassette_shell")
    text_on(cas, "C-30", 3.0, Matrix.Translation((-36.0, cy + cd / 2 - 9.0, zt + 0.05)), "ink_black")
    cob = cas.build("recorder.cassette", col)
    bl.set_labels(cob, "A cassette: the programs are on its tape as sound; the computer reads and writes it through the recorder")
    for side, hx in (("left", -21.25), ("right", 21.25)):
        rm = MeshBuilder()
        cyl(rm, 0.0, 0.0, 0.0, 4.2, "Z", 0.3, "hub_white", 20)
        cyl(rm, 0.0, 0.0, 0.3, 2.6, "Z", 0.05, "hole_black", 16)
        for tooth in range(6):
            ang = tooth * math.pi / 3
            ca, sa = math.cos(ang), math.sin(ang)
            pts = [(r0 * ca - w * sa, r0 * sa + w * ca) for r0, w in ((1.6, -0.45), (2.7, -0.45), (2.7, 0.45), (1.6, 0.45))]
            rm.prism(pts, "XY", 0.3, 0.4, "hub_white")
        ro = rm.build(f"recorder.reel.{side}", col, location_mm=(hx, hy, zt + 0.07))
        bl.set_motion(ro, "rotate", (0, 0, 1), f"The cassette's {side} reel", unit="deg")
        bl.parent(ro, cob)
    # parented last: the reels' places are taken while the cassette still sits at the origin
    bl.parent(cob, dob)
    # --- the six piano keys -------------------------------------------------------------
    kd = ky1 - ky0
    for i, name in enumerate(k["v"]):
        mat = "key_red" if name == "RECORD" else "plastic_black"
        mb = MeshBuilder()
        # the top: a slab overhanging the key's front face, which sits back from the
        # recorder's front (machine.json recorder keys top_slab)
        ts = k["top_slab"]
        st, so, sb = ts["thickness"]["v"], ts["overhang"]["v"], ts["front_setback"]["v"]
        y_f = -kd / 2 + sb                                 # the slab's front
        mb.prism(rect(-kw / 2, y_f, kw / 2, kd / 2), "XY", H - 0.4 - st, H - 0.4, mat)
        mb.prism(rect(-kw / 2, y_f + so, kw / 2, kd / 2), "XY", kz0 + 0.3, H - 0.4 - st, mat)
        for c in range(4):
            for rr in range(7):
                u = -kw / 2 + 2.3 + c * (kw - 4.6) / 3
                v = -kd / 2 + 2.5 + rr * (kd - 5.0) / 6
                mb.prism([(u - 1.1, v - 1.1), (u + 1.1, v - 1.1), (u + 1.1, v + 1.1), (u - 1.1, v + 1.1)], "XY", H - 0.4, H - 0.05, mat)
        ko = mb.build("recorder.key." + name.lower().replace("-", ""), col, location_mm=(kx0 + i * pitch, (ky0 + ky1) / 2, 0))
        bl.set_motion(ko, "translate", (0, 0, -1), f"Recorder key {name}", unit="mm")
        ko["travel"] = k["travel"]["v"]
        bl.parent(ko, root)
    return root


def build_psu(p, col, root):
    """The power supply: a small black transformer box, tapered a little towards its top."""
    s = p.raw["power_supply"]
    W, D, H = s["size"]["v"]
    tw, td = s["top"]["v"]
    r0, r1 = s["corner_radius"]["v"]
    mb = MeshBuilder()
    # a loft from the base's outline to the smaller top's (both with rounded vertical corners)
    lo = rounded_rect(-W / 2, -D / 2, W / 2, D / 2, r0, 4)
    hi = rounded_rect(-tw / 2, -td / 2, tw / 2, td / 2, r1, 4)
    n = len(lo)
    verts = [(x, y, 0.0) for x, y in lo] + [(x, y, H) for x, y in hi]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(range(n, 2 * n)), tuple(reversed(range(n)))]
    mb.add_mesh_data(verts, faces, Matrix.Identity(4), "plastic_black")
    # the groove near the bottom: a dark band just proud of the sides
    gz = s["groove_z"]["v"]
    k = gz / H
    gw, gd, gr = W - (W - tw) * k, D - (D - td) * k, r0 - (r0 - r1) * k
    ring = rounded_rect(-gw / 2 - 0.05, -gd / 2 - 0.05, gw / 2 + 0.05, gd / 2 + 0.05, gr, 4)
    rv = [(x, y, gz - 0.6) for x, y in ring] + [(x, y, gz + 0.6) for x, y in ring]
    mb.add_mesh_data(rv, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], Matrix.Identity(4), "hole_black")
    # the plain raised panel on top (the lines across it in the photos are a sticker's print)
    tp = s["top_panel"]
    ti, th = tp["inset"]["v"], tp["height"]["v"]
    mb.prism(rounded_rect(-tw / 2 + ti, -td / 2 + ti, tw / 2 - ti, td / 2 - ti, 3.0, 3), "XY", H - 0.1, H + th, "plastic_black")
    # the DIN cord's strain relief at the front, low down; the mains cord leaving the back
    cyl(mb, 0, -D / 2 - 2.5, 10.0, 3.2, "Y", 7.0, "rubber_black", 14)
    cyl(mb, 0, D / 2 + 3.0, 10.0, 3.0, "Y", 8.0, "rubber_black", 14)
    o = mb.build("psu.body", col)
    bl.set_labels(o, "Power supply: a transformer box; mains in at the back, about 14 V AC out to the computer's POWER socket, "
                     "regulated down to its voltages on the main board")
    bl.parent(o, root)
    return root


if __name__ == "__main__":
    bl.reset_scene()
    col = bpy.context.scene.collection
    p = params.load()
    build_recorder(p, col, bl.empty("unit.recorder", col))
    build_psu(p, col, bl.empty("unit.psu", col, (300, 0, 0)))
    print("PERIPHERALS_OK")
