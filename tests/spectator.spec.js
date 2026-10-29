import { test, expect } from '@playwright/test';

async function enterHall(page, errors) {
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await expect(page.locator('.transport')).toBeVisible();
  // Let the first, slow frames (shader compilation) pass before timing any movement.
  await page.waitForTimeout(1500);
}
const where = (page) => page.evaluate(() => window.scd.spectator);
const view = (page) => page.evaluate(() => window.scd.view);
const hold = async (page, keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};

test('W walks where the camera looks; Shift runs', async ({ page }) => {
  const errors = [];
  await enterHall(page, errors);
  await page.evaluate(() => window.scd.look(Math.PI / 2)); // look along +x
  const a = await where(page);
  await hold(page, ['KeyW'], 1000);
  const b = await where(page);
  expect(b.x - a.x).toBeGreaterThan(1.0);
  expect(Math.abs(b.z - a.z)).toBeLessThan(0.2);
  await page.evaluate(() => window.scd.look(-Math.PI / 2)); // turn round
  await hold(page, ['ShiftLeft', 'KeyW'], 1000);
  const c = await where(page);
  expect(b.x - c.x).toBeGreaterThan(2.5); // running covers much more ground
  expect(errors).toEqual([]);
});

test('the walls stop the spectator and the camera stays inside the hall', async ({ page }) => {
  const errors = [];
  await enterHall(page, errors);
  const I = await page.evaluate(() => window.scd.colliders.interior);
  await page.evaluate(() => window.scd.look(0)); // look toward the +z wall
  await hold(page, ['ShiftLeft', 'KeyW'], 2500);
  const s = await where(page);
  expect(s.z).toBeLessThanOrEqual(I.maxZ - 0.3 + 1e-3);
  expect(s.z).toBeGreaterThan(I.maxZ - 0.35);
  // Turn to face away from the wall: the camera would now be behind it, so it must pull in.
  await page.evaluate(() => window.scd.look(Math.PI));
  await page.waitForTimeout(300);
  const { position } = await view(page);
  expect(position[2]).toBeLessThan(I.maxZ - 0.15);
  await page.screenshot({ path: 'screenshots/against-wall.png' });
  expect(errors).toEqual([]);
});

test('C eases into the gallery view and back', async ({ page }) => {
  const errors = [];
  await enterHall(page, errors);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(1200);
  let v = await view(page);
  expect(v.mode).toBe('gallery');
  expect(v.position[1]).toBeGreaterThan(5.5);
  await page.screenshot({ path: 'screenshots/gallery.png' });
  // Walking still works in the gallery view.
  const a = await where(page);
  await hold(page, ['KeyW'], 600);
  expect((await where(page)).x).not.toBe(a.x);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(1200);
  v = await view(page);
  expect(v.mode).toBe('third-person');
  expect(v.position[1]).toBeLessThan(4);
  expect(errors).toEqual([]);
});

test('dragging the mouse looks around', async ({ page }) => {
  const errors = [];
  await enterHall(page, errors);
  const before = await page.evaluate(() => window.scd.view.position);
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.mouse.move(840, 300, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.scd.view.position);
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
