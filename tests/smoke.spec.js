import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('the dance plays to the audio clock with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.screenshot({ path: 'screenshots/start.png' });

  await page.click('#start');
  await page.waitForTimeout(3500);
  const { bar, notes } = await page.evaluate(() => ({ bar: window.scd.bar, notes: window.scd.recentNoteBars }));
  // 56 bars a minute: about 3 bars in 3.5 s (minus the start delay).
  expect(bar).toBeGreaterThan(2.3);
  expect(bar).toBeLessThan(3.6);
  // The band has played up to (and a little ahead of) what the dancers are dancing, never behind.
  const latest = Math.max(...notes);
  expect(latest).toBeGreaterThanOrEqual(bar - 0.2);
  expect(latest).toBeLessThanOrEqual(bar + 0.5);
  await expect(page.locator('#hud-bars')).toHaveText('/ 40');
  await page.screenshot({ path: 'screenshots/playing.png' });

  expect(errors).toEqual([]);
});

for (const bar of [1, 13.5, 120.5, 162, 238.5, 323]) {
  test(`frozen at bar time ${bar}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/?bar=${bar}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/bar-${bar}.png` });
    expect(errors).toEqual([]);
  });
}
