import { test, expect } from '@playwright/test';

test('the whole dance, figure by figure from the opening chord to the closing one', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.click('#start');
  await page.keyboard.press('Space');

  // Every figure start, then the end, by the same key a visitor would press.
  const length = await page.evaluate(() => window.scd.perf.lengthBars);
  await page.evaluate(() => window.scd.seek(0));
  let seen = 0;
  for (;;) {
    const before = await page.evaluate(() => window.scd.bar);
    if (before >= length) break;
    await page.keyboard.press('Period');
    const bar = await page.evaluate(() => window.scd.bar);
    expect(bar).toBeGreaterThan(before);
    seen++;
    // The HUD follows, and every dancer is on the floor, inside the hall.
    const { section, n } = await page.evaluate((b) => {
      const s = window.scd.perf.sections.find((x) => b < x.b1) ?? window.scd.perf.sections.at(-1);
      return { section: s.kind, n: s.n };
    }, bar);
    const expected = bar >= length || section === 'chord' ? /chord/ : new RegExp(`Time through ${n}/8`);
    await expect(page.locator('#hud-through')).toHaveText(expected);
    const outside = await page.evaluate(() => window.scd.rigs.filter((r) => {
      const { x, z } = r.object.position;
      return !(x > -6.6 && x < 11 && Math.abs(z) < 7.5);
    }).length);
    expect(outside).toBe(0);
  }
  expect(seen).toBe(8 * 9 + 2); // nine figures a time through, the closing chord, the end
  await expect(page.locator('#again')).toBeVisible();
  expect(errors).toEqual([]);
});
