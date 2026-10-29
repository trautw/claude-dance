# Footwork is planned from the floor paths in the browser; legs reach it by inverse kinematics

Dancers travel anywhere from standing still to about 2 m a bar, turn while travelling, and the timeline can jump to any bar at three speeds, yet feet must never slide. So each foot's floor contacts are computed in the browser from the dancer's path, following the rhythm of the step (skip change of step: step, close, step, hop; slip step in the circle), and the legs are posed by two-bone IK to reach them. This refines ADR 0001: Blender supplies the rigged characters and pose clips (first position, bow, curtsey) rather than travelling step cycles.

## Considered options

- **Keyframed step cycles from Blender, played at a rate matched to speed**: rejected; stride length can only match one speed, so feet slide everywhere else, and in turns.
- **Root motion baked per figure**: rejected for the same reasons as baking whole paths in ADR 0001.

## Consequences

Foot contacts are a pure function of bar time (no simulation history), so jumping in time poses feet correctly at once and the "no sliding" property is unit-testable without a renderer.
