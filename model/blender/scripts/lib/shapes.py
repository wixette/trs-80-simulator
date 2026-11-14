# SPDX-License-Identifier: Apache-2.0
"""Shape helpers for the TRS-80 builds: rounded outlines, polyline offsets, booleans that
leave a plain mesh behind, and a UV-mapped grid for the CRT face."""

import math

import bpy

from .bl import MM, MeshBuilder, material


def rounded_rect(x0, y0, x1, y1, r, n=6):
    """A rectangle with rounded corners, counter-clockwise (mm)."""
    r = min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3)
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def offset_polyline(pts, d):
    """Offset an open polyline by d to its right (seen walking along it): for a profile
    drawn front to back over the top, that is downward, into the part."""
    out = []
    n = len(pts)
    for i in range(n):
        p = pts[i]
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1.0
        nx, ny = ty / L, -tx / L
        out.append((p[0] + nx * d, p[1] + ny * d))
    return out


def solid(name, mb, col):
    return mb.build(name, col)


def boolean(obj, cutters, op="DIFFERENCE"):
    """Apply booleans (DIFFERENCE, UNION or INTERSECT) of obj with each cutter in turn,
    leaving obj a plain mesh; the cutters are deleted."""
    if not isinstance(cutters, (list, tuple)):
        cutters = [cutters]
    mats = list(obj.data.materials)
    for c in cutters:
        mod = obj.modifiers.new("b", "BOOLEAN")
        mod.operation = op
        mod.solver = "EXACT"
        mod.object = c
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
        old = obj.data
        obj.modifiers.remove(mod)
        obj.data = me
        bpy.data.meshes.remove(old)
        me_c = c.data
        bpy.data.objects.remove(c)
        if me_c.users == 0:
            bpy.data.meshes.remove(me_c)
    # keep the target's own materials first (cut faces take the cutter's slot otherwise)
    for i, m in enumerate(mats):
        if i < len(obj.data.materials):
            obj.data.materials[i] = m
    return obj


def prism_obj(name, poly, plane, t0, t1, mat, col, offset=(0, 0, 0)):
    mb = MeshBuilder()
    mb.prism(poly, plane, t0, t1, mat, offset=offset)
    return mb.build(name, col)


def box_obj(name, x0, y0, z0, x1, y1, z1, mat, col):
    return prism_obj(name, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "XY", z0, z1, mat, col)


def recolour_faces(obj, mat_name, test):
    """Give every face whose centre (mm) passes test(x, y, z) the material mat_name."""
    me = obj.data
    if mat_name not in [m.name for m in me.materials]:
        me.materials.append(material(mat_name))
    idx = [m.name for m in me.materials].index(mat_name)
    for f in me.polygons:
        c = f.center / MM
        if test(c.x, c.y, c.z):
            f.material_index = idx


