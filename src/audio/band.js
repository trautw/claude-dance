// The band: plays the arrangement on the dance clock. Notes are scheduled a little ahead of
// time; whenever the clock jumps, pauses or changes speed, queued notes are dropped, sounding
// ones fade, and scheduling resumes from the new position.

import { arrange } from './arrangement.js';
import { INSTRUMENTS } from './instruments.js';

const LOOKAHEAD_S = 0.2;
const TICK_MS = 25;
const RECENT = 32;

const MIX = { accordion: 0.9, fiddle: 1.5, piano: 0.85, kick: 0.45, snare: 1.1, hat: 1.4, crash: 0.6 };

/** A short, warm hall: decaying noise, darker as it fades. */
function hallImpulse(ctx, seconds = 1.8) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.15 + 0.6 * t; // more smoothing (darker) later in the tail
      lp += (Math.random() * 2 - 1 - lp) * (1 - k);
      data[i] = lp * (1 - t) ** 2.4;
    }
  }
  return ir;
}

/** The band's mixing desk: a bus per instrument, a touch of hall, gentle compression. */
export function createMixer(ctx, destination = ctx.destination) {
  const master = ctx.createGain();
  master.gain.value = 0.75;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.2;
  const reverb = ctx.createConvolver();
  reverb.buffer = hallImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  master.connect(comp).connect(destination);
  master.connect(reverb).connect(wet).connect(comp);
  const buses = Object.fromEntries(
    Object.entries(MIX).map(([inst, level]) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(master);
      return [inst, g];
    }),
  );
  return { master, buses };
}

export class Band {
  constructor(clock, perf) {
    this.clock = clock;
    this.ctx = clock.ctx;
    this.events = arrange(perf);
    this.index = 0;
    this.voices = [];
    this.scheduledNotes = 0;
    this.recentNoteBars = [];
    this.timer = null;

    this.buses = createMixer(this.ctx).buses;

    clock.onChange(() => this.reset());
    this.reset();
  }

  reset() {
    const now = this.ctx.currentTime;
    for (const v of this.voices) v.cancel(now);
    this.voices = [];
    clearInterval(this.timer);
    this.timer = null;
    if (!this.clock.running) return;
    const from = this.clock.barAtTime(Math.max(now, this.clock.anchor.time));
    this.index = lowerBound(this.events, from - 1e-6);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  schedule() {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    const secondsPerBar = this.clock.barDuration;
    while (this.index < this.events.length) {
      const e = this.events[this.index];
      const when = this.clock.timeOfBar(e.bar);
      if (when > now + LOOKAHEAD_S) return;
      if (when >= now - 0.005) {
        const at = Math.max(when, now);
        this.voices.push(INSTRUMENTS[e.inst](this.ctx, this.buses[e.inst], at, e.dur * secondsPerBar, e.midi, e.vel));
        this.scheduledNotes++;
        this.recentNoteBars.push(e.bar);
        if (this.recentNoteBars.length > RECENT) this.recentNoteBars.shift();
      }
      this.index++;
    }
    clearInterval(this.timer);
    this.timer = null;
  }
}

function lowerBound(events, bar) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].bar < bar) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
