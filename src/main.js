import * as THREE from 'three';
import { createPerformance } from './dance/choreography.js';
import { placeD } from './dance/geometry.js';
import { nextBar, nextFigure, previousBar, previousFigure } from './dance/navigation.js';
import { DanceClock, SPEEDS } from './audio/clock.js';
import { Band } from './audio/band.js';
import { FloorPath } from './dancers/floorPath.js';
import { loadDancers, poseDancers } from './dancers/dancers.js';
import { loadBandStage } from './band/stage.js';
import { createTransport } from './ui/timeline.js';
import { createHud, dancerName } from './ui/hud.js';
import { layout, loadHall } from './world/hall.js';
import { AdaptiveResolution } from './world/resolution.js';
import { collidersFromLayout } from './world/collision.js';
import { createSpectator, stepSpectator } from './player/spectator.js';
import { CameraRig } from './player/cameraRig.js';
import { createInput } from './player/input.js';
import { interactionAt } from './player/interact.js';
import { loadSpectatorCharacter } from './player/character.js';

// ?bar=N freezes the dance at bar time N without audio (used for screenshots).
// ?view=gallery starts in the gallery view.
// ?cam=x,y,z,tx,ty,tz fixes the camera (for close-up screenshots).
// ?select=B.W selects a dancer, showing their floor path.
const params = new URLSearchParams(location.search);
const frozenBar = params.has('bar') ? Number(params.get('bar')) : null;
const fixedCamera = params.get('cam')?.split(',').map(Number) ?? null;

const renderer = new THREE.WebGLRenderer({ antialias: true });
// Sharp enough on a high-density screen at 1.5 with antialiasing; lower if the GPU can't keep up.
const resolution = new AdaptiveResolution(renderer, { max: Math.min(window.devicePixelRatio, 1.5) });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);

// --- the set ---
// Set frame [d, s] -> world: d runs along +x with the set centred on the origin, s along +z.
const SET_CENTRE_D = (placeD(1) + placeD(4)) / 2;
const toWorld = ([d, s]) => new THREE.Vector3(d - SET_CENTRE_D, 0, s);

const perf = createPerformance();
let rigs = [];
let bandStage = null;
let character = null;

const pending = [
  loadHall(scene, renderer).catch((err) => console.error('Failed to load the hall', err)),
  loadDancers({ perf, toWorld }).then((loaded) => {
    rigs = loaded;
    for (const r of rigs) scene.add(r.object);
  }).catch((err) => console.error('Failed to load the dancers', err)),
  loadSpectatorCharacter().then((loaded) => {
    character = loaded;
    scene.add(character.object);
  }).catch((err) => console.error('Failed to load the spectator', err)),
  loadBandStage(perf).then((loaded) => {
    bandStage = loaded;
    scene.add(bandStage.object);
  }).catch((err) => console.error('Failed to load the band', err)),
];

function placeDancers(bar) {
  poseDancers(rigs, perf, bar);
}

// --- the spectator ---
const colliders = collidersFromLayout(layout);
const spectator = createSpectator(layout.spectatorStart);
// The selected dancer, whose floor path is drawn (E while looking at them).
let selected = null;
const floorPath = new FloorPath(perf, toWorld);
scene.add(floorPath.object);
const select = (id) => {
  selected = id;
  floorPath.select(id);
};
if (params.has('select')) select(params.get('select'));
const rig = new CameraRig(camera, colliders, spectator.yaw);
if (params.get('view') === 'gallery') rig.toggleGallery();
const input = createInput(renderer.domElement, {
  onLook: (dx, dy) => rig.look(dx, dy),
  onGallery: () => rig.toggleGallery(),
});

