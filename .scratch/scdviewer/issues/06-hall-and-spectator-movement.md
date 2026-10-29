# 06: The hall and spectator movement

**What to build:** A Blender-built hall surrounds the floor: wooden sprung floor, panelled walls, windows, a low stage at the top of the set, warm lighting, and procedural or baked textures only. A placeholder spectator moves in third person: WASD to walk, Shift to run, mouse look with pointer lock. The spectator collides with the walls and the stage, and the camera never clips through walls. C toggles the gallery view looking down on the whole set; you can still walk while in it.

**Blocked by:** 01

**Status:** done

- [x] The hall is a .glb built by a script in `/blender`, with no downloaded textures
- [x] Movement is smooth, with acceleration and turning that feel natural
- [x] The spectator cannot pass through walls or the stage; dancers will pass through the spectator
- [x] The third-person camera pulls in rather than clipping through walls
- [x] The gallery view shows the whole set at once
