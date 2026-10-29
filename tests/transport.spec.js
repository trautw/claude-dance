import { test, expect } from '@playwright/test';

const bar = (page) => page.evaluate(() => window.scd.bar);

async function start(page, errors) {
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await expect(page.locator('.transport')).toBeVisible();
}

/** The band's recent notes sit on the note grid and keep pace with the dancers. */
async function expectClicksOnBeats(page) {
  const { notes, bar } = await page.evaluate(() => ({ notes: window.scd.recentNoteBars, bar: window.scd.bar }));
  expect(notes.length).toBeGreaterThan(0);
  for (const b of notes) expect(Math.abs(b * 16 - Math.round(b * 16))).toBeLessThan(1e-6);
  const latest = Math.max(...notes);
  expect(latest).toBeGreaterThanOrEqual(bar - 0.2);
  expect(latest).toBeLessThanOrEqual(bar + 0.6);
}

test('keys jump by bar and by figure, landing on bar boundaries', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  await page.keyboard.press('Space'); // pause so positions stay put
  await expect.poll(() => page.evaluate(() => window.scd.running)).toBe(false);

  await page.keyboard.press('Period');
  expect(await bar(page)).toBe(2); // opening chord -> bar 1 of time through 1
  await page.keyboard.press('Period');
  expect(await bar(page)).toBe(4); // -> cast off
  await page.keyboard.press('BracketRight');
  expect(await bar(page)).toBe(5);
  await page.keyboard.press('BracketLeft');
  expect(await bar(page)).toBe(4);
  await page.keyboard.press('Comma');
  expect(await bar(page)).toBe(2);
  await expect(page.locator('#hud-through')).toHaveText('Time through 1/8');
  await expect(page.locator('#hud-couple')).toHaveText('Couple A dancing');
  await expect(page.locator('#hud-bar')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('clicking the timeline jumps there and the music follows', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  const box = await page.locator('.timeline').boundingBox();
  const length = await page.evaluate(() => window.scd.perf.lengthBars);
  // Aim at the middle of time through 4.
  const target = 2 + 3 * 40 + 20;
  await page.mouse.click(box.x + (box.width * target) / length, box.y + box.height / 2);
  const landed = await bar(page);
  expect(Math.abs(landed - target)).toBeLessThan(1.5);
  await expect(page.locator('#hud-through')).toContainText('Time through 4/8');

  await page.waitForTimeout(1200);
  const later = await bar(page);
  expect(later).toBeGreaterThan(landed + 0.5);
  await expectClicksOnBeats(page);
  await page.screenshot({ path: 'screenshots/transport.png' });
  expect(errors).toEqual([]);
});

test('dragging the timeline previews the dance and resumes playing where you let go', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  const box = await page.locator('.timeline').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
  const mid = await bar(page);
  expect(Number.isInteger(mid)).toBe(true);
  await page.waitForTimeout(400);
  expect(await bar(page)).toBe(mid); // held while dragging
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.scd.running)).toBe(true);
  expect(await bar(page)).toBeGreaterThan(mid);
  expect(errors).toEqual([]);
});

test('speed changes how fast bars pass, and the clicks stay on the beat', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  const rate = async () => {
    const a = await bar(page);
    await page.waitForTimeout(2000);
    return ((await bar(page)) - a) / 2;
  };
  const full = await rate();
  await page.click('.speeds button[data-speed="0.5"]');
  await page.waitForTimeout(200);
  const half = await rate();
  expect(full).toBeGreaterThan(0.85);
  expect(full).toBeLessThan(1.0);
  expect(half / full).toBeGreaterThan(0.45);
  expect(half / full).toBeLessThan(0.55);
  await expectClicksOnBeats(page);
  expect(errors).toEqual([]);
});

test('Space pauses and resumes', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  const held = await bar(page);
  await page.waitForTimeout(600);
  expect(await bar(page)).toBe(held);
  const notes = await page.evaluate(() => window.scd.notesScheduled);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scd.notesScheduled)).toBe(notes); // silence while paused
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  expect(await bar(page)).toBeGreaterThan(held);
  expect(errors).toEqual([]);
});
