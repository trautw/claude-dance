# Floor paths are computed from the crib at runtime; Blender only supplies step clips

Each dancer's floor position and facing is a pure function of the bar, computed in the browser from a data encoding of the crib. Blender produces only rigged characters and short looping step clips (skip change, pas de basque, standing, bow, curtsey). We rejected baking all 8 dancers' full 5½-minute performance in Blender because jumping to any bar must be instant and exact, playback speed is variable, and correcting a figure should not require a Blender rebuild.

Refined by [ADR 0002](0002-footwork-planted-in-the-browser.md): footwork is also computed in the browser, so Blender supplies pose clips (bow, curtsey) rather than step cycles.
