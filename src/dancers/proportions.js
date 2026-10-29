// Body measurements shared by the Blender build (via dancers.json) and the leg IK.
// Metres, standing in first position. legLength is hip joint to ankle joint, straight.
import dims from './dancers.json' with { type: 'json' };

export const BODY = Object.fromEntries(
  Object.entries(dims).filter(([k]) => k === 'M' || k === 'W').map(([k, d]) => [k, {
    ...d,
    legLength: d.thigh + d.shin,
    // Arms as blender/build_dancers.py builds them, scaled with height.
    shoulderY: d.hipHeight + 0.5 * (d.height / 1.8),
    shoulderX: 0.19 * (d.height / 1.8),
    armLength: 0.54 * (d.height / 1.8),
  }]),
);
