"""Builds the two dancer characters (man, woman) and exports public/models/dancers.glb.

Run headless:  blender --background --python blender/build_dancers.py
Proportions come from src/dancers/dancers.json, shared with the app's leg IK.

Each character is one skinned mesh on its own armature, built with blender/figure.py. Clothing parts are rigid on one bone, except the kilt and skirt, which blend from
the hips into a hem bone the app swings. Material names are what the app keys tartans and
couple colours on. Clips: "bow" (man) and "curtsey" (woman), posed about world axes.
"""
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figure import (Builder, arms, blend, ellipse, finish, head_parts, make_armature, material,  # noqa: E402
                    pose_clip, reset_scene, rigid, sash_band, skeleton, taper)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIMS = json.load(open(os.path.join(ROOT, "src", "dancers", "dancers.json")))
OUT = os.path.join(ROOT, "public", "models", "dancers.glb")
reset_scene()
scene = bpy.context.scene

# ---------- materials ----------


material("Skin", (0.62, 0.40, 0.30), 0.55)
material("Hair", (0.09, 0.05, 0.03), 0.6)
material("Eye", (0.02, 0.02, 0.025), 0.3)
material("Jacket", (0.025, 0.027, 0.032), 0.55)
material("Shirt", (0.85, 0.84, 0.80), 0.6)
material("Tartan", (0.5, 0.1, 0.1), 0.75)      # replaced per couple by the app
material("Hose", (0.78, 0.72, 0.60), 0.85)
material("Flash", (0.5, 0.1, 0.1), 0.7)         # couple colour, set by the app
material("Shoe", (0.015, 0.012, 0.01), 0.35)
material("Leather", (0.06, 0.035, 0.02), 0.5)
material("Sporran", (0.72, 0.68, 0.6), 0.9)
material("Brass", (0.75, 0.55, 0.25), 0.3, metallic=1.0)
material("Dress", (0.86, 0.85, 0.82), 0.7)

# ---------- the man ----------

def build_man():
    d = DIMS["M"]
    k = 1.0
    hy, hw, ank = d["hipHeight"], d["hipWidth"], d["ankleHeight"]
    knee = ank + d["shin"]
    waist = hy + 0.08
    bones = skeleton(d, "kilt", waist, knee + 0.02)
    names = list(bones)
    mats = ["Skin", "Hair", "Eye", "Jacket", "Shirt", "Tartan", "Hose", "Flash", "Shoe", "Leather", "Sporran", "Brass"]
    b = Builder(names, mats)

    for side, sx in (("L", 1), ("R", -1)):
        x = sx * hw
        # Ghillie brogue.
        b.tube("Shoe", 0.0, 0.07, lambda th, v: (0.045 - 0.008 * v, 0.12 - 0.02 * v), rigid(f"foot.{side}"),
               centre=(x, 0.065), segs=18, rings=2, cap_top=True, cap_bottom=True)
        b.tube("Leather", 0.066, 0.075, ellipse(0.03, 0.06), rigid(f"foot.{side}"), centre=(x, 0.1), segs=12, cap_top=True)
        # Hose to below the knee, turned over at the top, with the couple's flashes.
        b.tube("Hose", ank - 0.01, knee - 0.06, taper((0.04, 0.045), (0.058, 0.06)), rigid(f"shin.{side}"),
               centre=(x, 0.0), segs=16, rings=3)
        b.tube("Hose", knee - 0.12, knee - 0.06, ellipse(0.064, 0.066), rigid(f"shin.{side}"), centre=(x, 0.0), segs=16, cap_top=True)
        b.box("Flash", (x + sx * 0.06, knee - 0.17, -0.012), (x + sx * 0.066, knee - 0.1, 0.012), f"shin.{side}")
        b.ball("Skin", (x, knee, 0.005), (0.058, 0.06, 0.058), f"shin.{side}", 12, 8)
        b.tube("Skin", knee, hy, taper((0.06, 0.06), (0.075, 0.08)), rigid(f"thigh.{side}"), centre=(x, 0.0), segs=12)

    # Kilt: from the waist to the middle of the knee, flaring a little, pleated at the back.
    def kilt_radius(th, v):
        back = max(0.0, -math.sin(th))
        pleat = 0.012 * back * (0.5 + 0.5 * math.cos(th * 22))
        rx = 0.165 + (0.215 - 0.165) * (1 - v) + pleat
        rz = 0.125 + (0.175 - 0.125) * (1 - v) + pleat
        return rx, rz
    b.tube("Tartan", knee + 0.02, waist, kilt_radius, blend("hips", "kilt"), segs=48, rings=6,
           uv_repeat=(4, 1.5), cap_bottom=False)
    b.tube("Leather", waist - 0.01, waist + 0.05, ellipse(0.17, 0.13), rigid("hips"), segs=32)
    b.box("Brass", (-0.035, waist - 0.005, 0.125), (0.035, waist + 0.045, 0.14), "hips")
    # Sporran on its chain, hanging in front.
    b.tube("Sporran", waist - 0.27, waist - 0.07, taper((0.07, 0.03), (0.06, 0.025)), rigid("hips"),
           centre=(0, 0.19), segs=16, rings=2, cap_bottom=True, cap_top=True)
    b.box("Leather", (-0.065, waist - 0.11, 0.17), (0.065, waist - 0.065, 0.225), "hips")
    for x in (-0.03, 0.03):
        b.ball("Brass", (x, waist - 0.2, 0.225), (0.012, 0.03, 0.01), "hips", 8, 6)

    # Jacket (Prince Charlie style, cut away at the front over the shirt).
    torso = lambda th, v: (0.165 + 0.03 * v, 0.12 + 0.012 * v)
    b.tube("Jacket", waist + 0.03, hy + 0.36, torso, rigid("spine"), segs=32, rings=2)
    b.tube("Jacket", hy + 0.36, hy + 0.52, lambda th, v: (0.195 - 0.035 * v * v, 0.132 - 0.02 * v), rigid("chest"),
           segs=32, rings=3, cap_top=True)
    b.tube("Jacket", waist - 0.12, waist + 0.03, lambda th, v: (0.15, 0.115), rigid("hips"),
           offset=lambda v: (0.0, -0.03), segs=24)  # tails at the back
    b.box("Shirt", (-0.055, hy + 0.28, 0.115), (0.055, hy + 0.5, 0.13), "chest")
    b.box("Shirt", (-0.045, hy + 0.48, 0.07), (0.045, hy + 0.55, 0.12), "neck")
    b.box("Jacket", (-0.045, hy + 0.5, 0.118), (0.045, hy + 0.53, 0.135), "neck")  # bow tie
    for y in (hy + 0.3, hy + 0.38):
        for x in (-0.06, 0.06):
            b.ball("Brass", (x, y, 0.13), (0.011, 0.011, 0.006), "chest", 8, 6)

    head_parts(b, d, hair="short")
    arms(b, d, sleeve="Jacket", cuff="Shirt")
    arm_obj = make_armature("Man", bones)
    return finish("Man", b, arm_obj, names), arm_obj, bones


