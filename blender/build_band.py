"""Builds the band and its instruments and exports public/models/band.glb.

Run headless:  blender --background --python blender/build_band.py
Sizes come from src/band/band.json (shared with the app, which puts hands, bows and sticks on
the instruments) and src/dancers/dancers.json (body proportions, shared with the dancers).

Two characters, each one skinned mesh on the dancers' skeleton (built with blender/figure.py):
"Musician", a man in band jacket and tartan trews, standing (the app sits him down), and
"Fiddler", a woman in a long gown. The app clones the musician for accordion, piano and drums.
Everything else is a separate rigid mesh in the musician's frame (y up, facing +z, the
musician's left is +x, origin on the floor under the hips) unless noted: Chair, Stool, Piano,
DrumKit, Stick, Fiddle, Bow, and the accordion in three parts, AccordionTreble,
AccordionBass and Bellows (one metre long, stretched by the app).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figure import (MATS, Builder, arms, ellipse, finish, head_parts, make_armature, material,  # noqa: E402
                    reset_scene, rigid, sash_band, skeleton, taper)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIMS = json.load(open(os.path.join(ROOT, "src", "dancers", "dancers.json")))
BAND = json.load(open(os.path.join(ROOT, "src", "band", "band.json")))
OUT = os.path.join(ROOT, "public", "models", "band.glb")
reset_scene()
scene = bpy.context.scene

# ---------- materials ----------

material("Skin", (0.62, 0.40, 0.30), 0.55)
material("Hair", (0.09, 0.05, 0.03), 0.6)       # tinted per musician by the app
material("Eye", (0.02, 0.02, 0.025), 0.3)
material("Jacket", (0.03, 0.05, 0.12), 0.55)    # the band's navy
material("Shirt", (0.85, 0.84, 0.80), 0.6)
material("Tartan", (0.3, 0.1, 0.1), 0.75)       # the band's sett, drawn by the app
material("Shoe", (0.015, 0.012, 0.01), 0.35)
material("Brass", (0.75, 0.55, 0.25), 0.3, metallic=1.0)
material("Gown", (0.04, 0.06, 0.14), 0.6)

material("ChairWood", (0.22, 0.11, 0.05), 0.5)
material("PianoWood", (0.035, 0.018, 0.01), 0.22)
material("Ivory", (0.86, 0.83, 0.75), 0.35)
material("Ebony", (0.015, 0.013, 0.012), 0.3)
material("Chrome", (0.8, 0.8, 0.82), 0.18, metallic=1.0)
material("DrumShell", (0.32, 0.025, 0.035), 0.22)
material("DrumHead", (0.88, 0.86, 0.8), 0.7)
material("Cymbal", (0.78, 0.58, 0.26), 0.28, metallic=1.0)
material("StickWood", (0.78, 0.62, 0.42), 0.5)
material("FiddleWood", (0.42, 0.16, 0.04), 0.2)
material("BowHair", (0.93, 0.91, 0.86), 0.8)
material("AccordionBody", (0.5, 0.03, 0.05), 0.2)
material("Bellows", (0.03, 0.03, 0.035), 0.6)
material("Leather", (0.06, 0.035, 0.02), 0.5)


# ---------- rigid parts ----------

class Part(Builder):
    """A rigid mesh: the figure builder without bones, with a transform for parts that don't run along y."""

    def __init__(self, mats):
        super().__init__(["root"], mats)
        self.xform = Matrix.Identity(4)

    def vert(self, p, weights=None):
        return super().vert(tuple(self.xform @ Vector(p)), [("root", 1)])

    def box(self, mat, mn, mx, bone="root", smooth=False):
        super().box(mat, mn, mx, bone, smooth)

    def along(self, matrix):
        self.xform = matrix
        return self


def at(x, y, z):
    return Matrix.Translation(Vector((x, y, z)))


Y_TO_Z = Matrix.Rotation(math.radians(90), 4, "X")   # a part modelled along +y now runs along +z
Y_TO_X = Matrix.Rotation(math.radians(-90), 4, "Z")  # ... along +x


