"""Shared figure building for the Blender scripts: materials, a skinned-mesh builder, the
dancers' skeleton, heads and arms, armatures and pose clips.

Imported by build_dancers.py and build_band.py (not a build script itself). Parts are modelled
in the app's coordinates (metres, y up, facing +z, the character's left is +x) and converted to
Blender's z-up frame.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24


def to_blender(x, y, z):
    return Vector((x, -z, y))


# ---------- materials ----------

MATS = {}


def material(name, colour, roughness=0.6, metallic=0.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    MATS[name] = m
    return m

# ---------- one character ----------


class Builder:
    """Accumulates one character's mesh: geometry, material per face, one bone weight set per vertex."""

    def __init__(self, bones, materials):
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.bones = bones
        self.mats = materials

    def vert(self, p, weights):
        v = self.bm.verts.new(to_blender(*p))
        for bone, w in weights:
            if w > 1e-4:
                v[self.deform][self.bones.index(bone)] = w
        return v

    def face(self, verts, mat, smooth=True, uvs=None):
        f = self.bm.faces.new(verts)
        f.material_index = self.mats.index(mat)
        f.smooth = smooth
        if uvs:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        return f

    def tube(self, mat, y0, y1, radius, weights, centre=(0.0, 0.0), segs=24, rings=1,
             cap_top=False, cap_bottom=False, uv_repeat=None, smooth=True, offset=None):
        """Ring-swept surface. radius(theta, v) -> (rx, rz); v runs 0 at y0 to 1 at y1.
        weights(v) -> [(bone, w)]; offset(v) -> (dx, dz) shifts each ring."""
        grid = []
        for r in range(rings + 1):
            v = r / rings
            y = y0 + (y1 - y0) * v
            dx, dz = offset(v) if offset else (0.0, 0.0)
            row = []
            for s in range(segs):
                th = 2 * math.pi * s / segs
                rx, rz = radius(th, v)
                row.append(self.vert((centre[0] + dx + rx * math.cos(th), y, centre[1] + dz + rz * math.sin(th)), weights(v)))
            grid.append(row)
        for r in range(rings):
            for s in range(segs):
                a, b = grid[r][s], grid[r][(s + 1) % segs]
                c, d = grid[r + 1][(s + 1) % segs], grid[r + 1][s]
                uvs = None
                if uv_repeat:
                    u0, u1 = s / segs * uv_repeat[0], (s + 1) / segs * uv_repeat[0]
                    v0, v1 = r / rings * uv_repeat[1], (r + 1) / rings * uv_repeat[1]
                    uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
                self.face([a, b, c, d], mat, smooth, uvs)
        if cap_bottom:
            self.face(list(reversed(grid[0])), mat, smooth)
        if cap_top:
            self.face(grid[-1], mat, smooth)

    def ball(self, mat, centre, radii, bone, u=16, v=10):
        cx, cy, cz = centre
        rows = []
        for i in range(v + 1):
            phi = math.pi * i / v
            row = []
            for j in range(u):
                th = 2 * math.pi * j / u
                p = (cx + radii[0] * math.sin(phi) * math.cos(th), cy - radii[1] * math.cos(phi),
                     cz + radii[2] * math.sin(phi) * math.sin(th))
                row.append(self.vert(p, [(bone, 1)]))
            rows.append(row)
        for i in range(v):
            for j in range(u):
                quad = [rows[i][j], rows[i][(j + 1) % u], rows[i + 1][(j + 1) % u], rows[i + 1][j]]
                if i == 0:
                    quad = [rows[0][j], rows[1][(j + 1) % u], rows[1][j]]
                elif i == v - 1:
                    quad = [rows[i][j], rows[i][(j + 1) % u], rows[i + 1][j]]
                try:
                    self.face(quad, mat)
                except ValueError:
                    pass

    def box(self, mat, mn, mx, bone, smooth=False):
        (x0, y0, z0), (x1, y1, z1) = mn, mx
        c = [self.vert((x, y, z), [(bone, 1)]) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.face([c[i] for i in idx], mat, smooth)


def ellipse(rx, rz):
    return lambda th, v: (rx, rz)


def taper(r0, r1):
    return lambda th, v: (r0[0] + (r1[0] - r0[0]) * v, r0[1] + (r1[1] - r0[1]) * v)


def rigid(bone):
    return lambda v: [(bone, 1)]


def blend(top, bottom, start=0.15):
    """Weights fading from `top` (v=1, upper ring) to `bottom` (v=0, hem)."""
    def w(v):
        k = min(1.0, max(0.0, (1 - v - start) / (1 - start)))
        k = k * k * (3 - 2 * k)
        return [(top, 1 - k), (bottom, k)]
    return w


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------- skeleton ----------

def skeleton(d, hem_bone, hem_top, hem_bottom):
    """Bone heads/tails in app coordinates, parents."""
    hy, hw, ank = d["hipHeight"], d["hipWidth"], d["ankleHeight"]
    k = d["height"] / 1.8
    knee = ank + d["shin"]
    s = {
        "root": ((0, 0, 0), (0, 0.1, 0), None),
        "hips": ((0, hy, 0), (0, hy + 0.14 * k, 0), "root"),
        "spine": ((0, hy + 0.14 * k, 0), (0, hy + 0.36 * k, 0), "hips"),
        "chest": ((0, hy + 0.36 * k, 0), (0, hy + 0.54 * k, 0), "spine"),
        "neck": ((0, hy + 0.54 * k, 0), (0, hy + 0.63 * k, 0), "chest"),
        "head": ((0, hy + 0.63 * k, 0), (0, d["height"], 0), "neck"),
        hem_bone: ((0, hem_top, 0), (0, hem_bottom, 0), "hips"),
    }
    sh = hy + 0.5 * k
    for side, sx in (("L", 1), ("R", -1)):
        s[f"thigh.{side}"] = ((sx * hw, hy, 0), (sx * hw, knee, 0.005), "hips")
        s[f"shin.{side}"] = ((sx * hw, knee, 0.005), (sx * hw, ank, 0), f"thigh.{side}")
        s[f"foot.{side}"] = ((sx * hw, ank, 0), (sx * hw, 0.025, 0.14 * k), f"shin.{side}")
        s[f"toe.{side}"] = ((sx * hw, 0.025, 0.14 * k), (sx * hw, 0.02, 0.19 * k), f"foot.{side}")
        s[f"upperarm.{side}"] = ((sx * 0.19 * k, sh, 0), (sx * 0.215 * k, sh - 0.29 * k, -0.01), "chest")
        s[f"forearm.{side}"] = ((sx * 0.215 * k, sh - 0.29 * k, -0.01), (sx * 0.225 * k, sh - 0.54 * k, 0.03), f"upperarm.{side}")
        s[f"hand.{side}"] = ((sx * 0.225 * k, sh - 0.54 * k, 0.03), (sx * 0.225 * k, sh - 0.63 * k, 0.04), f"forearm.{side}")
    return s


def make_armature(name, bones):
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (head, tail, _parent) in bones.items():
        eb = arm.edit_bones.new(bname)
        eb.head = to_blender(*head)
        eb.tail = to_blender(*tail)
    for bname, (_h, _t, parent) in bones.items():
        if parent:
            arm.edit_bones[bname].parent = arm.edit_bones[parent]
            arm.edit_bones[bname].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def finish(name, builder, armature, bones):
    mesh = bpy.data.meshes.new(name + "Body")
    builder.bm.normal_update()
    builder.bm.to_mesh(mesh)
    builder.bm.free()
    obj = bpy.data.objects.new(name + "Body", mesh)
    bpy.context.scene.collection.objects.link(obj)
    for m in builder.mats:
        mesh.materials.append(MATS[m])
    for b in bones:
        obj.vertex_groups.new(name=b)
    obj.parent = armature
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = armature
    return obj



def sash_band(b, d, k):
    hy = d["hipHeight"]
    yc = hy + 0.3 * k
    tilt = 0.17 * k
    width = 0.075
    segs = 40
    rows = []
    for edge in (0, 1):
        row = []
        for s in range(segs):
            th = 2 * math.pi * s / segs
            # Highest over the right shoulder (-x), lowest at the left hip (+x).
            y = yc - tilt * math.cos(th) + (edge - 0.5) * width
            bone = "chest" if y > hy + 0.36 * k else "spine"
            rx, rz = (0.168, 0.124) if y > hy + 0.36 * k else (0.152, 0.118)
            row.append(b.vert((rx * math.cos(th), y, rz * math.sin(th)), [(bone, 1)]))
        rows.append(row)
    for s in range(segs):
        quad = [rows[0][s], rows[0][(s + 1) % segs], rows[1][(s + 1) % segs], rows[1][s]]
        u0, u1 = s / segs * 6, (s + 1) / segs * 6
        b.face(quad, "Tartan", True, [(u0, 0), (u1, 0), (u1, 0.25), (u0, 0.25)])
    # The knot at the left hip with its tails.
    y = yc - tilt
    b.ball("Tartan", (0.15, y, 0.04), (0.035, 0.04, 0.03), "spine", 10, 6)
    b.box("Tartan", (0.14, y - 0.2, 0.02), (0.165, y - 0.02, 0.07), "spine", smooth=True)


def head_parts(b, d, hair):
    hy = d["hipHeight"]
    k = d["height"] / 1.8
    neck0, neck1 = hy + 0.53 * k, hy + 0.66 * k
    b.tube("Skin", neck0, neck1, ellipse(0.05 * k, 0.05 * k), rigid("neck"), segs=14)
    hc = (0, d["height"] - 0.12 * k, 0.01)
    b.ball("Skin", hc, (0.088 * k, 0.112 * k, 0.1 * k), "head", 20, 14)
    b.ball("Skin", (0, hc[1] - 0.01, hc[2] + 0.098 * k), (0.016, 0.026, 0.02), "head", 8, 6)  # nose
    for sx in (1, -1):
        b.ball("Eye", (sx * 0.033 * k, hc[1] + 0.012, hc[2] + 0.085 * k), (0.011, 0.013, 0.008), "head", 8, 6)
        b.ball("Skin", (sx * 0.088 * k, hc[1], hc[2] - 0.005), (0.014, 0.026, 0.018), "head", 8, 6)  # ears
    b.ball("Hair", (0, hc[1] + 0.03 * k, hc[2] - 0.012), (0.094 * k, 0.098 * k, 0.103 * k), "head", 20, 12)
    if hair == "bun":
        b.ball("Hair", (0, hc[1] + 0.035 * k, hc[2] - 0.11 * k), (0.05, 0.05, 0.045), "head", 14, 10)


def arms(b, d, sleeve, cuff, puff=None):
    hy = d["hipHeight"]
    k = d["height"] / 1.8
    sh = hy + 0.5 * k
    for side, sx in (("L", 1), ("R", -1)):
        b.ball(sleeve if sleeve != "Skin" else "Skin", (sx * 0.19 * k, sh, 0), (0.06 * k, 0.06 * k, 0.06 * k), f"upperarm.{side}", 12, 8)
        b.tube(sleeve, sh - 0.29 * k, sh, taper((0.042 * k, 0.045 * k), (0.055 * k, 0.056 * k)), rigid(f"upperarm.{side}"),
               centre=(sx * 0.203 * k, -0.005), segs=14, rings=2)
        b.ball(sleeve, (sx * 0.215 * k, sh - 0.29 * k, -0.01), (0.044 * k, 0.044 * k, 0.044 * k), f"forearm.{side}", 10, 8)
        b.tube(sleeve, sh - 0.52 * k, sh - 0.29 * k, taper((0.033 * k, 0.036 * k), (0.043 * k, 0.045 * k)),
               rigid(f"forearm.{side}"), centre=(sx * 0.22 * k, 0.01), segs=14, rings=2)
        if cuff:
            b.tube(cuff, sh - 0.53 * k, sh - 0.505 * k, ellipse(0.036 * k, 0.038 * k), rigid(f"forearm.{side}"),
                   centre=(sx * 0.222 * k, 0.025), segs=12)
        if puff:
            b.ball(puff, (sx * 0.195 * k, sh - 0.03, 0), (0.07 * k, 0.065 * k, 0.07 * k), f"upperarm.{side}", 12, 8)
        b.ball("Skin", (sx * 0.226 * k, sh - 0.585 * k, 0.035), (0.026 * k, 0.05 * k, 0.04 * k), f"hand.{side}", 10, 8)


# ---------- pose clips ----------

def pose_clip(arm, bones, name, keys, frames):
    """keys: {frame: {bone: (axis, degrees) or ("move", dy)}}; rotations about app-space axes at the bone head."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    axes = {"x": Vector((1, 0, 0)), "z_up": Vector((0, 0, 1)), "fwd": Vector((0, -1, 0))}
    order = list(bones)  # parents come before children
    for frame in frames:
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        bpy.context.view_layer.update()
        for bname in order:
            if bname not in keys[frame]:
                continue
            pb = arm.pose.bones[bname]
            for op in keys[frame][bname]:
                if op[0] == "move":
                    m = pb.matrix.copy()
                    m.translation = m.translation + Vector((0, 0, op[1]))
                    pb.matrix = m
                else:
                    axis, deg = op
                    head = pb.matrix.translation.copy()
                    rot = Matrix.Rotation(math.radians(deg), 4, axes[axis])
                    pb.matrix = Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ pb.matrix
                bpy.context.view_layer.update()
        for pb in arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            pb.keyframe_insert("location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")
    return action
