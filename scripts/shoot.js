// Screenshots of the app at given URLs, for reviewing visuals by eye.
// Usage: node scripts/shoot.js <out-prefix> "<query>" ["<query>" ...]
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const [prefix, ...queries] = process.argv.slice(2);
const PORT = 5184;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [i, q] of queries.entries()) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/?${q}`);
    await page.waitForSelector('body[data-ready]', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const path = `${prefix}-${i + 1}.png`;
    await page.screenshot({ path });
    console.log(path, q, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no errors');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
