// Screenshots of the whole experience for a review pass: the title, then the start, middle and
// end of the dance from the views a visitor would use, on this machine's GPU. Fails on any
// console error.
// Usage: npm run review -- <pass name>   (writes screenshots/review/<pass name>/*.png)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const name = process.argv[2] ?? 'latest';
const dir = `screenshots/review/${name}`;
mkdirSync(dir, { recursive: true });
const PORT = 5187;
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];

// [file, bar time, how to look]
const SHOTS = [
  ['2-start', 1.2, { place: [4.6, 3.6], look: [-2.24, 0.26] }],
  ['3-start-close', 1.3, { place: [1.4, 2.6], look: [-2.6, 0.12] }],
  ['4-middle', 2 + 4 * 40 + 11.5, { place: [3.4, 2.2], look: [-2.1, 0.3] }],
  ['5-middle-gallery', 2 + 4 * 40 + 27.5, { gallery: true }],
  ['6-middle-band', 2 + 4 * 40 + 30, { place: [-3.6, 2.2], look: [-1.95, 0.05] }],
  ['7-end', 324, { place: [4.6, 3.6], look: [-2.24, 0.26] }],
];

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: GPU_ARGS });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('body[data-ready]', { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/1-title.png` });
  await page.click('#start');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space'); // hold each moment still
  let gallery = false;
  for (const [file, bar, view] of SHOTS) {
    await page.evaluate(({ bar, view }) => {
      window.scd.seek(bar);
      if (view.place) {
        window.scd.place(...view.place);
        window.scd.look(...view.look);
      }
    }, { bar, view });
    if (Boolean(view.gallery) !== gallery) {
      await page.keyboard.press('KeyC');
      gallery = !gallery;
    }
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${dir}/${file}.png` });
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Screenshots in ${dir}`);
if (errors.length) {
  console.error('Console errors:', errors);
  process.exit(1);
}
