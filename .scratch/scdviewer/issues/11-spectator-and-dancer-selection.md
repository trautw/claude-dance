# 11: Spectator character and selecting a dancer

**What to build:** A Blender-made spectator in a tartan waistcoat replaces the placeholder and animates while walking and running. Pressing E while facing a nearby dancer selects them: their floor path for the current time through is highlighted on the floor and they are marked on the minimap. Pressing E again clears the selection.

**Blocked by:** 06, 07, 10

**Status:** done

- [x] The spectator is a .glb from a script in `/blender`, with walk, run and idle animations
- [x] The selected dancer's path is visible on the floor and updates as the dance progresses
- [x] The minimap marks the selected dancer
- [x] Pressing E again, or selecting another dancer, behaves predictably
- [x] An on-screen prompt shows when a dancer can be selected