# ---------- the woman ----------

def build_woman():
    d = DIMS["W"]
    k = d["height"] / 1.8
    hy, hw, ank = d["hipHeight"], d["hipWidth"], d["ankleHeight"]
    knee = ank + d["shin"]
    waist = hy + 0.11
    hem = 0.36
    bones = skeleton(d, "skirt", waist, hem)
    names = list(bones)
    mats = ["Skin", "Hair", "Eye", "Dress", "Tartan", "Shoe", "Brass"]
    b = Builder(names, mats)

    for side, sx in (("L", 1), ("R", -1)):
        x = sx * hw
        b.tube("Shoe", 0.0, 0.055, lambda th, v: (0.038 - 0.006 * v, 0.105 - 0.015 * v), rigid(f"foot.{side}"),
               centre=(x, 0.06), segs=18, rings=2, cap_top=True, cap_bottom=True)
        # Only the leg below the skirt exists, so a lifted knee can't push through the cloth.
        b.tube("Skin", ank - 0.01, hem + 0.06, taper((0.033, 0.036), (0.044, 0.046)), rigid(f"shin.{side}"),
               centre=(x, 0.0), segs=14, rings=3, cap_top=True)

    # Full white skirt to mid-calf, softly folded, swinging from the waist.
    def skirt_radius(th, v):
        fold = 0.018 * (1 - v) * math.cos(th * 11)
        rx = 0.14 + (0.33 - 0.14) * (1 - v) ** 1.3 + fold
        rz = 0.115 + (0.30 - 0.115) * (1 - v) ** 1.3 + fold
        return rx, rz
    b.tube("Dress", hem, waist, skirt_radius, blend("hips", "skirt", 0.05), segs=56, rings=8)
    # Bodice, neckline and little puffed sleeves.
    b.tube("Dress", waist, hy + 0.36 * k, lambda th, v: (0.135 + 0.025 * v, 0.105 + 0.01 * v), rigid("spine"), segs=32, rings=2)
    b.tube("Dress", hy + 0.36 * k, hy + 0.5 * k, lambda th, v: (0.16 - 0.02 * v, 0.115 - 0.01 * v), rigid("chest"),
           segs=32, rings=2)
    b.tube("Skin", hy + 0.5 * k, hy + 0.53 * k, lambda th, v: (0.14 - 0.06 * v, 0.1 - 0.03 * v), rigid("chest"),
           segs=24, cap_top=True)
    # Sash over the right shoulder, across to the left hip.
    sash_band(b, d, k)
    head_parts(b, d, hair="bun")
    arms(b, d, sleeve="Skin", cuff=None, puff="Dress")
    arm_obj = make_armature("Woman", bones)
    return finish("Woman", b, arm_obj, names), arm_obj, bones




def bow_keys():
    # Rotations about app +x (the dancer's left): positive tips an upright bone's top forward,
    # and swings a hanging bone's lower end backward.
    bowed = {"spine": [("x", 20)], "chest": [("x", 12)], "neck": [("x", 10)], "head": [("x", 12)]}
    return {0: {}, 10: bowed, 16: bowed, 24: {}}


def curtsey_keys():
    # Right foot slides behind, both knees bend, a little bow; hands lift the skirt.
    low = {
        "hips": [("move", -0.07)],
        "thigh.L": [("x", -24)], "shin.L": [("x", 44)], "foot.L": [("x", -18)],
        "thigh.R": [("x", 14), ("fwd", -3)], "shin.R": [("x", 30)], "foot.R": [("x", -40)],
        "spine": [("x", 6)], "neck": [("x", 8)], "head": [("x", 12)],
        "upperarm.L": [("fwd", 16), ("x", -6)], "upperarm.R": [("fwd", -16), ("x", -6)],
        "forearm.L": [("x", -18)], "forearm.R": [("x", -18)],
    }
    return {0: {}, 10: low, 16: low, 24: {}}


man, man_arm, man_bones = build_man()
woman, woman_arm, woman_bones = build_woman()
woman_arm.location.x = 1.0  # side by side in the file; the app places each instance itself
pose_clip(man_arm, man_bones, "bow", bow_keys(), [0, 10, 16, 24])
pose_clip(woman_arm, woman_bones, "curtsey", curtsey_keys(), [0, 10, 16, 24])
for arm in (man_arm, woman_arm):
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
scene.frame_set(0)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_skins=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_force_sampling=True)
print(f"Exported {OUT}")
