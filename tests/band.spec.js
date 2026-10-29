import { test, expect } from '@playwright/test';

async function start(page, errors) {
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await expect(page.locator('.transport')).toBeVisible();
  await page.waitForTimeout(1500);
}

const frame = (page) => page.evaluate(() => window.scd.bandFrame);
const running = (page) => page.evaluate(() => window.scd.running);

/** The pose the band showed is exactly its pose for that bar time: no clock of its own. */
async function expectPoseFollowsBarTime(page) {
  const shown = await frame(page);
  const now = await page.evaluate(() => window.scd.bar);
  expect(Math.abs(now - shown.bar)).toBeLessThan(0.2);
  const recomputed = await page.evaluate((b) => {
    window.scd.band.update(b);
    return window.scd.band.snapshot();
  }, shown.bar);
  expect(recomputed).toEqual(shown.pose);
}

test('the band plays while the music plays, freezes on pause, and stays in time at every speed', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  // Playing: the band moves from frame to frame.
  const a = await frame(page);
  await expect.poll(async () => (await frame(page)).bar, { timeout: 5000 }).toBeGreaterThan(a.bar);
  expect((await frame(page)).pose).not.toEqual(a.pose);

  // Paused: frozen.
  await page.keyboard.press('Space');
  await expect.poll(() => running(page)).toBe(false);
  await page.waitForTimeout(800); // let any frame in flight land
  const c = await frame(page);
  await page.waitForTimeout(800);
  expect((await frame(page)).pose).toEqual(c.pose);

  for (const speed of ['0.5', '1']) {
    await page.click(`.speeds button[data-speed="${speed}"]`);
    await page.keyboard.press('Space');
    await expect.poll(() => running(page)).toBe(true);
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await expect.poll(() => running(page)).toBe(false);
    await page.waitForTimeout(800);
    await expectPoseFollowsBarTime(page);
  }
  expect(errors).toEqual([]);
});

test('near the band, E pauses and resumes; elsewhere E does nothing', async ({ page }) => {
  const errors = [];
  await start(page, errors);
  const prompt = page.locator('#prompt');

  // Where the spectator starts, far down the hall.
  await expect(prompt).toBeHidden();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect(await running(page)).toBe(true);

  // In front of the stage.
  await page.evaluate(() => window.scd.place(-5.5, 0.5));
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Pause the band');
  await page.keyboard.press('KeyE');
  await expect.poll(() => running(page)).toBe(false);
  await expect(prompt).toContainText('Resume the band');
  await page.keyboard.press('KeyE');
  await expect.poll(() => running(page)).toBe(true);
  await page.screenshot({ path: 'screenshots/band-prompt.png' });

  // Walk away: the prompt goes, E is ignored again.
  await page.evaluate(() => window.scd.place(8, 5)); // a far corner, no dancer in reach
  await expect(prompt).toBeHidden();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect(await running(page)).toBe(true);
  expect(errors).toEqual([]);
});