def finish_part(name, part):
    mesh = bpy.data.meshes.new(name)
    part.bm.normal_update()
    part.bm.to_mesh(mesh)
    part.bm.free()
    for m in part.mats:
        mesh.materials.append(MATS[m])
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def cylinder(p, mat, a, b, r, segs=20, cap=True):
    """Vertical cylinder from a to b (points with equal x, z)."""
    p.tube(mat, a[1], b[1], ellipse(r, r), rigid("root"), centre=(a[0], a[2]), segs=segs, cap_top=cap, cap_bottom=cap)


# ---------- the characters ----------

def build_musician():
    d = DIMS["M"]
    hy, hw, ank = d["hipHeight"], d["hipWidth"], d["ankleHeight"]
    knee = ank + d["shin"]
    waist = hy + 0.08
    bones = skeleton(d, "tails", waist, waist - 0.12)
    names = list(bones)
    mats = ["Skin", "Hair", "Eye", "Jacket", "Shirt", "Tartan", "Shoe", "Brass"]
    b = Builder(names, mats)
    for side, sx in (("L", 1), ("R", -1)):
        x = sx * hw
        b.tube("Shoe", 0.0, 0.07, lambda th, v: (0.045 - 0.008 * v, 0.12 - 0.02 * v), rigid(f"foot.{side}"),
               centre=(x, 0.065), segs=18, rings=2, cap_top=True, cap_bottom=True)
        # Tartan trews: straight-cut, a ball at the knee so it stays covered when bent.
        b.tube("Tartan", ank - 0.005, knee, taper((0.055, 0.058), (0.064, 0.066)), rigid(f"shin.{side}"),
               centre=(x, 0.0), segs=16, rings=2, uv_repeat=(1, 2), cap_bottom=True)
        b.ball("Tartan", (x, knee, 0.005), (0.06, 0.062, 0.062), f"shin.{side}", 14, 8)
        b.tube("Tartan", knee, hy + 0.02, taper((0.066, 0.068), (0.085, 0.09)), rigid(f"thigh.{side}"),
               centre=(x, 0.0), segs=16, rings=2, uv_repeat=(1, 2))
        b.ball("Tartan", (x, hy, 0.0), (0.088, 0.09, 0.092), f"thigh.{side}", 14, 8)
    b.tube("Tartan", hy - 0.06, waist + 0.03, ellipse(0.165, 0.12), rigid("hips"), segs=32, uv_repeat=(3, 0.5), cap_bottom=True)

    # Band jacket, buttoned, with short tails; shirt and bow tie.
    torso = lambda th, v: (0.165 + 0.03 * v, 0.12 + 0.012 * v)
    b.tube("Jacket", waist + 0.03, hy + 0.36, torso, rigid("spine"), segs=32, rings=2)
    b.tube("Jacket", hy + 0.36, hy + 0.52, lambda th, v: (0.195 - 0.035 * v * v, 0.132 - 0.02 * v), rigid("chest"),
           segs=32, rings=3, cap_top=True)
    b.tube("Jacket", waist - 0.12, waist + 0.03, lambda th, v: (0.172, 0.13), rigid("tails"),
           offset=lambda v: (0.0, -0.01), segs=24)
    b.box("Shirt", (-0.05, hy + 0.4, 0.118), (0.05, hy + 0.5, 0.13), "chest")
    b.box("Shirt", (-0.045, hy + 0.48, 0.07), (0.045, hy + 0.55, 0.12), "neck")
    b.box("Jacket", (-0.045, hy + 0.5, 0.118), (0.045, hy + 0.53, 0.135), "neck")
    for y in (hy + 0.12, hy + 0.22, hy + 0.32):
        b.ball("Brass", (0, y, 0.15), (0.012, 0.012, 0.006), "spine", 8, 6)
    head_parts(b, d, hair="short")
    arms(b, d, sleeve="Jacket", cuff="Shirt")
    arm_obj = make_armature("Musician", bones)
    return finish("Musician", b, arm_obj, names), arm_obj