// --- HUD ---
const hud = createHud({
  perf,
  layout,
  titleScreen: frozenBar === null,
  async onEnter() {
    const ctx = new AudioContext();
    await ctx.resume();
    startTransport(ctx);
    hud.enter();
  },
  onAgain: () => danceAgain(),
});
let floorDancers = []; // where the dancers are this frame, world x/z
const dancerById = (id) => perf.dancers.find((d) => d.id === id);
// From the gallery the spectator isn't on the floor to interact with anything.
const interaction = () => (clock && !rig.gallery
  ? interactionAt(spectator, layout, { yaw: rig.yaw, dancers: floorDancers, selected })
  : null);
const promptText = () => {
  const here = interaction();
  if (here?.kind === 'band') return `<b>E</b>${clock.running ? 'Pause' : 'Resume'} the band`;
  if (here?.kind === 'dancer') return `<b>E</b>${here.selected ? 'Deselect' : 'Select'} ${dancerName(dancerById(here.id))}`;
  if (here?.kind === 'clear') return `<b>E</b>Deselect ${dancerName(dancerById(here.id))}`;
  return null;
};
// The end of the dance: the clock stops there, so Space or Dance again start from the chord.
const ended = () => clock !== null && scrubBar === null && clock.bar >= perf.lengthBars - 1e-6;
const danceAgain = () => clock.play(0);
const minimapDancers = (bar) => perf.dancers.map(({ id, couple, role }) => {
  const { p } = perf.poseAt(id, bar);
  const w = toWorld(p);
  return { id, couple, role, x: w.x, z: w.z };
});

// --- clock and transport ---
let clock = null;
let band = null;
let transport = null;
let scrubBar = null; // bar shown while dragging the timeline
let resumeAfterScrub = false;

function startTransport(ctx) {
  clock = new DanceClock(ctx, { lengthBars: perf.lengthBars });
  band = new Band(clock, perf);
  transport = createTransport({
    perf,
    speeds: SPEEDS,
    onScrub(bar) {
      if (scrubBar === null) {
        resumeAfterScrub = clock.running;
        if (clock.running) clock.pause();
      }
      scrubBar = bar;
    },
    onSeek(bar) {
      scrubBar = null;
      if (resumeAfterScrub) clock.play(bar);
      else clock.seek(bar);
    },
    onTogglePlay: () => clock.toggle(),
    onSpeed: (speed) => clock.setSpeed(speed),
  });
  document.body.appendChild(transport.element);
  input.enable();
  clock.play(0);
}

