# SPDX-License-Identifier: Apache-2.0
"""The TRS-80 Video Display (26-1201), built from params (design/decisions.md, D8).

Its own frame (mm): origin at the centre of the footprint's front edge on the bottom face,
+X right, +Y back, +Z up. Under the empty `unit.display`:
  display.cabinet       the outer shell: a silver tray with no top and no front                 (static)
  display.front         the inner shell: dark, round the tube; the screen opening, the right-hand
                        panel, the name plate; grooves between it and the tray               (static)
  display.screen        the tube's face, UV-mapped 0..1: the page draws the picture on it   (screen)
  display.power_button  the red power button                                                 (toggle)
  display.control.*     the contrast (C) and brightness (B) controls under the screen
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

from lib import bl, params, shapes  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402
from lib.shapes import boolean, box_obj, prism_obj, rounded_rect  # noqa: E402
from build_keyboard_unit import cyl  # noqa: E402


def build(p, col, root):
    d = p.raw["video_display"]
    W2 = d["width"]["v"] / 2
    H = d["height"]["v"] - d["base"]["height"]["v"]   # the body; the base below makes up the 12 in
    D = d["depth"]["v"]
    e = d["enclosure"]
    sw = e["outer_side_wall"]["v"]
    rw = e["outer_rear_wall"]["v"]
    ft = e["outer_floor_top"]["v"]
    g = e["groove"]["width"]["v"]
    gd = e["groove"]["depth"]["v"]
    gr = e["groove"]["corner_radius"]["v"]
    xi = W2 - sw            # the outer shell's inner face (the groove's outer side)
    xs = xi - g             # the inner shell's side
    yr = D - rw             # the rear wall's inner face
    rec = 2.5               # the dark front's surface is y = 0; details sit on and in it

    # --- the outer shell: a silver, open tray with a floor, two sides and a rear wall ----
    rs = e["outer_side_front_top_corner_radius"]["v"]
    rf = e["outer_front_bottom_edge_radius"]["v"]
    # seen from the front, a U whose bottom corners are rounded; seen from the side, the top
    # corners and the bottom edges, front and rear, are rounded (in the side planes)
    rfb = e["outer_front_bottom_corner_radius"]["v"]
    rib = e["inner_front_bottom_corner_radius"]["v"]
    rcav = rib + g   # the outer shell's inner edge round the inner case's bottom corners
    cab = prism_obj("display.cabinet", shapes.rounded_rect_corners(-W2, 0, W2, H, rfb, rfb, 0, 0, 12), "XZ", 0, D, "case_silver", col)
    # the rear corners mirror the front ones (machine.json enclosure.outer_rear_corners)
    boolean(cab, prism_obj("_side", shapes.rounded_rect_corners(0, 0, D, H, rf, rf, rs, rs, 12), "YZ", -W2 - 1, W2 + 1, "case_silver", col), "INTERSECT")
    boolean(cab, prism_obj("_cavity", shapes.rounded_rect_corners(-xi, ft, xi, H + 60, rcav, rcav, 0, 0, 12), "XZ", -5, yr, "case_silver", col))
    # vent slots: from just under the floor's top edge, down the front, round the
    # front-bottom edge and onto the bottom; each a groove `vd` deep following the surface
    vg = d["vent_grille"]
    (vx0, vx1), (vz0, vz1) = vg["x"]["v"], vg["z"]["v"]
    pitch = vg["pitch"]["v"]
    nv = vg["count"]["v"]
    hw = vg["width"]["v"] / 2
    er = vg["end_radius"]["v"]
    vd = vg["depth"]["v"]
    wy = vg["wrap_y"]["v"]

    def arc(r, n=10):
        return [(rf - r * math.cos(math.radians(90 * k / n)), rf - r * math.sin(math.radians(90 * k / n))) for k in range(n + 1)]

    out_path = [(-2.0, vz1)] + arc(rf + 2.0) + [(wy, -2.0)]
    in_path = [(wy, vd)] + list(reversed(arc(rf - vd))) + [(vd, vz1)]
    slot_profile = out_path + in_path
    for i in range(nv):
        x = vx0 + i * pitch
        # the slot's path round the edge, with its two ends rounded: the top end in the front
        # plane, the far end (under the bottom) in the bottom plane
        sl = prism_obj("_slot", slot_profile, "YZ", x - hw, x + hw, "case_silver", col)
        boolean(sl, prism_obj("_sf", shapes.rounded_rect_corners(x - hw, -50, x + hw, vz1, 0, 0, er, er, 6), "XZ", -10, wy + 10, "case_silver", col), "INTERSECT")
        boolean(sl, prism_obj("_sb", shapes.rounded_rect_corners(x - hw, -50, x + hw, wy, 0, 0, er, er, 6), "XY", -10, vz1 + 10, "case_silver", col), "INTERSECT")
        boolean(cab, sl)

    def in_slot(x, y, z):
        if not (vx0 - 2 < x < vx1 + 2 and z < vz1 + 0.5 and y < wy + 0.5):
            return False
        if z > rf:
            depth = y
        elif y > rf:
            depth = z
        else:
            depth = rf - math.hypot(y - rf, z - rf)
        return depth > 0.4

    shapes.recolour_faces(cab, "plastic_black", in_slot)
    # the three openings under C, B and V: two control bushings' holes and the cable's entry
    fc = d["front_controls"]
    holes = [(x, z, fc["panel_hole_radius"]["v"]) for x, z in d["knobs"]["v"][:2]]
    holes.append((d["knobs"]["v"][2][0], d["knobs"]["v"][2][1], fc["cable_entry_radius"]["v"]))
    for hx, hz, hr in holes:
        hm = MeshBuilder()
        cyl(hm, hx, 6.0, hz, hr, "Y", 14.0, "case_silver", 32)
        boolean(cab, hm.build("_hole", col))
    shapes.recolour_faces(cab, "plastic_black", lambda x, y, z: y > 0.3 and any(math.hypot(x - hx, z - hz) < hr + 0.3 for hx, hz, hr in holes))
    shapes.shade_auto(cab)
    bl.set_labels(cab, "Video Display (26-1201), outer shell: a silver tray with no top and no front, cradling the dark shell that holds the tube")
    bl.parent(cab, root)

    # --- the inner shell: dark, filling the tray, its top and front the monitor's ----------
    inner = prism_obj("_inner", shapes.rounded_rect_corners(-xi + 0.2, ft, xi - 0.2, H, rcav - 0.2, rcav - 0.2, 0, 0, 12), "XZ", 0, yr - 0.2, "monitor_brown", col)
    # the grooves between the shells, each g wide, gd deep, with rounded bottoms:
    # along the top of each side, down the front of each side, across the lower front
    # (one boolean per groove: a single cutter whose pieces overlap breaks the exact solver)
    for sgn in (-1, 1):
        x0, x1 = sorted((sgn * xi, sgn * xs))
        x0, x1 = x0 - (1 if sgn < 0 else 0), x1 + (1 if sgn > 0 else 0)
        boolean(inner, prism_obj("_gt", rounded_rect(x0, H - gd, x1, H + gd, gr, 3), "XZ", -1, yr + 1, "monitor_brown", col))
    # down the front of each side and across the lower front: the groove follows the inner
    # case's front, a rounded-bottom U, so cut the front gd deep and put that U back
    boolean(inner, box_obj("_gfront", -xi - 1, -1, ft - 1, xi + 1, gd, H + 1, "monitor_brown", col))
    boolean(inner, prism_obj("_ufront", shapes.rounded_rect_corners(-xs, ft + g, xs, H, rib, rib, 0, 0, 12), "XZ", 0, gd + 0.5, "monitor_brown", col), "UNION")
    # the edge between front and top, rounded as the side walls' corners
    boolean(inner, prism_obj("_edge", shapes.rounded_rect_corners(0, -50, D + 50, H, 0, 0, 0, e["inner_edge_radius"]["v"], 10), "YZ", -W2, W2, "monitor_brown", col), "INTERSECT")
    so = d["screen_opening"]
    (sx0, sx1), (sz0, sz1) = so["x"]["v"], so["z"]["v"]
    sr = so["corner_radius"]["v"]
    boolean(inner, prism_obj("_so", rounded_rect(sx0, sz0, sx1, sz1, sr, 8), "XZ", -1, 48.0, "monitor_brown", col))
    tf = d["tube_face"]
    (tx0, tx1), (tz0, tz1) = tf["x"]["v"], tf["z"]["v"]
    tr = tf["corner_radius"]["v"]
    R = tf["sphere_radius"]["v"]
    apex = tf["apex_y"]["v"]
    fcx, fcz = (tx0 + tx1) / 2, (tz0 + tz1) / 2

    def on_glass(x, z):
        """Depth (y) of the glass at (x, z): a piece of a sphere bulging toward the viewer."""
        return apex + ((x - fcx) ** 2 + (z - fcz) ** 2) / (2 * R)

    bow = tf["outline_bow"]
    bz, bx = bow["top_bottom"]["v"], bow["sides"]["v"]
    hx, hz = (tx1 - tx0) / 2, (tz1 - tz0) / 2

    def bowed(x, z):
        """The glass's outline bows outward: each edge most at its middle, not at all at the corners."""
        tx, tz = (x - fcx) / hx, (z - fcz) / hz
        return (fcx + (x - fcx) * (1 + bx / hx * max(0.0, 1 - tz * tz)),
                fcz + (z - fcz) * (1 + bz / hz * max(0.0, 1 - tx * tx)))

    rim = [bowed(x, z) for x, z in rounded_rect(tx0, tz0, tx1, tz1, tr, 12)]
    y_face = max(on_glass(x, z) for x, z in rim)   # the rim's deepest point
    # the mask between the opening and the tube: a tunnel narrowing to the tube's face
    tun = MeshBuilder()
    m = 10
    # both ends sampled alike (points along each side, not only at the corners), so the
    # inner end follows the glass's bowed edge and pairs up with the outer end
    outer = shapes.ring_points(sx0, sz0, sx1, sz1, sr, m, 40)
    innr = [bowed(x, z) for x, z in shapes.ring_points(tx0, tz0, tx1, tz1, tr, m, 40)]
    nn = len(outer)
    base = len(tun.verts)
    for (x, z) in outer:
        tun.verts.append((x, 0.0, z))
    for (x, z) in innr:
        # the tunnel meets the glass on its rim, a hair in front of it (as the AGT-30's bezel)
        tun.verts.append((x, on_glass(x, z) - 0.5, z))
    mi = tun._mat("monitor_brown")
    for i in range(nn):
        j = (i + 1) % nn
        tun._add([base + i, base + j, base + nn + j, base + nn + i], mi, False)
    to = tun.build("_tunnel", col)
    # a dark backing behind the face, so no one sees into the cabinet at its corners
    backing = prism_obj("_backing", rounded_rect(tx0 - bx - 2, tz0 - bz - 2, tx1 + bx + 2, tz1 + bz + 2, tr + 2, 8), "XZ", y_face + 1.0, y_face + 2.0, "crt_glass", col)
    # the right-hand side, top to bottom: the silver word "Power"; the power button's two
    # rings (silver, then a raised ring of the casing: the finished edge of its opening);
    # a raised platform of the casing carrying the name plate (machine.json right_panel)
    rp = d["right_panel"]
    (rx0, rx1), (rz0, rz1) = rp["x"]["v"], rp["z"]["v"]
    ph = rp["height"]["v"]
    panel = prism_obj("_rp", rounded_rect(rx0, rz0, rx1, rz1, rp["corner_radius"]["v"], 4), "XZ", -ph, 0.5, "monitor_brown", col)
    pb = d["power_button"]
    bxc, bzc = pb["v"]
    rings = MeshBuilder()
    rh = pb["ring_height"]["v"]
    for (r_in, r_out), mat in ((pb["silver_ring"]["v"], "knob_chrome"), (pb["casing_ring"]["v"], "monitor_brown")):
        rings.tube(r_out, r_in, 32, "XZ", -rh, 0.3, mat, offset=(bxc, 0.0, bzc))
    ro = rings.build("_rings", col)
    npl = d["nameplate"]
    (nx0, nx1), (nz0, nz1) = npl["x"]["v"], npl["z"]["v"]
    plate = MeshBuilder()
    plate.prism(rounded_rect(nx0, nz0, nx1, nz1, 2.0, 3), "XZ", -ph - 0.6, -ph, "aluminium_brushed")
    hgt = nz1 - nz0
    boxes = [(nz1 - 2.5 - hgt * 0.33, nz1 - 2.5), (nz0 + 2.5, nz0 + 2.5 + hgt * 0.40)]
    for bz0, bz1 in boxes:
        plate.prism(rounded_rect(nx0 + 3, bz0, nx1 - 3, bz1, 1.5, 3), "XZ", -ph - 0.9, -ph - 0.5, "ink_black")
    po = plate.build("_plate", col)
    face_m = Matrix.Translation((0, -ph - 1.2, 0)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    text = MeshBuilder()
    cxn = (nx0 + nx1) / 2
    # the two logos (assets/logos, public domain), then the plain lettering
    pw = nx1 - nx0 - 6.0
    v, f = bl.svg_mesh_flat(os.path.join(bl.LOGOS, "Radio_Shack_1974_logo.svg"), pw - 5.0, (boxes[0][1] - boxes[0][0]) * 0.55)
    text.add_mesh_data(v, f, Matrix.Translation((cxn, 0, (boxes[0][0] + boxes[0][1]) / 2)) @ face_m, "aluminium_brushed")
    v, f = bl.svg_mesh_flat(os.path.join(bl.LOGOS, "TRS-80_logo.svg"), pw * 0.62, (boxes[0][0] - boxes[1][1]) * 0.45)
    text.add_mesh_data(v, f, Matrix.Translation((cxn, 0, (boxes[0][0] + boxes[1][1]) / 2)) @ face_m, "ink_black")
    for s_, z, size, mat in (("VIDEO", (boxes[1][0] + boxes[1][1]) / 2 + 4.0, 4.2, "aluminium_brushed"),
                             ("DISPLAY", (boxes[1][0] + boxes[1][1]) / 2 - 4.0, 4.2, "aluminium_brushed")):
        # in Michroma (assets/fonts, OFL), the plate's wide, extended sans
        v, f = bl.glyph_mesh_flat(s_, size * 2.0, font=bl.FONT_PLATE, max_width_mm=pw * 0.84, bold_mm=0.1)
        text.add_mesh_data(v, f, Matrix.Translation((cxn, 0, z)) @ face_m, mat)
    plabel = d["power_label"]
    v, f = bl.glyph_mesh_flat(plabel["text"], plabel["height"]["v"] * 1.35)   # the font's cap height is about 0.74 of its size
    text.add_mesh_data(v, f, Matrix.Translation((bxc, -0.1, bzc + plabel["z_above_button"]["v"])) @ Matrix.Rotation(math.pi / 2, 4, "X"), "ink_silver")
    txo = text.build("_text", col)
    shapes.shade_auto(inner)
    front = shapes.merge("display.front", [inner, to, backing, panel, ro, po, txo], col)
    bl.set_labels(front, "Video Display, inner shell: the dark case round the tube, with the screen, the power button and the name plate")
    bl.parent(front, root)

    # --- the tube's face: UV-mapped for the page's picture ------------------------------
    def y_of(u, v):
        return on_glass(tx0 + u * (tx1 - tx0), tz0 + v * (tz1 - tz0))

    scr = shapes.uv_grid("display.screen", col, tx0, tx1, tz0, tz1, y_of, "crt_glass", nx=48, nz=36, corner_r=tr, warp=bowed)
    bl.set_labels(scr, "The picture tube: 64 characters by 16 lines, read from 1,024 bytes of memory")
    scr["motion"] = "screen"

    # --- the dark rim round the glass: a band on the glass, just inside its outline -------
    rw = tf["rim"]["width"]["v"]
    outer_rim = [bowed(x, z) for x, z in shapes.densify(rounded_rect(tx0, tz0, tx1, tz1, tr, 16), 3.0)]
    nr = len(outer_rim)
    inner_rim = []
    for i in range(nr):
        (ax, az), (bx_, bz_) = outer_rim[i - 1], outer_rim[(i + 1) % nr]
        tx_, tz_ = bx_ - ax, bz_ - az
        L = math.hypot(tx_, tz_) or 1.0
        # the outline runs counter-clockwise (seen from the front), so inward is to the left
        nx_, nz_ = -tz_ / L, tx_ / L
        x, z = outer_rim[i]
        inner_rim.append((x + nx_ * rw, z + nz_ * rw))
    rb_ = MeshBuilder()
    mi_ = rb_._mat("crt_rim")
    for (x, z) in outer_rim + inner_rim:
        rb_.verts.append((x, on_glass(x, z) - 0.3, z))
    for i in range(nr):
        j = (i + 1) % nr
        rb_._add([i, j, nr + j, nr + i], mi_, True)
    rim_o = rb_.build("display.screen_rim", col)
    me_ = rim_o.data
    if sum(f.normal.y for f in me_.polygons) > 0:   # face the viewer (-Y)
        me_.flip_normals()
    bl.set_labels(rim_o, "The dark rim round the tube's face")
    bl.parent(rim_o, root)
    scr["picture"] = [tx0, tz0, tx1, tz1]
    bl.parent(scr, root)

    # --- controls -------------------------------------------------------------------------
    # the red button: radius 5 mm, standing pb.height proud of the casing's surface (y = 0)
    btn = MeshBuilder()
    bh_ = pb["height"]["v"]
    btn.lathe([(0.0, -bh_), (pb["radius"]["v"] - 0.8, -bh_), (pb["radius"]["v"] - 0.2, -bh_ + 0.4),
               (pb["radius"]["v"], -bh_ + 1.0), (pb["radius"]["v"], 3.0), (0.0, 3.0)], 28, "button_red", axis="Y")
    bo = btn.build("display.power_button", col, location_mm=(bxc, 0.0, bzc))
    bl.set_motion(bo, "translate", (0, 1, 0), "Video Display power: push on, push off", unit="mm")
    bo["travel"] = 2.0
    bl.parent(bo, root)
    # C and B: contrast and brightness, shafts recessed in silver bushings; V: the video
    # cable's entry, a plain dark opening (the cable comes out of it: build_desk.py)
    ri, ro_ = fc["bushing_radius"]["v"]
    bp = fc["bushing_proud"]["v"]
    sr_ = fc["shaft"]["radius"]["v"]
    srec = fc["shaft"]["recess"]["v"]
    for (kx, kz), nm in zip(d["knobs"]["v"][:2], ["contrast", "brightness"]):
        k = MeshBuilder()
        # the bushing stands bp proud, through a slightly larger hole in the panel, with a
        # rounded lip at its front; the shaft sits srec behind that front face
        # a thin-walled tube: out along the outer wall, across the lip, back in along the bore.
        # This order matters: lathe() orients faces by the profile's ends, which are level
        # here, and only the outer-wall-first order gives outward faces on both walls
        k.lathe([(ro_, 8.0), (ro_, -bp + 0.6), (ro_ - 0.15, -bp + 0.15), (ro_ - 0.6, -bp), (ri + 0.3, -bp), (ri, -bp + 0.3), (ri, 8.0)], 40, "knob_chrome", axis="Y")
        sf = -bp + srec
        k.lathe([(0.0, sf), (sr_ - 0.3, sf), (sr_, sf + 0.3), (sr_, 9.0), (0.0, 9.0)], 20, "plastic_black", axis="Y")
        k.prism([(-sr_ * 0.9, sf - 0.05), (sr_ * 0.9, sf - 0.05), (sr_ * 0.9, sf + 0.6), (-sr_ * 0.9, sf + 0.6)], "XY", -0.35, 0.35, "ic_black")
        # a dark nut on the bushing, deep in the panel's hole (it fills the gap seen as a shadow)
        k.lathe([(ro_, 3.0), (ro_ + 0.6, 2.4), (ro_ + 0.6, 1.2)], 32, "plastic_black", axis="Y")
        ko = k.build(f"display.control.{nm}", col, location_mm=(kx, 0, kz))
        bl.set_labels(ko, f"{nm.capitalize()} control ({'C' if nm == 'contrast' else 'B'}): a shaft recessed in a silver bushing")
        bl.parent(ko, root)
    letters = MeshBuilder()
    fl = fc["letters"]
    for (lx, lz), ch in zip(d["knobs"]["v"], fl["v"]):
        v, f = bl.glyph_mesh_flat(ch, fl["height"]["v"] * 1.35)
        letters.add_mesh_data(v, f, Matrix.Translation((lx, -0.05, lz + fl["z_above"]["v"])) @ Matrix.Rotation(math.pi / 2, 4, "X"), "ink_black")
    lo_ = letters.build("display.control_letters", col)
    bl.set_labels(lo_, "C: contrast, B: brightness, V: the video cable")
    bl.parent(lo_, cab)

    # --- the base: a plinth under it all, part of the outer shell; no feet ------------------
    b = d["base"]
    bh, bi, bt = b["height"]["v"], b["inset"]["v"], b["taper"]["v"]
    for o in list(root.children):
        o.location.z += bh * bl.MM
    plinth = MeshBuilder()
    plinth.hexa([(-W2 + bi + bt, bi + bt, 0), (W2 - bi - bt, bi + bt, 0), (W2 - bi - bt, D - bi - bt, 0), (-W2 + bi + bt, D - bi - bt, 0)],
                [(-W2 + bi, bi, bh + 0.5), (W2 - bi, bi, bh + 0.5), (W2 - bi, D - bi, bh + 0.5), (-W2 + bi, D - bi, bh + 0.5)], "case_silver")
    po = plinth.build("display.base", col)
    bl.set_labels(po, "The Video Display's base, part of its outer shell")
    bl.parent(po, cab)
    return root


if __name__ == "__main__":
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("unit.display", col)
    build(params.load(), col, root)
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"DISPLAY_OK objects={len(bpy.data.objects)} triangles~{tris}")
