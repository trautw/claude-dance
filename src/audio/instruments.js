// Synthesised instruments of a Scottish dance band. Each `play` schedules one note and returns
// a Voice that can be cut off if the clock jumps before (or while) it sounds.

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class Voice {
  constructor(output, sources, start, end) {
    this.output = output; // the note's final gain node
    this.sources = sources;
    this.start = start;
    this.end = end;
  }

  /** Silences the note: drops it if it hasn't started, fades it quickly if it has. */
  cancel(now) {
    if (this.end <= now) return;
    if (this.start > now) {
      this.output.disconnect();
      return;
    }
    const g = this.output.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.03);
    for (const s of this.sources) s.stop(now + 0.05);
  }
}

let noiseBuffer = null;
function noise(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

function envelope(ctx, when, { attack, peak, sustain = peak, decay = 0.05, release, end }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  if (sustain !== peak) g.gain.setTargetAtTime(sustain, when + attack, decay);
  g.gain.setValueAtTime(sustain, Math.max(when + attack, end - release));
  g.gain.linearRampToValueAtTime(0, end);
  return g;
}

/** Accordion: three reeds tuned a little apart ("wet" musette tuning), shaped by the bellows. */
function accordion(ctx, out, when, dur, midi, vel) {
  const f = mtof(midi);
  const end = when + Math.max(0.05, dur * 0.94);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400 + 1600 * vel;
  tone.Q.value = 0.6;
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 1100;
  body.gain.value = 4;
  const env = envelope(ctx, when, { attack: 0.012, peak: 0.11 * vel, sustain: 0.09 * vel, decay: 0.08, release: 0.03, end });
  const sources = [-11, 0, 9].map((cents, i) => {
    const o = ctx.createOscillator();
    o.type = i === 1 ? 'square' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = i === 1 ? 0.55 : 0.7;
    o.connect(g).connect(tone);
    o.start(when);
    o.stop(end + 0.02);
    return o;
  });
  tone.connect(body).connect(env).connect(out);
  return new Voice(env, sources, when, end);
}

/** Fiddle: a bowed sawtooth through two body resonances, with vibrato on held notes. */
function fiddle(ctx, out, when, dur, midi, vel) {
  const f = mtof(midi);
  const end = when + Math.max(0.05, dur * 0.97);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const sources = [o];
  if (dur > 0.18) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.8;
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(f * 0.0045, when + Math.min(0.25, dur * 0.6));
    lfo.connect(depth).connect(o.frequency);
    lfo.start(when);
    lfo.stop(end + 0.02);
    sources.push(lfo);
  }
  const low = ctx.createBiquadFilter();
  low.type = 'peaking';
  low.frequency.value = 480;
  low.Q.value = 1.4;
  low.gain.value = 7;
  const high = ctx.createBiquadFilter();
  high.type = 'peaking';
  high.frequency.value = 2900;
  high.Q.value = 1.2;
  high.gain.value = 6;
  const air = ctx.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 6000;
  const env = envelope(ctx, when, { attack: 0.025, peak: 0.06 * vel, sustain: 0.05 * vel, decay: 0.06, release: 0.03, end });
  o.connect(low).connect(high).connect(air).connect(env).connect(out);
  o.start(when);
  o.stop(end + 0.02);
  return new Voice(env, sources, when, end);
}

/** Piano: a few slightly stretched partials, each dying away on its own. */
function piano(ctx, out, when, dur, midi, vel) {
  const f = mtof(midi);
  const ring = Math.max(dur, 0.25) * 1.6 + (midi < 50 ? 0.4 : 0.1);
  const end = when + ring;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(0.16 * vel, when + 0.004);
  env.gain.setTargetAtTime(0.0001, when + 0.004, ring / 4);
  const sources = [1, 2, 3, 4].map((k) => {
    const o = ctx.createOscillator();
    o.type = k === 1 ? 'triangle' : 'sine';
    o.frequency.value = f * k * (1 + 0.0004 * k * k);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1 / (k * k * 0.9), when);
    g.gain.setTargetAtTime(0, when, ring / (2 + k));
    o.connect(g).connect(env);
    o.start(when);
    o.stop(end);
    return o;
  });
  env.connect(out);
  return new Voice(env, sources, when, end);
}

function kick(ctx, out, when, _dur, _midi, vel) {
  const end = when + 0.3;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(115, when);
  o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.55 * vel, when);
  env.gain.exponentialRampToValueAtTime(0.001, end);
  o.connect(env).connect(out);
  o.start(when);
  o.stop(end);
  return new Voice(env, [o], when, end);
}

function snare(ctx, out, when, _dur, _midi, vel) {
  const end = when + 0.14;
  const n = noise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2600;
  band.Q.value = 0.7;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.6 * vel, when);
  env.gain.exponentialRampToValueAtTime(0.001, end);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = 195;
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.5, when);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  n.connect(band).connect(env);
  body.connect(bodyGain).connect(env);
  env.connect(out);
  n.start(when, Math.random() * 0.5);
  n.stop(end);
  body.start(when);
  body.stop(end);
  return new Voice(env, [n, body], when, end);
}

function metal(ctx, out, when, length, cutoff, level) {
  const end = when + length;
  const n = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = cutoff;
  const env = ctx.createGain();
  env.gain.setValueAtTime(level, when);
  env.gain.exponentialRampToValueAtTime(0.001, end);
  n.connect(hp).connect(env).connect(out);
  n.start(when, Math.random() * 0.5);
  n.stop(end);
  return new Voice(env, [n], when, end);
}

const hat = (ctx, out, when, _d, _m, vel) => metal(ctx, out, when, 0.045, 7500, 0.25 * vel);
const crash = (ctx, out, when, dur, _m, vel) => metal(ctx, out, when, Math.max(1.2, dur), 4500, 0.12 * vel);

export const INSTRUMENTS = { accordion, fiddle, piano, kick, snare, hat, crash };