def build_fiddler():
    d = DIMS["W"]
    k = d["height"] / 1.8
    hy = d["hipHeight"]
    waist = hy + 0.11
    hem = 0.02
    bones = skeleton(d, "skirt", waist, hem)
    names = list(bones)
    mats = ["Skin", "Hair", "Eye", "Gown", "Tartan"]
    b = Builder(names, mats)

    def gown_radius(th, v):
        fold = 0.012 * (1 - v) * math.cos(th * 9)
        rx = 0.14 + (0.24 - 0.14) * (1 - v) ** 1.6 + fold
        rz = 0.115 + (0.22 - 0.115) * (1 - v) ** 1.6 + fold
        return rx, rz
    # Long gown to the floor; it hangs from the hips (a standing player hardly moves her legs).
    b.tube("Gown", hem, waist, gown_radius, rigid("hips"), segs=48, rings=8, cap_bottom=True)
    b.tube("Gown", waist, hy + 0.36 * k, lambda th, v: (0.135 + 0.025 * v, 0.105 + 0.01 * v), rigid("spine"), segs=32, rings=2)
    b.tube("Gown", hy + 0.36 * k, hy + 0.5 * k, lambda th, v: (0.16 - 0.02 * v, 0.115 - 0.01 * v), rigid("chest"),
           segs=32, rings=2)
    b.tube("Skin", hy + 0.5 * k, hy + 0.53 * k, lambda th, v: (0.14 - 0.06 * v, 0.1 - 0.03 * v), rigid("chest"),
           segs=24, cap_top=True)
    sash_band(b, d, k)
    head_parts(b, d, hair="bun")
    arms(b, d, sleeve="Gown", cuff=None)
    arm_obj = make_armature("Fiddler", bones)
    return finish("Fiddler", b, arm_obj, names), arm_obj


# ---------- furniture ----------

def build_chair():
    p = Part(["ChairWood"])
    s = BAND["seatHeight"]
    p.box("ChairWood", (-0.21, s - 0.04, -0.24), (0.21, s, 0.19))
    for x in (-0.18, 0.18):
        for z in (-0.21, 0.16):
            cylinder(p, "ChairWood", (x, 0, z), (x, s - 0.04, z), 0.018, 10)
        cylinder(p, "ChairWood", (x, s, -0.215), (x, 0.93, -0.215), 0.017, 10)
    for y in (0.62, 0.76, 0.88):
        p.box("ChairWood", (-0.18, y, -0.232), (0.18, y + 0.06, -0.2), smooth=False)
    return finish_part("Chair", p)


def build_stool():
    p = Part(["ChairWood", "Leather", "Chrome"])
    s = BAND["seatHeight"]
    p.tube("Leather", s - 0.06, s, lambda th, v: (0.17 - 0.015 * v, 0.17 - 0.015 * v), rigid("root"),
           segs=28, rings=2, cap_top=True, cap_bottom=True)
    cylinder(p, "Chrome", (0, 0.04, 0), (0, s - 0.06, 0), 0.02, 12)
    for i in range(3):
        a = 2 * math.pi * i / 3
        p.along(at(0, 0.02, 0) @ Matrix.Rotation(a, 4, "Y") @ Y_TO_Z)
        p.tube("Chrome", 0, 0.24, ellipse(0.012, 0.012), rigid("root"), segs=8, cap_top=True)
    return finish_part("Stool", p)


# ---------- piano ----------

