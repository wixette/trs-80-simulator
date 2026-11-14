# SPDX-License-Identifier: Apache-2.0
"""Preview renders for checking the model against the reference photos.

  Blender --background --factory-startup --python render_previews.py -- [keyboard|display|recorder|desk] [all|<view>]
Writes PNGs to blender/out/previews/ (git-ignored). Workbench, studio light, cavity on,
so shapes read clearly; the browser page is the place for materials.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import bl, params  # noqa: E402
from lib.bl import MM  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "blender", "out", "previews")


def camera(name, loc_mm, target_mm, lens=50, ortho_mm=None):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_start = 0.002
    if ortho_mm:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_mm * MM
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(loc_mm) * MM
    d = Vector(target_mm) - Vector(loc_mm)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return cam


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.display.shading.show_specular_highlight = True
    world = bpy.data.worlds.new("w")
    world.color = (0.36, 0.48, 0.52)   # like the photos' blue-green backdrop
    sc.world = world


def render(cam, name, res=(1600, 1000)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.camera = cam
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)


def move(name, dz=0.0, dy=0.0, flip=False):
    o = bpy.data.objects[name]
    o.location = (o.location[0], o.location[1] + dy * MM, o.location[2] + dz * MM)
    if flip:
        o.rotation_euler = (0.0, 3.14159265, 0.0)


def keyboard_views(which):
    import build_keyboard_unit as kbu
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("unit.keyboard", col)
    kbu.build(params.load(), col, root)
    setup_render()
    views = {
        "front34": lambda: render(camera("c", (-430, -560, 330), (-10, 0, 30), 42), "k01_front_three_quarter.png"),
        "front": lambda: render(camera("c", (0, -620, 520), (0, -10, 35), 50), "k02_front_elevated.png"),
        "rear": lambda: render(camera("c", (60, 700, 160), (0, 0, 30), 45), "k03_rear.png", (1600, 700)),
        "rear34": lambda: render(camera("c", (520, 560, 330), (0, 0, 30), 42), "k04_rear_three_quarter.png"),
        "side": lambda: render(camera("c", (-900, 0, 40), (0, 0, 40), ortho_mm=260), "k05_side_ortho.png", (1300, 520)),
        "plate": lambda: render(camera("c", (0, -20, 150), (0, 38, 66), 50), "k11_name_plate.png"),
        "keys": lambda: render(camera("c", (60, -230, 190), (60, -10, 45), 50), "k06_keys_close.png"),
    }
    for k, f in views.items():
        if which in ("all", k):
            f()
    if which in ("all", "open"):
        move("case.top", dz=140)
        render(camera("c", (-430, -560, 430), (0, 0, 60), 40), "k07_top_off.png")
        move("keyboard", dz=95)
        render(camera("c", (-430, -560, 480), (0, 0, 70), 38), "k08_keyboard_up.png")
        bpy.data.objects["keyboard"].hide_render = True
        render(camera("c", (0, -300, 700), (0, 10, 20), 38), "k09_board_solder_side.png")
        move("board.main", dz=70, flip=True)
        render(camera("c", (-380, -520, 520), (0, 0, 70), 40), "k10_board_flipped.png")


def display_views(which):
    import build_video_display as bvd
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("unit.display", col)
    bvd.build(params.load(), col, root)
    setup_render()
    views = {
        "front": lambda: render(camera("c", (0, -900, 200), (0, 0, 152), 50), "d01_front.png", (1300, 1100)),
        "front34": lambda: render(camera("c", (-650, -800, 450), (0, 150, 140), 45), "d02_front_three_quarter.png"),
        "rear34": lambda: render(camera("c", (700, 1100, 450), (0, 150, 140), 45), "d03_rear_three_quarter.png"),
        "side": lambda: render(camera("c", (1200, 165, 152), (0, 165, 152), ortho_mm=460), "d04_side_ortho.png", (1300, 1000)),
        "groove": lambda: render(camera("c", (-260, -150, 400), (-190, 20, 290), 50), "d05_groove_top_front_corner.png"),
        "groove_low": lambda: render(camera("c", (-120, -260, 90), (-170, 10, 35), 50), "d06_groove_lower_front.png"),
        "corner_side": lambda: render(camera("c", (-620, 60, 330), (-200, 40, 250), 45), "d08_side_front_top_corner.png"),
        "corner_low": lambda: render(camera("c", (-330, -420, 60), (-200, 0, 30), 45), "d09_front_bottom_corner.png"),
        "vents_under": lambda: render(camera("c", (-90, -260, -60), (-40, 10, 15), 45), "d10_vents_from_below.png"),
        "vents_close": lambda: render(camera("c", (-60, -150, 45), (-60, 0, 30), 50), "d11_vents_close.png"),
        "screen_corner": lambda: render(camera("c", (-150, -140, 110), (-160, 20, 92), 50), "d12_screen_corner.png"),
        "bulge": lambda: render(camera("c", (-430, -110, 185), (-40, 30, 175), 40), "d13_glass_bulge.png"),
        "photo": lambda: render(camera("c", (-10, -620, 360), (-10, 0, 170), 50), "d14_like_reference_photo.png", (1430, 750)),
        "right_panel": lambda: render(camera("c", (60, -420, 230), (139, 0, 175), 50), "d17_right_panel.png", (900, 1300)),
        "button": lambda: render(camera("c", (105, -90, 285), (138, 0, 262), 50), "d18_power_button.png"),
        "u_corner": lambda: render(camera("c", (-150, -330, 120), (-185, 0, 60), 50), "d19_u_bottom_corner.png"),
        "controls": lambda: render(camera("c", (125, -150, 70), (138, 0, 36), 50), "d20_front_controls.png"),
        "top": lambda: render(camera("c", (0, 165, 1400), (0, 165, 0), ortho_mm=460), "d07_top_ortho.png", (1200, 1000)),
    }
    for k, f in views.items():
        if which in ("all", k):
            f()


def desk_views(which):
    import build_desk
    build_desk.build(params.load())
    setup_render()
    views = {
        "front34": lambda: render(camera("c", (-700, -900, 650), (60, 150, 120), 38), "s01_desk_front_three_quarter.png"),
        "front": lambda: render(camera("c", (0, -1100, 420), (40, 120, 140), 40), "s02_desk_front.png"),
        "rear34": lambda: render(camera("c", (900, 900, 600), (80, 150, 60), 38), "s03_desk_rear_three_quarter.png"),
        "video_cable": lambda: render(camera("c", (40, -40, 140), (160, 190, 30), 40), "s05_video_cable.png"),
        "recorder": lambda: render(camera("c", (520, -260, 300), (360, 40, 40), 45), "s04_recorder.png"),
        "recorder_top": lambda: render(camera("c", (360, 40, 700), (360, 40, 0), ortho_mm=270), "s06_recorder_top.png", (900, 1300)),
        "recorder_left": lambda: render(camera("c", (225, -60, 55), (293, 30, 14), 50), "s07_recorder_left_jacks.png"),
        "recorder_plugs": lambda: render(camera("c", (270, 30, 160), (290, 30, 13), ortho_mm=90), "s10_recorder_plugs_top.png"),
        "psu": lambda: render(camera("c", (200, 60, 160), (300, 250, 30), 40), "s11_power_supply.png"),
        "recorder_corner": lambda: render(camera("c", (470, -150, 110), (380, -70, 28), 40), "s09_recorder_front_corner.png"),
        "recorder_front": lambda: render(camera("c", (330, -260, 160), (360, 30, 30), 40), "s08_recorder_front.png"),
    }
    for k, f in views.items():
        if which in ("all", k):
            f()


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    unit = argv[0] if argv else "keyboard"
    which = argv[1] if len(argv) > 1 else "all"
    os.makedirs(OUT, exist_ok=True)
    if unit == "keyboard":
        keyboard_views(which)
    elif unit == "display":
        display_views(which)
    elif unit == "desk":
        desk_views(which)
    print("PREVIEWS_OK", OUT)
