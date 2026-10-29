"""Builds the dance hall and exports it to public/models/hall.glb.

Run headless:  blender --background --python blender/build_hall.py
Dimensions come from src/world/layout.json, shared with the app's collisions.
Everything is modelled in the app's coordinates (metres, y up) and converted to Blender's
z-up frame on creation, so the glTF export (which converts back) lands exactly on the layout.
Objects sharing a material are joined, so the hall costs one draw call per material.
"""
import json
import math
import os
import random

import bmesh
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, "src", "world", "layout.json")))
OUT = os.path.join(ROOT, "public", "models", "hall.glb")

I = L["interior"]
WALL = 0.3
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- materials ----------

MATERIALS = {}


def material(name, colour, roughness=0.6, metallic=0.0, emission=None, strength=0.0, vertex_colours=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if vertex_colours:
        attr = m.node_tree.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Color"
        m.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    MATERIALS[name] = m
    return m


# Linear colours. Names are what the app keys its procedural textures on.
material("FloorWood", (1, 1, 1), 0.35, vertex_colours=True)
material("PanelWood", (0.16, 0.075, 0.035), 0.45)
material("TrimWood", (0.11, 0.05, 0.022), 0.4)
material("Plaster", (0.62, 0.52, 0.40), 0.9)
material("Paint", (0.80, 0.76, 0.68), 0.6)
material("Beam", (0.09, 0.045, 0.02), 0.7)
material("WindowNight", (0.01, 0.015, 0.03), 0.08, emission=(0.03, 0.06, 0.14), strength=1.0)
material("Curtain", (0.24, 0.02, 0.03), 0.85)
material("StageWood", (0.20, 0.10, 0.045), 0.5)
material("Brass", (0.75, 0.52, 0.22), 0.3, metallic=1.0)
material("LampShade", (0.85, 0.72, 0.5), 0.8, emission=(1.0, 0.72, 0.42), strength=1.5)
material("LampBulb", (1, 0.9, 0.7), 0.3, emission=(1.0, 0.78, 0.5), strength=12.0)
material("BenchWood", (0.13, 0.065, 0.03), 0.55)

# ---------- helpers (app coordinates: x along the hall, y up, z across) ----------

PARTS = {name: [] for name in MATERIALS}


def to_blender(x, y, z):
    return (x, -z, y)


def box(mat, x0, x1, y0, y1, z0, z1):
    """Axis-aligned box from min/max corners in app coordinates."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        x = x0 + (v.co.x + 0.5) * (x1 - x0)
        y = y0 + (v.co.z + 0.5) * (y1 - y0)
        z = z0 + (-v.co.y + 0.5) * (z1 - z0)
        v.co = to_blender(x, y, z)
    add_mesh(mat, bm)


def add_mesh(mat, bm):
    mesh = bpy.data.meshes.new(mat)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(mat, mesh)
    scene.collection.objects.link(obj)
    PARTS[mat].append(obj)
    return obj


def cylinder(mat, x, y0, y1, z, r0, r1=None, segments=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r0, radius2=r1 if r1 is not None else r0,
                          depth=y1 - y0)
    for v in bm.verts:
        v.co = to_blender(x + v.co.x, (y0 + y1) / 2 + v.co.z, z - v.co.y)
    add_mesh(mat, bm)


def sphere(mat, x, y, z, r):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
    for v in bm.verts:
        v.co = to_blender(x + v.co.x, y + v.co.z, z - v.co.y)
    add_mesh(mat, bm)


# ---------- floor ----------

def floor():
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    uv = bm.loops.layers.uv.new("UVMap")

    def quad(x0, x1, z0, z1, colour, y=0.0):
        # Grain runs along x; each board gets its own patch of the grain texture.
        du, dv = random.random() * 4, random.random() * 4
        corners = ((x0, z0), (x0, z1), (x1, z1), (x1, z0))
        vs = [bm.verts.new(to_blender(x, y, z)) for x, z in corners]
        f = bm.faces.new(vs)
        for loop, (x, z) in zip(f.loops, corners):
            loop[col] = colour
            loop[uv].uv = (x / 3.0 + du, (z - z0) / 1.2 + dv)

    def oak():
        k = random.uniform(0.84, 1.1)
        warm = random.uniform(-0.015, 0.015)
        return (0.30 * k + warm, 0.185 * k, 0.095 * k - warm, 1.0)

    border = 0.32
    plank_w, gap = 0.14, 0.004
    x0, x1 = L["stage"]["maxX"] - 0.2, I["maxX"]
    z0, z1 = I["minZ"], I["maxZ"]
    # Planks run along the hall, the way the set runs.
    z = z0 + border
    while z < z1 - border - 1e-6:
        zz = min(z + plank_w, z1 - border)
        x = x0 + border - random.uniform(0, 3.0)
        while x < x1 - border:
            xx = x + random.uniform(1.2, 3.4)
            a, b = max(x, x0 + border), min(xx, x1 - border)
            if b - a > 0.05:
                quad(a + gap / 2, b - gap / 2, z + gap / 2, zz - gap / 2, oak())
            x = xx
        z = zz
    # Darker border boards and the underlay that shows through the gaps.
    dark = (0.12, 0.06, 0.03, 1.0)
    quad(x0, x1, z0, z0 + border, dark)
    quad(x0, x1, z1 - border, z1, dark)
    quad(x0, x0 + border, z0 + border, z1 - border, dark)
    quad(x1 - border, x1, z0 + border, z1 - border, dark)
    quad(x0, x1, z0, z1, (0.05, 0.03, 0.015, 1.0), y=-0.003)
    add_mesh("FloorWood", bm)


# ---------- walls ----------

def walls():
    h = I["height"]
    # Shells, just outside the interior.
    box("Plaster", I["minX"] - WALL, I["maxX"] + WALL, 0, h, I["minZ"] - WALL, I["minZ"])
    box("Plaster", I["minX"] - WALL, I["maxX"] + WALL, 0, h, I["maxZ"], I["maxZ"] + WALL)
    box("Plaster", I["minX"] - WALL, I["minX"], 0, h, I["minZ"], I["maxZ"])
    box("Plaster", I["maxX"], I["maxX"] + WALL, 0, h, I["minZ"], I["maxZ"])
    # Ceiling and its beams.
    box("Plaster", I["minX"], I["maxX"], h, h + 0.2, I["minZ"], I["maxZ"])
    beams = L["beams"]
    x = I["minX"] + beams["spacing"] / 2
    while x < I["maxX"]:
        box("Beam", x - beams["width"] / 2, x + beams["width"] / 2, h - beams["depth"], h, I["minZ"], I["maxZ"])
        x += beams["spacing"]
    # Cornice.
    for zs in ((I["minZ"], I["minZ"] + 0.16), (I["maxZ"] - 0.16, I["maxZ"])):
        box("Paint", I["minX"], I["maxX"], h - 0.28, h, *zs)
    for xs in ((I["minX"], I["minX"] + 0.16), (I["maxX"] - 0.16, I["maxX"])):
        box("Paint", *xs, h - 0.28, h, I["minZ"], I["maxZ"])


def wainscot_run(axis, fixed, inward, a0, a1, skip=()):
    """Panelling along one wall: axis 'x' runs along x at z=fixed, 'z' along z at x=fixed."""
    wh = L["wainscotHeight"]

    def slab(mat, s0, s1, y0, y1, d0, d1):
        if axis == "x":
            box(mat, s0, s1, y0, y1, fixed + inward * d0, fixed + inward * d1) if inward > 0 else \
                box(mat, s0, s1, y0, y1, fixed + inward * d1, fixed + inward * d0)
        else:
            box(mat, fixed + inward * d0, fixed + inward * d1, y0, y1, s0, s1) if inward > 0 else \
                box(mat, fixed + inward * d1, fixed + inward * d0, y0, y1, s0, s1)

    spans = [(a0, a1)]
    for s0, s1 in skip:
        spans = [piece for (p0, p1) in spans for piece in ((p0, min(p1, s0)), (max(p0, s1), p1)) if piece[1] - piece[0] > 0.05]
    for p0, p1 in spans:
        slab("PanelWood", p0, p1, 0, wh, 0, 0.03)
        slab("TrimWood", p0, p1, 0, 0.16, 0.03, 0.05)          # skirting
        slab("TrimWood", p0, p1, wh - 0.05, wh + 0.03, 0.03, 0.07)  # dado rail
        n = max(1, round((p1 - p0) / 1.1))
        w = (p1 - p0) / n
        for i in range(n):
            s = p0 + i * w
            slab("TrimWood", s + 0.09, s + w - 0.09, 0.28, wh - 0.14, 0.03, 0.045)


def panelling():
    stage_top = L["stage"]["height"]
    door = L["doors"]
    wainscot_run("x", I["minZ"], 1, L["stage"]["maxX"], I["maxX"])
    wainscot_run("x", I["maxZ"], -1, L["stage"]["maxX"], I["maxX"])
    wainscot_run("z", I["maxX"], -1, I["minZ"], I["maxZ"], skip=[(-door["width"] / 2 - 0.15, door["width"] / 2 + 0.15)])
    del stage_top


def windows():
    w = L["windows"]
    for x in w["xs"]:
        for z, inward in ((I["minZ"], 1), (I["maxZ"], -1)):
            y0, y1 = w["sill"], w["sill"] + w["height"]
            x0, x1 = x - w["width"] / 2, x + w["width"] / 2

            def inset(d0, d1):
                return (z + inward * d0, z + inward * d1) if inward > 0 else (z + inward * d1, z + inward * d0)

            box("WindowNight", x0, x1, y0, y1, *inset(0.0, 0.02))
            f = 0.09
            for (a0, a1, b0, b1) in ((x0 - f, x1 + f, y0 - f, y0), (x0 - f, x1 + f, y1, y1 + f),
                                     (x0 - f, x0, y0, y1), (x1, x1 + f, y0, y1)):
                box("Paint", a0, a1, b0, b1, *inset(0.0, 0.07))
            # Glazing bars: one upright, two transoms.
            box("Paint", x - 0.025, x + 0.025, y0, y1, *inset(0.02, 0.05))
            for k in (1, 2):
                yy = y0 + k * (y1 - y0) / 3
                box("Paint", x0, x1, yy - 0.025, yy + 0.025, *inset(0.02, 0.05))
            box("Paint", x0 - 0.15, x1 + 0.15, y0 - 0.12, y0 - f, *inset(0.0, 0.16))  # sill


def doors():
    d = L["doors"]
    x = I["maxX"]
    half = d["width"] / 2
    box("TrimWood", x - 0.08, x, 0, d["height"] + 0.14, -half - 0.14, half + 0.14)
    for z0, z1 in ((-half, -0.01), (0.01, half)):
        box("PanelWood", x - 0.1, x - 0.08, 0, d["height"], z0, z1)
        for y0, y1 in ((0.25, 1.15), (1.35, d["height"] - 0.2)):
            box("TrimWood", x - 0.115, x - 0.1, y0, y1, z0 + 0.14, z1 - 0.14)
        zh = z1 - 0.12 if z0 < 0 else z0 + 0.12
        box("Brass", x - 0.16, x - 0.1, 1.0, 1.04, zh - 0.08, zh + 0.08)


def stage():
    s = L["stage"]
    h = s["height"]
    box("StageWood", s["minX"], s["maxX"], 0, h, s["minZ"], s["maxZ"])
    box("TrimWood", s["maxX"] - 0.02, s["maxX"] + 0.03, h - 0.06, h + 0.02, s["minZ"], s["maxZ"])  # nosing
    # Fascia panels on the stage front.
    n = 10
    w = (s["maxZ"] - s["minZ"]) / n
    for i in range(n):
        z = s["minZ"] + i * w
        box("TrimWood", s["maxX"], s["maxX"] + 0.015, 0.12, h - 0.14, z + 0.12, z + w - 0.12)
    st = L["steps"]
    for k in range(st["count"]):
        top = h * (st["count"] - k) / (st["count"] + 1) + h / (st["count"] + 1)
        depth = (st["maxX"] - st["minX"]) / st["count"]
        box("StageWood", st["minX"], st["minX"] + depth * (k + 1), 0, top, st["minZ"], st["maxZ"])
    curtains(s)


def curtains(s):
    """Folded velvet: a backdrop on the back wall and a pair of legs at the sides."""
    top = I["height"] - 0.3

    def drape(x_face, z0, z1, depth, folds):
        bm = bmesh.new()
        cols = int((z1 - z0) / 0.06)
        rows = 2
        grid = []
        for r in range(rows):
            y = s["height"] + (top - s["height"]) * r / (rows - 1)
            row = []
            for c in range(cols + 1):
                z = z0 + (z1 - z0) * c / cols
                x = x_face + depth * (0.5 + 0.5 * math.sin(c / cols * folds * 2 * math.pi))
                row.append(bm.verts.new(to_blender(x, y, z)))
            grid.append(row)
        for c in range(cols):
            bm.faces.new((grid[0][c], grid[0][c + 1], grid[1][c + 1], grid[1][c]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        add_mesh("Curtain", bm)

    drape(s["minX"] + 0.05, s["minZ"] + 0.3, s["maxZ"] - 0.3, 0.16, 26)
    drape(s["maxX"] - 0.6, s["minZ"], s["minZ"] + 1.6, 0.14, 4)
    drape(s["maxX"] - 0.6, s["maxZ"] - 1.6, s["maxZ"], 0.14, 4)
    # Pelmet across the top of the stage.
    box("Curtain", s["maxX"] - 0.7, s["maxX"] - 0.45, top - 0.7, top + 0.3, s["minZ"], s["maxZ"])


def benches():
    b = L["benches"]
    for x in b["xs"]:
        for wall_z, inward in ((I["minZ"], 1), (I["maxZ"], -1)):
            z_near = wall_z + inward * b["gap"]
            z_far = z_near + inward * b["depth"]
            z0, z1 = sorted((z_near, z_far))
            x0, x1 = x - b["length"] / 2, x + b["length"] / 2
            box("BenchWood", x0, x1, b["seat"] - 0.05, b["seat"], z0, z1)
            for lx in (x0 + 0.08, x1 - 0.12):
                box("BenchWood", lx, lx + 0.04, 0, b["seat"] - 0.05, z0 + 0.04, z1 - 0.04)
            box("BenchWood", x0 + 0.08, x1 - 0.08, 0.12, 0.16, (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02)


def lamps():
    h = I["height"]
    for x, z in L["lamps"]:
        y = L["lampHang"]
        cylinder("Brass", x, y + 0.3, h - 0.35, z, 0.012)
        cylinder("Brass", x, h - 0.37, h - 0.33, z, 0.08)
        cylinder("LampShade", x, y - 0.05, y + 0.3, z, 0.36, 0.12, segments=32)
        sphere("LampBulb", x, y + 0.02, z, 0.09)


floor()
walls()
panelling()
windows()
doors()
stage()
benches()
lamps()

# Join everything that shares a material, one object per material.
for name, objs in PARTS.items():
    if not objs:
        continue
    for o in objs:
        o.data.materials.append(MATERIALS[name])
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False)
print(f"Exported {OUT}")