def uv_grid(name, col, x0, x1, z0, z1, y_of, mat, nx=24, nz=18, corner_r=0.0, warp=None):
    """A surface facing -Y (toward the viewer) over the rounded rectangle [x0, x1] x [z0, z1]
    (corner radius corner_r), at depth y_of(u, v) (mm, u and v in 0..1), with UVs 0..1 across
    the rectangle. An even grid whose corner squares are mapped smoothly onto quarter discs
    (the elliptical square-to-disc mapping): exact rounded corners, no folded cells, even
    shading on a glossy surface. warp(x, z) -> (x, z), if given, then reshapes the outline
    (a bowed edge); the UVs stay those of the unwarped rectangle, y_of gets the warped point."""
    r = min(corner_r, (x1 - x0) / 2, (z1 - z0) / 2)

    def place(x, z):
        if r <= 0:
            return x, z
        cx = x0 + r if x < x0 + r else (x1 - r if x > x1 - r else None)
        cz = z0 + r if z < z0 + r else (z1 - r if z > z1 - r else None)
        if cx is None or cz is None:
            return x, z
        sx, sz = (x - cx) / r, (z - cz) / r          # -1..1 within the corner square
        mx = sx * math.sqrt(max(0.0, 1 - sz * sz / 2))
        mz = sz * math.sqrt(max(0.0, 1 - sx * sx / 2))
        return cx + mx * r, cz + mz * r

    verts, uvs, faces = [], [], []
    idx = {}
    for j in range(nz + 1):
        for i in range(nx + 1):
            x, z = place(x0 + i / nx * (x1 - x0), z0 + j / nz * (z1 - z0))
            u, v = (x - x0) / (x1 - x0), (z - z0) / (z1 - z0)
            if warp:
                x, z = warp(x, z)
            idx[(i, j)] = len(verts)
            verts.append((x * MM, y_of((x - x0) / (x1 - x0), (z - z0) / (z1 - z0)) * MM, z * MM))
            uvs.append((u, v))
    for j in range(nz):
        for i in range(nx):
            # counter-clockwise seen from -Y, so the face's normal points at the viewer
            faces.append((idx[(i, j)], idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name="UVMap")
    for f in me.polygons:
        for li in f.loop_indices:
            uv.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(material(mat))
    for f in me.polygons:
        f.use_smooth = True
    me.validate()
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def merge(name, objs, col):
    """Join objects (keeping each face's material) into one new object; the inputs are deleted."""
    verts, faces, mat_names, mat_idx, smooth = [], [], [], [], []
    for o in objs:
        me = o.data
        names = [m.name for m in me.materials]
        base = len(verts)
        for vv in me.vertices:
            verts.append(tuple(vv.co + o.location))
        for f in me.polygons:
            faces.append([base + i for i in f.vertices])
            smooth.append(f.use_smooth)
            nm = names[f.material_index] if names else "case_silver"
            if nm not in mat_names:
                mat_names.append(nm)
            mat_idx.append(mat_names.index(nm))
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for nm in mat_names:
        me.materials.append(material(nm))
    me.polygons.foreach_set("material_index", mat_idx)
    me.polygons.foreach_set("use_smooth", smooth)
    me.validate()
    if hasattr(me, "set_sharp_from_angle"):
        import math as _m
        me.set_sharp_from_angle(angle=_m.radians(40))
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def rounded_rect_corners(x0, y0, x1, y1, r_bl, r_br, r_tr, r_tl, n=8):
    """A rectangle with its own radius at each corner (bottom-left, bottom-right, top-right,
    top-left), counter-clockwise; a radius of 0 leaves that corner sharp."""
    pts = []
    for cx, cy, r, a0 in ((x1, y0, r_br, -90), (x1, y1, r_tr, 0), (x0, y1, r_tl, 90), (x0, y0, r_bl, 180)):
        if r <= 0:
            pts.append((cx, cy))
            continue
        ox = cx - r if cx == x1 else cx + r
        oy = cy - r if cy == y1 else cy + r
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def shade_auto(obj, angle_deg=30.0):
    """Smooth shading split at edges sharper than angle_deg: flat faces stay flat, rounded
    corners shade smoothly. Booleans can leave a mesh's faces all smooth, which streaks
    large flat faces with the normals of the curves beside them."""
    me = obj.data
    for f in me.polygons:
        f.use_smooth = True
    if hasattr(me, "set_sharp_from_angle"):
        me.set_sharp_from_angle(angle=math.radians(angle_deg))


def densify(pts, step=4.0):
    """A closed outline with extra points on every segment longer than step (mm), so a later
    warp (a bowed edge) or a curved surface it is laid on is followed, not cut by chords."""
    out = []
    n = len(pts)
    for i in range(n):
        (ax, az), (bx, bz) = pts[i], pts[(i + 1) % n]
        k = max(1, int(math.ceil(math.hypot(bx - ax, bz - az) / step)))
        for j in range(k):
            t = j / k
            out.append((ax + (bx - ax) * t, az + (bz - az) * t))
    return out


def ring_points(x0, z0, x1, z1, r, n_arc, n_side):
    """Points round a rounded rectangle, counter-clockwise from the bottom edge's start:
    n_side points along each straight edge and n_arc + 1 on each corner arc, whatever its
    size, so two such outlines (a tunnel's ends) pair up point for point."""
    r = max(min(r, (x1 - x0) / 2, (z1 - z0) / 2), 1e-4)
    pts = []
    corners = ((x1 - r, z0 + r, -90), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180))
    starts = [(x0 + r, z0), (x1, z0 + r), (x1 - r, z1), (x0, z1 - r)]
    ends = [(x1 - r, z0), (x1, z1 - r), (x0 + r, z1), (x0, z0 + r)]
    for k in range(4):
        (sx, sz), (ex, ez) = starts[k], ends[k]
        for i in range(n_side):
            t = i / n_side
            pts.append((sx + (ex - sx) * t, sz + (ez - sz) * t))
        cx, cz, a0 = corners[k]
        for i in range(n_arc + 1):
            a = math.radians(a0 + 90 * i / n_arc)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts
