# SPDX-License-Identifier: Apache-2.0
"""The whole TRS-80 Model I system on a desk, exported as one .glb for the page (pnpm build:model).

  Blender --background --factory-startup --python-exit-code 1 --python build_desk.py -- [--out PATH]

Places each unit's frame on the desk (machine.json desk; the keyboard unit's frame is the
desk's) and adds the three cables from the keyboard unit's rear sockets:
  unit.keyboard   build_keyboard_unit.py
  unit.display    build_video_display.py
  unit.recorder   build_peripherals.py
  unit.psu        build_peripherals.py
  cable.video, cable.tape, cable.power      (path: unplugged, back out of their sockets)
Writes model/trs80-model-i.glb.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import build_keyboard_unit as kbu  # noqa: E402
import build_peripherals as per  # noqa: E402
import build_video_display as bvd  # noqa: E402
from lib import bl, params  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402

DEFAULT_OUT = os.path.join(params.MACHINE_DIR, "trs80-model-i.glb")


def socket(ref):
    bd = kbu.load_json("board.json")
    q = next(x for x in bd["parts"] if x["ref"] == ref)
    zb = params.load().raw["main_board"]["board_z"]["v"]
    return ((q["body"][0] + q["body"][2]) / 2, q["body"][3], zb - q["height"] / 2)


def cable(name, label, ref, route, col, root, radius=2.4, leads=()):
    """A cable from socket `ref` on the keyboard unit's rear: a moulded plug, then the cord
    along `route` (desk mm); `leads` are (path, plug end, plug axis) branches from its end,
    each finishing in a jack plug (the cassette cable's three)."""
    x, y, z = socket(ref)
    mb = MeshBuilder()
    kbu.cyl(mb, x, y + 9.0, z, 6.8, "Y", 14.0, "plastic_black", 20)     # the plug's shell
    kbu.cyl(mb, x, y + 17.5, z, 4.0, "Y", 5.0, "plastic_black", 16)     # its strain relief
    bl.tube_path(mb, [(x, y + 19.0, z)] + route, radius, "cord_black", n=10, bend=14.0)
    for path, (px, py, pz), small in leads:
        # a moulded jack plug, entering the jack along +X: its body seated against the jack's
        # rim (px is the jack panel's face, the rim stands 0.8 mm proud of it), its metal tip
        # inside; the lead runs into the body's back
        ln, rb = (11.0, 3.0) if not small else (9.0, 2.4)
        x_front = px - 0.8
        kbu.cyl(mb, x_front - ln / 2, py, pz, rb, "X", ln, "plastic_black", 14)
        kbu.cyl(mb, x_front + 1.0, py, pz, rb * 0.45, "X", 2.0, "aluminium_brushed", 10)
        end = (x_front - ln + 1.5, py, pz)
        bl.tube_path(mb, [route[-1]] + path + [end], 1.5, "cord_black", n=8, bend=6.0)
    o = mb.build(name, col)
    bl.set_labels(o, label)
    bl.set_path(o, [(0, 60, 0)])
    bl.parent(o, root)
    return o


def build(p):
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("trs80", col)
    desk = p.raw["desk"]
    kb = bl.empty("unit.keyboard", col)
    bl.parent(kb, root)
    kbu.build(p, col, kb)
    # each unit is built in its own frame at the origin, then its empty is moved to its
    # place on the desk (bl.parent keeps world positions, so the order matters)
    units = []
    for name, key, fn in (("unit.display", "video_display", bvd.build),
                          ("unit.recorder", "recorder", per.build_recorder),
                          ("unit.psu", "power_supply", per.build_psu)):
        e = bl.empty(name, col)
        fn(p, col, e)
        units.append((e, desk[key]["v"]))
    for e, (x, y, z) in units:
        e.location = (x * bl.MM, y * bl.MM, z * bl.MM)
        bl.parent(e, root)
    # cables, in the desk frame
    dx, dy, _ = desk["video_display"]["v"]
    gx, gz = p.raw["video_display"]["knobs"]["v"][2]
    gz += p.raw["video_display"]["base"]["height"]["v"]   # the body stands on its base
    rx, ry, _ = desk["recorder"]["v"]
    rw, rd, rh = p.raw["recorder"]["size"]["v"]
    sx, sy, _ = desk["power_supply"]["v"]
    sw, sd, sh = p.raw["power_supply"]["size"]["v"]
    jx, _, _ = socket("J2")
    # it comes out of the centre of the Video Display's "V" opening, down to the desk and back
    # to the keyboard unit's VIDEO socket
    cable("cable.video", "Video cable: from the Video Display's V opening to the computer's VIDEO socket", "J2",
          [(jx, 135, 8), (dx + gx, dy - 45, 8), (dx + gx, dy - 22, gz), (dx + gx, dy + 8, gz)], col, root,
          radius=p.raw["video_display"]["front_controls"]["cable_radius"]["v"])
    jx, _, _ = socket("J3")
    # the cassette cable: round to the recorder's left side, where it splits into three plugs
    # for EAR, AUX and REM (machine.json recorder cable_jacks)
    rec = p.raw["recorder"]
    jacks = {j[0]: j for j in rec["side_jacks"]["v"]}
    xs = rx - rw / 2 + rec["sides"]["lower"]["inset"] + 0.8   # the jack panel's face (build_peripherals)
    ys = ry + jacks["AUX"][1]
    split = (xs - 30.0, ys, 6.0)
    leads = []
    for nm in rec["cable_jacks"]["v"]:
        _, jy, jz, kind = jacks[nm]
        leads.append(([(xs - 24.0, ry + jy, jz)], (xs, ry + jy, jz), kind == "jack_small"))
    cable("cable.tape", "Cassette cable: from the computer's TAPE socket to the recorder's EAR (data in), AUX (data out) and REM (the motor, switched by the computer)", "J3",
          [(jx, 128, 5), (xs - 45.0, 128, 5), (xs - 45.0, ys, 5), split], col, root, leads=leads)
    jx, _, _ = socket("J1")
    cable("cable.power", "Power cable: about 14 V AC from the power supply to the computer's POWER socket", "J1",
          [(jx, 150, 5), (sx - 20, 150, 5), (sx - 20, sy - sd / 2 - 30, 5), (sx, sy - sd / 2 - 30, 10), (sx, sy - sd / 2 - 3, 10)], col, root)
    return root


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_extras=True, export_apply=True,
        export_cameras=False, export_lights=False, **bl.EXPORT_IMAGES)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else DEFAULT_OUT
    p = params.load()
    build(p)
    export(out)
    tris = {}
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        u = o
        while u.parent and not u.parent.name.startswith("unit.") and u.parent.name != "trs80":
            u = u.parent
        key = u.parent.name if u.parent and u.parent.name.startswith("unit.") else o.name.split(".")[0]
        tris[key] = tris.get(key, 0) + sum(len(f.vertices) - 2 for f in o.data.polygons)
    total = sum(tris.values())
    print("DESK_BUILD_OK", out, f"{os.path.getsize(out) / 1e6:.2f} MB", f"triangles~{total}", json.dumps(tris))
