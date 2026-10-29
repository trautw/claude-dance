"""Builds the spectator and exports public/models/spectator.glb.

Run headless:  blender --background --python blender/build_spectator.py
One skinned character on the dancers' skeleton (blender/figure.py): "Spectator", a man in
shirtsleeves, dark trousers and a tartan waistcoat (the app draws its sett). Three looping
clips: "idle", "walk" (authored at the app's walking speed) and "run" (at its running speed).
The walk and run are solved from foot paths with two-bone IK, so a planted foot stays put
when the app plays them at the speed the spectator moves.
"""
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figure import (Builder, arms, ellipse, finish, head_parts, make_armature, material,  # noqa: E402
                    pose_clip, reset_scene, rigid, skeleton, smoothstep, taper)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIMS = json.load(open(os.path.join(ROOT, "src", "dancers", "dancers.json")))
OUT = os.path.join(ROOT, "public", "models", "spectator.glb")
FPS = 24
# The app's walking and running speeds (src/player/spectator.js), metres a second.
WALK_SPEED = 1.7
RUN_SPEED = 4.2
reset_scene()

material("Skin", (0.66, 0.45, 0.34), 0.55)
material("Hair", (0.23, 0.14, 0.07), 0.6)
material("Eye", (0.02, 0.02, 0.025), 0.3)
material("Shirt", (0.88, 0.87, 0.83), 0.65)
material("Tartan", (0.1, 0.25, 0.15), 0.75)    # the spectator's sett, drawn by the app
material("Trousers", (0.07, 0.075, 0.08), 0.7)
material("Shoe", (0.12, 0.06, 0.03), 0.35)
material("Tie", (0.05, 0.16, 0.09), 0.5)
material("Brass", (0.75, 0.55, 0.25), 0.3, metallic=1.0)

D = DIMS["M"]


def build_spectator():
    hy, hw, ank = D["hipHeight"], D["hipWidth"], D["ankleHeight"]
    knee = ank + D["shin"]
    waist = hy + 0.08
    bones = skeleton(D, "coat", waist, waist - 0.12)
    names = list(bones)
    mats = ["Skin", "Hair", "Eye", "Shirt", "Tartan", "Trousers", "Shoe", "Tie", "Brass"]
    b = Builder(names, mats)
    for side, sx in (("L", 1), ("R", -1)):
        x = sx * hw
        b.tube("Shoe", 0.0, 0.07, lambda th, v: (0.046 - 0.008 * v, 0.12 - 0.02 * v), rigid(f"foot.{side}"),
               centre=(x, 0.065), segs=18, rings=2, cap_top=True, cap_bottom=True)
        b.tube("Trousers", ank - 0.01, knee, taper((0.056, 0.06), (0.064, 0.066)), rigid(f"shin.{side}"),
               centre=(x, 0.0), segs=16, rings=2, cap_bottom=True)
        b.ball("Trousers", (x, knee, 0.005), (0.06, 0.062, 0.062), f"shin.{side}", 14, 8)
        b.tube("Trousers", knee, hy + 0.02, taper((0.066, 0.068), (0.086, 0.09)), rigid(f"thigh.{side}"),
               centre=(x, 0.0), segs=16, rings=2)
        b.ball("Trousers", (x, hy, 0.0), (0.088, 0.09, 0.092), f"thigh.{side}", 14, 8)
    b.tube("Trousers", hy - 0.06, waist + 0.02, ellipse(0.163, 0.118), rigid("hips"), segs=32, cap_bottom=True)

    # Shirt underneath, the tartan waistcoat over it (pointed at the front hem), tie and buttons.
    b.tube("Shirt", waist, hy + 0.52, lambda th, v: (0.158 + 0.02 * v, 0.113 + 0.008 * v), rigid("chest"),
           segs=28, rings=2, cap_top=True)
    def waistcoat(th, v):
        return 0.168 + 0.024 * math.sin(math.pi * min(1, v * 1.4)) * 0.6, 0.122 + 0.008 * v
    b.tube("Tartan", waist - 0.05, hy + 0.36, waistcoat, rigid("spine"), segs=32, rings=3, uv_repeat=(3, 1),
           offset=lambda v: (0.0, 0.0))
    # Up over the shoulder blades at the back; open at the front in a V down to the tie.
    def upper(th, v):
        return 0.19 - 0.045 * v * v, 0.13 - 0.02 * v
    b.tube("Tartan", hy + 0.36, hy + 0.53, upper, rigid("chest"), segs=32, rings=4, uv_repeat=(3, 0.6),
           offset=lambda v: (0.0, -0.004 * v))
    # The points of the waistcoat's front hem.
    for sx in (1, -1):
        b.box("Tartan", (min(0, sx * 0.07), waist - 0.09, 0.105), (max(0, sx * 0.07), waist - 0.05, 0.125), "hips", smooth=True)
    b.box("Shirt", (-0.045, hy + 0.47, 0.07), (0.045, hy + 0.55, 0.12), "neck")
    # The shirt front showing in the waistcoat's V, and the tie over it.
    b.box("Shirt", (-0.045, hy + 0.42, 0.122), (0.045, hy + 0.53, 0.136), "chest")
    b.box("Tie", (-0.018, hy + 0.36, 0.13), (0.018, hy + 0.53, 0.142), "chest")
    for y in (hy + 0.06, hy + 0.15, hy + 0.24, hy + 0.33):
        b.ball("Brass", (0, y, 0.135 if y < hy + 0.3 else 0.14), (0.01, 0.01, 0.006), "spine", 8, 6)
    head_parts(b, D, hair="short")
    arms(b, D, sleeve="Shirt", cuff=None)
    arm_obj = make_armature("Spectator", bones)
    return finish("Spectator", b, arm_obj, names), arm_obj, bones