def build_piano():
    P = BAND["piano"]
    p = Part(["PianoWood", "Ivory", "Ebony", "Brass"])
    W, top, front, kd = P["whiteWidth"], P["keyTop"], P["front"], P["keyDepth"]
    body = P["body"]
    half = body["width"] / 2
    back = front + kd + body["depth"] - 0.08
    face = front + kd - 0.005
    p.box("PianoWood", (-half, 0.06, face + 0.06), (half, top - 0.03, back))              # lower case and knee board
    p.box("PianoWood", (-half, top + 0.06, face + 0.08), (half, body["height"], back))      # upper case
    p.box("PianoWood", (-half - 0.01, body["height"], face + 0.05), (half + 0.01, body["height"] + 0.025, back + 0.01))  # lid
    p.box("PianoWood", (-half + 0.06, top + 0.06, face - 0.01), (half - 0.06, top + 0.2, face + 0.08))  # fallboard
    p.box("PianoWood", (-0.32, top + 0.3, face + 0.02), (0.32, top + 0.33, face + 0.1))     # music desk ledge
    for sx in (-1, 1):
        x = sx * (half - 0.04)
        p.box("PianoWood", (x - 0.04, top - 0.08, front - 0.02), (x + 0.04, top + 0.06, back))  # key cheeks
        p.box("PianoWood", (x - 0.035, 0.0, front + 0.02), (x + 0.035, top - 0.08, front + 0.1))  # legs
        p.box("PianoWood", (x - 0.04, 0.0, front - 0.02), (x + 0.04, 0.05, back))           # toe blocks
    p.box("PianoWood", (-half + 0.08, top - 0.07, front - 0.012), (half - 0.08, top - 0.02, front + 0.01))  # key slip
    for sx in (-1, 1):
        p.box("Brass", (sx * 0.12 - 0.03, 0.08, face + 0.05), (sx * 0.12 + 0.03, 0.1, face + 0.1))  # pedals
    # 52 white keys from A0, low notes on the pianist's left (+x), then the black keys between
    # them (above A, C, D, F and G).
    letters = "ABCDEFG"
    for i in range(P["whiteKeys"]):
        x0 = (P["middleWhite"] - i - 1) * W
        p.box("Ivory", (x0 + 0.0006, top - 0.02, front), (x0 + W - 0.0006, top, front + kd))
        if letters[i % 7] in "ACDFG" and i < P["whiteKeys"] - 1:
            p.box("Ebony", (x0 - 0.0065, top, front + 0.05), (x0 + 0.0065, top + 0.011, front + kd))
    return finish_part("Piano", p)


# ---------- drums ----------

def drum(p, centre, r, depth, axis="y"):
    """A shell with a head on each end, centred on `centre`, along y (snare, toms) or z (kick)."""
    x, y, z = centre
    if axis == "z":
        p.along(at(x, y, z) @ Y_TO_Z)
        x0 = z0 = 0
        y0 = -depth / 2
    else:
        p.along(Matrix.Identity(4))
        x0, y0, z0 = x, y - depth, z
    p.tube("DrumShell", y0 + 0.01, y0 + depth - 0.01, ellipse(r, r), rigid("root"), centre=(x0, z0), segs=32)
    for yy in (y0, y0 + depth - 0.012):
        p.tube("Chrome", yy, yy + 0.012, ellipse(r + 0.006, r + 0.006), rigid("root"), centre=(x0, z0), segs=32)
    p.tube("DrumHead", y0 + depth - 0.006, y0 + depth - 0.002, ellipse(r, r), rigid("root"), centre=(x0, z0), segs=32, cap_top=True)
    p.tube("DrumHead", y0 + 0.002, y0 + 0.006, ellipse(r, r), rigid("root"), centre=(x0, z0), segs=32, cap_bottom=True)
    p.along(Matrix.Identity(4))


def cymbal(p, centre, r, tilt):
    x, y, z = centre
    p.along(at(x, y, z) @ Matrix.Rotation(tilt, 4, "X"))
    p.tube("Cymbal", -0.004, 0.012, lambda th, v: (r * (1 - 0.92 * v), r * (1 - 0.92 * v)), rigid("root"),
           segs=36, rings=3, cap_bottom=True, cap_top=True)
    p.along(Matrix.Identity(4))
    cylinder(p, "Chrome", (x, 0, z), (x, y - 0.01, z), 0.009, 8)