const KEYS = {
  BracketRight: () => clock.seek(nextBar(perf, clock.bar)),
  BracketLeft: () => clock.seek(previousBar(perf, clock.bar)),
  Period: () => clock.seek(nextFigure(perf, clock.bar)),
  Comma: () => clock.seek(previousFigure(perf, clock.bar)),
  Space: () => clock.toggle(),
  KeyE: () => {
    const here = interaction();
    if (here?.kind === 'band') clock.toggle();
    else if (here?.kind === 'dancer') select(here.selected ? null : here.id);
    else if (here?.kind === 'clear') select(null);
  },
  KeyH: () => hud.toggleControls(),
  Enter: () => {
    if (ended()) danceAgain();
  },
};
const NO_REPEAT = new Set(['Space', 'KeyE', 'KeyH', 'Enter']); // holding these down mustn't flicker play and pause
window.addEventListener('keydown', (e) => {
  const action = clock && scrubBar === null && KEYS[e.code];
  if (!action || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.repeat && NO_REPEAT.has(e.code)) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  action();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const currentBar = () => frozenBar ?? scrubBar ?? clock?.bar ?? 0;
// The band plays what is heard, not what the timeline is being dragged to.
const bandBar = () => frozenBar ?? clock?.bar ?? 0;
let posedBandBar = 0;

// Movement is simulated in fixed small steps over the real elapsed time, so a slow frame
// doesn't slow the spectator down (only a long stall, like a background tab, is cut short).
const SIM_STEP = 1 / 120;
const MAX_CATCH_UP = 0.5;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const work = performance.now();
  const dt = Math.min(MAX_CATCH_UP, (now - last) / 1000);
  last = now;
  // Only once the dance is on: loading and the title screen aren't a fair measure.
  if (clock && frozenBar === null) resolution.frame(dt);
  if (clock?.running && ended()) clock.pause();
  const bar = currentBar();
  placeDancers(bar);
  posedBandBar = bandBar();
  bandStage?.update(posedBandBar);
  for (let t = 0; t < dt; t += SIM_STEP) {
    stepSpectator(spectator, input.state, rig.yaw, Math.min(SIM_STEP, dt - t), colliders);
  }
  character?.update(spectator, dt);
  floorDancers = minimapDancers(bar);
  floorPath.update(bar);
  // Frozen screenshots skip the ease into the gallery view.
  rig.update(spectator, frozenBar === null ? dt : 1);
  if (fixedCamera) {
    camera.position.set(...fixedCamera.slice(0, 3));
    camera.lookAt(...fixedCamera.slice(3));
  }
  // Hidden from the gallery, and when the camera is tucked in against a wall (so as not to look
  // out from inside the spectator's head).
  if (character) character.object.visible = rig.blend < 0.5 && rig.reach > 0.7;
  hud.update(bar, {
    dancers: floorDancers,
    selected: selected && { ...dancerById(selected), points: floorPath.points },
    spectator,
    prompt: promptText(),
    ended: ended(),
  });
  transport?.update(bar, { running: clock.running, speed: clock.speed });
  const drawn = performance.now();
  renderer.render(scene, camera);
  const done = performance.now();
  // Smoothed milliseconds spent updating and submitting each frame (debugging, scripts/fps.js).
  cpu.lastUpdate = drawn - work;
  cpu.lastRender = done - drawn;
  cpu.update = cpu.update * 0.95 + (drawn - work) * 0.05;
  cpu.render = cpu.render * 0.95 + (done - drawn) * 0.05;
});
const cpu = { update: 0, render: 0 };

Promise.all(pending).then(() => {
  hud.ready();
  document.body.dataset.ready = 'true';
});

// Exposed for tests and debugging.
window.scd = {
  perf,
  colliders,
  get bar() { return currentBar(); },
  get running() { return clock?.running ?? false; },
  get speed() { return clock?.speed ?? 1; },
  get notesScheduled() { return band?.scheduledNotes ?? 0; },
  get recentNoteBars() { return band?.recentNoteBars ?? []; },
  get spectator() { return { x: spectator.x, z: spectator.z, yaw: spectator.yaw }; },
  get band() { return bandStage; },
  get character() { return character && { weights: character.weights, phase: character.phase, speed: character.speed }; },
  get selected() { return selected; },
  get interaction() { return interaction(); },
  get floorPath() { return { visible: floorPath.object.visible, points: floorPath.points, ring: floorPath.ring.position.toArray() }; },
  get minimap() { return { points: hud.minimap.points, toMap: hud.minimap.toMap }; },
  get ended() { return ended(); },
  /** Jumps to bar time `bar` as the timeline would (tests). */
  seek(bar) {
    clock.seek(bar);
  },
  renderer,
  scene,
  get pixelRatio() { return renderer.getPixelRatio(); },
  get cpuMs() {
    return { update: +cpu.update.toFixed(2), render: +cpu.render.toFixed(2), lastUpdate: cpu.lastUpdate, lastRender: cpu.lastRender };
  },
  get renderInfo() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
  /** Bar time the band was last posed at, and its pose then. */
  get bandFrame() { return { bar: posedBandBar, pose: bandStage?.snapshot() }; },
  /** Puts the spectator at world x, z (tests). */
  place(x, z) {
    spectator.x = x;
    spectator.z = z;
  },
  get view() { return { mode: rig.mode, position: camera.position.toArray() }; },
  get input() { return input.state; },
  get rigs() { return rigs; },
  look(yaw, pitch = rig.pitch) {
    rig.yaw = yaw;
    rig.pitch = pitch;
  },
};
