import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function enter(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await expect(page.locator('.hud .dance')).toBeVisible();
}

/** Waits until the page has drawn two more frames (dancers posed for a seek). */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Stands a little outside the set from dancer `id` and looks straight at them. */
async function faceDancer(page, id) {
  await frames(page);
  await page.evaluate((id) => {
    const r = window.scd.rigs.find((x) => x.dancer.id === id);
    const { x, z } = r.object.position;
    const side = z >= 0 ? 1 : -1;
    window.scd.place(x, z + side * 1.2);
    window.scd.look(side > 0 ? Math.PI : 0, 0.3);
  }, id);
}

test('E on a dancer shows their path on the floor and the minimap; E again clears it', async ({ page }) => {
  const errors = collectErrors(page);
  await enter(page);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.scd.seek(2 + 40 + 8)); // time through 2, bar 9
  await expect.poll(() => page.evaluate(() => window.scd.running)).toBe(false);

  await faceDancer(page, 'B.W');
  await expect(page.locator('#prompt')).toHaveText("ESelect Couple B's woman");
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => window.scd.selected)).toBe('B.W');
  await expect(page.locator('#hud-selected')).toHaveText("Selected: Couple B's woman");
  await expect(page.locator('#prompt')).toHaveText("EDeselect Couple B's woman");

  // The path is this time through's, from its first bar to its last, and the ring is on her.
  const path = await page.evaluate(() => window.scd.floorPath);
  expect(path.visible).toBe(true);
  expect(path.points[0].t).toBe(42);
  expect(path.points.at(-1).t).toBe(82);
  const her = await page.evaluate(() => window.scd.rigs.find((r) => r.dancer.id === 'B.W').object.position.toArray());
  expect(Math.hypot(path.ring[0] - her[0], path.ring[2] - her[2])).toBeLessThan(0.01);
  const marked = await page.evaluate(() => window.scd.minimap.points.filter((p) => p.selected).map((p) => p.id));
  expect(marked).toEqual(['B.W']);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/select-path.png' });

  // The dance moves on: the ring follows her, and the next time through brings its own path.
  await page.evaluate(() => window.scd.seek(2 + 40 + 30));
  await expect.poll(async () => {
    const { ring } = await page.evaluate(() => window.scd.floorPath);
    const now = await page.evaluate(() => window.scd.rigs.find((r) => r.dancer.id === 'B.W').object.position.toArray());
    return Math.hypot(ring[0] - now[0], ring[2] - now[2]);
  }).toBeLessThan(0.01);
  await page.evaluate(() => window.scd.seek(2 + 80 + 3));
  await expect.poll(() => page.evaluate(() => window.scd.floorPath.points[0].t)).toBe(82);

  // Selecting another dancer switches; looking away, E clears.
  await faceDancer(page, 'A.M');
  await expect(page.locator('#prompt')).toHaveText("ESelect Couple A's man");
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => window.scd.selected)).toBe('A.M');
  await page.evaluate(() => {
    window.scd.place(6, -5);
    window.scd.look(Math.PI / 2, 0.2); // toward the back wall, away from the set
  });
  await expect(page.locator('#prompt')).toHaveText("EDeselect Couple A's man");
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => window.scd.selected)).toBe(null);
  expect(await page.evaluate(() => window.scd.floorPath.visible)).toBe(false);
  await expect(page.locator('#hud-selected')).toBeHidden();
  await expect(page.locator('#prompt')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the spectator stands idle, walks and runs', async ({ page }) => {
  const errors = collectErrors(page);
  await enter(page);
  await page.evaluate(() => window.scd.place(6, 0));
  await page.waitForTimeout(500);
  const still = await page.evaluate(() => window.scd.character);
  expect(still.weights.idle).toBeGreaterThan(0.95);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  const walking = await page.evaluate(() => window.scd.character);
  expect(walking.weights.walk).toBeGreaterThan(0.8);
  await page.screenshot({ path: 'screenshots/spectator-walk.png' });
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1200);
  const running = await page.evaluate(() => window.scd.character);
  expect(running.weights.run).toBeGreaterThan(0.6);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(1500);
  expect((await page.evaluate(() => window.scd.character)).weights.idle).toBeGreaterThan(0.9);
  expect(errors).toEqual([]);
});