def build_drums():
    D = BAND["drums"]
    p = Part(["DrumShell", "DrumHead", "Chrome", "Cymbal", "Ebony"])
    k = D["kick"]
    drum(p, k["at"], k["radius"], k["depth"], axis="z")
    for name in ("snare", "rackTom", "floorTom"):
        dr = D[name]
        drum(p, (dr["at"][0], dr["at"][1], dr["at"][2]), dr["radius"], dr["depth"])
    sn, ft = D["snare"], D["floorTom"]
    cylinder(p, "Chrome", (sn["at"][0], 0, sn["at"][2]), (sn["at"][0], sn["at"][1] - sn["depth"], sn["at"][2]), 0.01, 8)
    for i in range(3):
        a = 2 * math.pi * (i + 0.25) / 3
        x, z = ft["at"][0] + math.cos(a) * ft["radius"], ft["at"][2] + math.sin(a) * ft["radius"]
        cylinder(p, "Chrome", (x, 0, z), (x, ft["at"][1] - 0.05, z), 0.008, 8)
    cymbal(p, D["ride"]["at"], D["ride"]["radius"], D["ride"]["tilt"])
    cymbal(p, D["crash"]["at"], D["crash"]["radius"], D["crash"]["tilt"])
    hh = D["hihat"]
    cymbal(p, hh["at"], hh["radius"], 0.0)
    cymbal(p, (hh["at"][0], hh["at"][1] + 0.025, hh["at"][2]), hh["radius"], 0.0)
    # Kick pedal and its beater.
    px, _, pz = D["pedal"]
    p.box("Chrome", (px - 0.04, 0.0, pz - 0.12), (px + 0.04, 0.02, pz + 0.08))
    cylinder(p, "Chrome", (px, 0.02, pz + 0.12), (px, 0.24, pz + 0.12), 0.006, 8)
    p.ball("Ebony", (px, 0.25, pz + 0.12), (0.02, 0.025, 0.02), "root", 10, 6)
    return finish_part("DrumKit", p)


def build_stick():
    S = BAND["stick"]
    p = Part(["StickWood"]).along(at(0, 0, -S["grip"]) @ Y_TO_Z)
    p.tube("StickWood", 0, S["length"], taper((0.0075, 0.0075), (0.0045, 0.0045)), rigid("root"), segs=10, rings=3, cap_bottom=True)
    p.ball("StickWood", (0, S["length"], 0), (0.007, 0.009, 0.007), "root", 8, 6)
    return finish_part("Stick", p)


# ---------- fiddle and bow ----------

def build_fiddle():
    F = BAND["fiddle"]
    p = Part(["FiddleWood", "Ebony", "Ivory"])
    L = F["body"]

    def outline(th, v):
        # Lower bout (toward the chin, -z) wider than the upper; a pinched waist at the sides.
        width = 0.103 * (0.9 - 0.1 * math.sin(th)) * (1 - 0.24 * math.cos(th) ** 8)
        return width, L / 2
    p.tube("FiddleWood", 0.0, 0.042, outline, rigid("root"), centre=(0, L / 2), segs=48, cap_top=True, cap_bottom=True)
    p.ball("FiddleWood", (0, 0.042, L / 2), (0.085, 0.012, 0.16), "root", 18, 6)  # arched top
    p.box("FiddleWood", (-0.013, 0.02, L - 0.03), (0.013, 0.046, F["length"] - 0.08))  # neck
    p.box("Ebony", (-0.017, 0.046, 0.25), (0.017, 0.056, F["length"] - 0.08))       # fingerboard
    p.box("FiddleWood", (-0.012, 0.025, F["length"] - 0.09), (0.012, 0.05, F["length"] - 0.015))  # pegbox
    p.ball("FiddleWood", (0, 0.04, F["length"] - 0.01), (0.016, 0.02, 0.02), "root", 10, 6)  # scroll
    for sx in (-1, 1):
        for i in range(2):
            p.box("Ebony", (sx * 0.012, 0.03, F["length"] - 0.075 + i * 0.03), (sx * 0.03, 0.04, F["length"] - 0.065 + i * 0.03))
    br = F["bridge"]
    p.box("Ivory", (-0.022, 0.05, br - 0.002), (0.022, F["contact"][1] + 0.002, br + 0.002))  # bridge
    p.box("Ebony", (-0.02, 0.048, 0.015), (0.02, 0.058, 0.12))                     # tailpiece
    p.ball("Ebony", (0.045, 0.048, 0.035), (0.035, 0.01, 0.028), "root", 12, 6)     # chinrest, on the left
    for i in range(4):
        x = (i - 1.5) * 0.0075
        p.box("Ivory", (x - 0.0006, F["contact"][1] - 0.001, 0.11), (x + 0.0006, F["contact"][1] + 0.0002, F["length"] - 0.085))
    return finish_part("Fiddle", p)


