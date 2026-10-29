// Renders a stretch of the band offline, through the same instruments and mixer as playback,
// to screenshots/band-sample.wav, and prints levels per instrument for a quick balance check.
// Usage: npm run sample [-- <from bar time> <to bar time>]   (default: opening chord + 16 bars)
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const from = Number(process.argv[2] ?? 0);
const to = Number(process.argv[3] ?? 18);
const PORT = 5183;

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/?bar=0`);
  const result = await page.evaluate(async ([from, to]) => {
    const { createPerformance } = await import('/src/dance/choreography.js');
    const { arrange } = await import('/src/audio/arrangement.js');
    const { INSTRUMENTS } = await import('/src/audio/instruments.js');
    const { createMixer } = await import('/src/audio/band.js');
    const { REEL_BARS_PER_MINUTE } = await import('/src/audio/clock.js');
    const secondsPerBar = 60 / REEL_BARS_PER_MINUTE;
    const events = arrange(createPerformance()).filter((e) => e.bar >= from && e.bar < to);
    const rate = 44100;
    const length = Math.ceil(((to - from) * secondsPerBar + 2) * rate);

    async function render(only) {
      const ctx = new OfflineAudioContext(2, length, rate);
      const { buses } = createMixer(ctx);
      for (const e of events) {
        if (only && e.inst !== only) continue;
        INSTRUMENTS[e.inst](ctx, buses[e.inst], 0.05 + (e.bar - from) * secondsPerBar, e.dur * secondsPerBar, e.midi, e.vel);
      }
      return ctx.startRendering();
    }
    const stats = (buf) => {
      let peak = 0;
      let sum = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        sum += d[i] * d[i];
      }
      const db = (x) => (20 * Math.log10(x + 1e-12)).toFixed(1);
      return { peakDb: db(peak), rmsDb: db(Math.sqrt(sum / d.length)) };
    };

    const full = await render(null);
    const levels = { all: stats(full) };
    for (const inst of ['accordion', 'fiddle', 'piano', 'kick', 'snare', 'hat']) levels[inst] = stats(await render(inst));

    // 16-bit stereo WAV.
    const n = full.length;
    const buf = new ArrayBuffer(44 + n * 4);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 4, true);
    const L = full.getChannelData(0);
    const R = full.getChannelData(1);
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { levels, wav: btoa(bin) };
  }, [from, to]);

  mkdirSync('screenshots', { recursive: true });
  writeFileSync('screenshots/band-sample.wav', Buffer.from(result.wav, 'base64'));
  console.table(result.levels);
  console.log('Wrote screenshots/band-sample.wav');
} finally {
  await browser.close();
  server.kill();
}