# ---------- gaits ----------

THIGH = D["hipHeight"] - (D["ankleHeight"] + D["shin"])
SHIN = D["shin"]
REACH = 0.998 * (THIGH + SHIN)


def leg(hip_y, z, y):
    """Thigh swing forward and knee bend (radians) that put the ankle at (z ahead, y up)."""
    dist = min(REACH, max(0.3, math.hypot(z, hip_y - y)))
    toward = math.atan2(z, hip_y - y)
    open_hip = math.acos((THIGH ** 2 + dist ** 2 - SHIN ** 2) / (2 * THIGH * dist))
    knee = math.pi - math.acos((THIGH ** 2 + SHIN ** 2 - dist ** 2) / (2 * THIGH * SHIN))
    return toward + open_hip, knee


def foot_path(p, g):
    """One foot through the cycle (phase p from heel strike): ankle (z, y) and extra toe-down pitch."""
    travel = g["speed"] * g["period"] * g["stance"]
    front, back = 0.42 * travel, -0.58 * travel
    ank = D["ankleHeight"]
    if p < g["stance"]:
        s = p / g["stance"]
        heel = smoothstep(0.55, 1.0, s)  # the heel rises as the foot rolls onto its toes
        return front + (back - front) * s, ank + g["roll"] * heel, 38 * heel - 12 * (1 - smoothstep(0, 0.18, s))
    w = (p - g["stance"]) / (1 - g["stance"])
    z = back + (front - back) * smoothstep(0, 1, w)
    y = ank + g["roll"] * (1 - smoothstep(0, 0.4, w)) + g["lift"] * math.sin(math.pi * min(1, w * 1.15))
    return z, y, 38 * (1 - smoothstep(0, 0.5, w)) - 12 * smoothstep(0.65, 1, w)


def gait_keys(g, frames):
    keys = {}
    for f in frames:
        u = f / frames[-1]
        # Lowest while a foot is planted under the body, highest between (in the run, in the air).
        mid = g["stance"] / 2 if g["stance"] < 0.5 else 0
        hip_y = g["hip"] - g["bob"] * math.cos(4 * math.pi * (u - mid))
        k = {"hips": [("move", hip_y - D["hipHeight"])], "spine": [("x", g["lean"])],
             "chest": [("z_up", g["twist"] * math.cos(2 * math.pi * u))],
             "head": [("x", -g["lean"] * 0.6)]}
        for side, offset in (("L", 0.0), ("R", 0.5)):
            z, y, pitch = foot_path((u + offset) % 1, g)
            thigh, knee = leg(hip_y, z, y)
            net = math.degrees(knee - thigh)  # the shin's swing back from hanging straight
            k[f"thigh.{side}"] = [("x", -math.degrees(thigh))]
            k[f"shin.{side}"] = [("x", math.degrees(knee))]
            k[f"foot.{side}"] = [("x", -net + pitch)]
            # Each arm swings with the opposite leg.
            swing = g["arm"] * math.cos(2 * math.pi * (u + offset))
            k[f"upperarm.{side}"] = [("x", swing)]
            k[f"forearm.{side}"] = [("x", -g["elbow"] - 0.3 * g["arm"] * max(0, -math.cos(2 * math.pi * (u + offset))))]
        keys[f] = k
    return keys


WALK = {"speed": WALK_SPEED, "period": 22 / FPS, "stance": 0.6, "roll": 0.09, "lift": 0.05,
        "hip": 0.885, "bob": 0.012, "lean": 3, "twist": 5, "arm": 17, "elbow": 14}
RUN = {"speed": RUN_SPEED, "period": 16 / FPS, "stance": 0.32, "roll": 0.12, "lift": 0.2,
       "hip": 0.875, "bob": 0.025, "lean": 11, "twist": 9, "arm": 34, "elbow": 82}


def idle_keys(frames):
    keys = {}
    for f in frames:
        u = 2 * math.pi * f / frames[-1]
        keys[f] = {
            "hips": [("move", -0.006 + 0.003 * math.cos(u))],
            "chest": [("x", -1.2 * math.sin(2 * u))],  # breathing, twice a cycle
            "head": [("z_up", 6 * math.sin(u)), ("x", 2 * math.sin(2 * u + 1))],
            "upperarm.L": [("x", 2 * math.sin(2 * u)), ("fwd", 3)],
            "upperarm.R": [("x", 2 * math.sin(2 * u)), ("fwd", -3)],
            "forearm.L": [("x", -10)], "forearm.R": [("x", -10)],
        }
    return keys


_, spectator, bones = build_spectator()
walk_frames = list(range(0, 23, 2))
run_frames = list(range(0, 17, 2))
idle_frames = list(range(0, 97, 8))
actions = [
    pose_clip(spectator, bones, "idle", idle_keys(idle_frames), idle_frames),
    pose_clip(spectator, bones, "walk", gait_keys(WALK, walk_frames), walk_frames),
    pose_clip(spectator, bones, "run", gait_keys(RUN, run_frames), run_frames),
]
for a in actions:
    a.use_fake_user = True

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_skins=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_force_sampling=True)
print(f"Exported {OUT}")