def build_bow():
    B = BAND["bow"]
    p = Part(["FiddleWood", "Ebony", "BowHair", "Ivory"])
    p.along(Y_TO_X)
    p.tube("FiddleWood", -0.03, B["length"], taper((0.0055, 0.0055), (0.0035, 0.0035)), rigid("root"), segs=8, rings=2,
           cap_bottom=True, cap_top=True)
    p.along(Matrix.Identity(4))
    p.box("Ebony", (-0.01, -0.024, -0.007), (0.045, -0.004, 0.007))                  # frog
    p.box("Ivory", (B["length"] - 0.02, -0.022, -0.0045), (B["length"], 0.0, 0.0045))  # tip
    p.box("BowHair", (0.02, -0.0205, -0.0045), (B["length"] - 0.01, -0.0175, 0.0045))
    return finish_part("Bow", p)


# ---------- accordion ----------

def build_accordion():
    A = BAND["accordion"]
    h, dep = A["height"] / 2, A["depth"]
    tw, bw = A["trebleWidth"], A["bassWidth"]

    t = Part(["AccordionBody", "Ivory", "Ebony", "Chrome"])
    t.box("AccordionBody", (-tw, -h, 0.0), (0.0, h, dep), smooth=False)
    t.box("Chrome", (-tw + 0.005, h - 0.11, dep), (-0.005, h - 0.01, dep + 0.006))  # grille
    # The keyboard runs down the outer edge, low notes at the top.
    n = 20
    span = A["keysTop"] - A["keysBottom"]
    kw = span / n
    for i in range(n):
        y1 = A["keysTop"] - i * kw
        t.box("Ivory", (-tw - 0.014, y1 - kw + 0.0008, 0.05), (-tw, y1 - 0.0008, dep - 0.012))
        if i % 7 not in (2, 6) and i < n - 1:
            t.box("Ebony", (-tw - 0.022, y1 - kw - 0.004, 0.09), (-tw - 0.014, y1 - kw + 0.004, dep - 0.012))
    finish_part("AccordionTreble", t)

    b = Part(["AccordionBody", "Ivory", "Leather"])
    b.box("AccordionBody", (0.0, -h, 0.0), (bw, h, dep), smooth=False)
    for row in range(6):
        for col in range(8):
            b.ball("Ivory", (bw + 0.003, 0.12 - col * 0.032, 0.035 + row * 0.022), (0.005, 0.0065, 0.0065), "root", 6, 4)
    b.box("Leather", (bw + 0.006, -0.16, 0.06), (bw + 0.016, 0.16, 0.12))  # hand strap
    finish_part("AccordionBass", b)

    # Pleated bellows, one metre along +x; the app stretches it between the two ends.
    w = Part(["Bellows", "Ivory"]).along(at(0, 0, dep / 2) @ Y_TO_X)
    folds = 14
    w.tube("Bellows", 0.0, 1.0, lambda th, v: ((h - 0.012) * (1 - 0.07 * abs(math.sin(math.pi * v * folds))),
                                                (dep / 2 - 0.008) * (1 - 0.1 * abs(math.sin(math.pi * v * folds)))),
           rigid("root"), segs=4 * 6, rings=folds * 4, smooth=False)
    return finish_part("Bellows", w)


musician, musician_arm = build_musician()
fiddler, fiddler_arm = build_fiddler()
fiddler_arm.location.x = 1.0  # side by side in the file; the app places each one itself
for build in (build_chair, build_stool, build_piano, build_drums, build_stick, build_fiddle, build_bow, build_accordion):
    build()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_skins=True, export_animations=False)
print(f"Exported {OUT}")
