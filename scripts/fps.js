// Measures frame rate on this machine's real GPU (headless Chromium through ANGLE/Metal, or the
// platform default elsewhere), in the views a visitor spends time in, while the dance plays.
// Usage: npm run fps   (prints a table and writes screenshots/fps.json)
//        npm run fps -- --uncapped   (no vsync: shows the headroom above 60)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 5185;
const SECONDS = 8;
const GPU_ARGS = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--enable-gpu', '--ignore-gpu-blocklist'];
// A laptop screen: a 1440×900 window on a 2× display (the app renders at up to 1.5×).
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;

const VIEWS = [
  { name: 'Third person, by the set', setup: () => { window.scd.place(3.2, 2.4); window.scd.look(-2.2, 0.25); } },
  { name: 'Third person, looking up the hall', setup: () => { window.scd.place(8, 0); window.scd.look(-Math.PI / 2, 0.15); } },
  { name: 'In front of the band', setup: () => { window.scd.place(-4.8, 0.5); window.scd.look(-Math.PI / 2, 0.1); } },
  { name: 'Gallery view', setup: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })) },
];

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const uncapped = process.argv.includes('--uncapped');
const browser = await chromium.launch({
  args: [...GPU_ARGS, ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
});
const results = [];
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('body[data-ready]', { timeout: 30000 });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
  });
  await page.click('#start');
  for (const view of VIEWS) {
    await page.evaluate(`(${view.setup})()`);
    await page.waitForTimeout(1500); // settle (the gallery view eases in)
    const r = await page.evaluate((seconds) => new Promise((resolve) => {
      const times = [];
      let last = performance.now();
      const end = last + seconds * 1000;
      const tick = (now) => {
        times.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else resolve({ times, info: window.scd.renderInfo, ratio: window.scd.pixelRatio });
      };
      requestAnimationFrame(tick);
    }), SECONDS);
    const sorted = [...r.times].sort((a, b) => a - b);
    const mean = r.times.reduce((a, b) => a + b, 0) / r.times.length;
    const worst = sorted.slice(Math.floor(sorted.length * 0.99));
    results.push({
      view: view.name,
      fps: +(1000 / mean).toFixed(1),
      p95ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
      low1: +(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length)).toFixed(1),
      ratio: r.ratio,
      calls: r.info.calls,
      triangles: r.info.triangles,
    });
  }
  console.log(`GPU: ${gpu}${uncapped ? ' (vsync off)' : ''}\nViewport ${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x, ${SECONDS} s per view, dance playing\n`);
  console.table(results);
  if (errors.length) console.log('Console errors:', errors);
  writeFileSync(`screenshots/fps${uncapped ? '-uncapped' : ''}.json`, `${JSON.stringify({ gpu, uncapped, viewport: VIEWPORT, scale: SCALE, results, errors }, null, 2)}\n`);
} finally {
  await browser.close();
  server.kill();
}
