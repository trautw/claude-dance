import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Every minimap mark sits where its dancer is (within a pixel), and the spectator is drawn. */
async function expectMinimapTracksDancers(page) {
  const { points, expected } = await page.evaluate(() => {
    const { points, toMap } = window.scd.minimap;
    const expected = Object.fromEntries(window.scd.rigs.map((r) => [r.dancer.id, toMap(r.object.position.x, r.object.position.z)]));
    return { points, expected };
  });
  expect(points).toHaveLength(8);
  for (const p of points) {
    expect(Math.abs(p.u - expected[p.id][0])).toBeLessThan(1);
    expect(Math.abs(p.v - expected[p.id][1])).toBeLessThan(1);
  }
}

test('title screen, then the HUD through the dance, then Dance again', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('.title-card h1')).toHaveText("Mairi's Wedding");
  await expect(page.locator('.title-card')).toContainText('SCDVIEWER');
  await expect(page.locator('.title-card')).toContainText('Reel · 8×40');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('#start')).toHaveText('Enter the hall');
  await expect(page.locator('.hud')).toBeHidden();
  await page.screenshot({ path: 'screenshots/hud-title.png' });

  // Enter: the dance starts from the opening chord.
  await page.click('#start');
  await expect(page.locator('.title-screen')).toHaveCount(0);
  await expect(page.locator('.hud .dance')).toBeVisible();
  expect(await page.evaluate(() => window.scd.bar)).toBeLessThan(2);
  await expect(page.locator('#hud-through')).toHaveText('Opening chord');
  await expect(page.locator('#hud-figure')).toHaveText('Bow and curtsey');
  await expect(page.locator('#hud-next')).toHaveText('Turn right hand');
  await expect(page.locator('#hud-type')).toHaveText('Reel');
  await expect(page.locator('#controls')).toContainText('Walk');

  // A jump into the middle: every field follows. Paused, so the bar holds still.
  await page.keyboard.press('Space');
  await page.evaluate(() => window.scd.seek(2 + 4 * 40 + 12)); // time through 5, bar 13
  await expect(page.locator('#hud-through')).toHaveText('Time through 5/8');
  await expect(page.locator('#hud-couple')).toHaveText('Couple C dancing');
  await expect(page.locator('#hud-bar')).toHaveText('13');
  await expect(page.locator('#hud-bars')).toHaveText('/ 40');
  await expect(page.locator('#hud-figure')).toHaveText('Half diagonal reel of four with 2nd corners');
  await expect(page.locator('#hud-next')).toHaveText('Half diagonal reel of four with 1st corners, in 3rd corner positions');
  await page.waitForTimeout(400);
  await expectMinimapTracksDancers(page);
  await page.screenshot({ path: 'screenshots/hud-middle.png' });

  // H hides the controls and shows them again.
  await page.keyboard.press('KeyH');
  await expect(page.locator('#controls')).toBeHidden();
  await expect(page.locator('#show-controls')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(page.locator('#controls')).toBeVisible();

  // Playing on through the end: the clock stops and Dance again appears.
  const length = await page.evaluate(() => window.scd.perf.lengthBars);
  await page.evaluate((b) => window.scd.seek(b), length - 0.6);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.scd.ended), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#again')).toBeVisible();
  expect(await page.evaluate(() => window.scd.running)).toBe(false);
  await expect(page.locator('#hud-through')).toHaveText('Closing chord');
  await expect(page.locator('#hud-next')).toHaveText('—');
  await page.waitForTimeout(400);
  await expectMinimapTracksDancers(page);
  await page.screenshot({ path: 'screenshots/hud-end.png' });

  await page.click('#again');
  await expect(page.locator('#again')).toBeHidden();
  expect(await page.evaluate(() => window.scd.running)).toBe(true);
  expect(await page.evaluate(() => window.scd.bar)).toBeLessThan(1);
  await expect(page.locator('#hud-through')).toHaveText('Opening chord');
  expect(errors).toEqual([]);
});

test('Enter at the end dances again; the minimap moves with the dancers in real time', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await page.evaluate(() => window.scd.seek(2 + 9)); // into the turn left hand
  const before = await page.evaluate(() => window.scd.minimap.points.map((p) => [p.u, p.v]));
  await expect.poll(() => page.evaluate(() => window.scd.bar), { timeout: 15_000 }).toBeGreaterThan(12);
  const after = await page.evaluate(() => window.scd.minimap.points.map((p) => [p.u, p.v]));
  const moved = before.filter(([u, v], i) => Math.hypot(u - after[i][0], v - after[i][1]) > 2);
  expect(moved.length).toBeGreaterThanOrEqual(2);

  const length = await page.evaluate(() => window.scd.perf.lengthBars);
  await page.evaluate((b) => window.scd.seek(b), length);
  await expect(page.locator('#again')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#again')).toBeHidden();
  expect(await page.evaluate(() => window.scd.bar)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
