import { test, expect } from '@playwright/test';

async function open(page, errors) {
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?bar=0');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

test('held hands meet, and let go again', async ({ page }) => {
  const errors = [];
  await open(page, errors);
  const result = await page.evaluate(async () => {
    const { poseDancers } = await import('/src/dancers/dancers.js');
    const { perf, rigs } = window.scd;
    const byId = new Map(rigs.map((r) => [r.dancer.id, r]));
    const gap = (hold, t) => {
      poseDancers(rigs, perf, t);
      const a = byId.get(hold.a).arm(hold.aHand).wrist;
      const b = byId.get(hold.b).arm(hold.bHand).wrist;
      return a.distanceTo(b);
    };
    let worstHeld = { gap: 0 };
    let released = Infinity;
    for (const hold of perf.holds.filter((h) => h.b1 < 45)) {
      for (let t = hold.b0 + hold.fade; t <= hold.b1 - hold.fade; t += 0.125) {
        const g = gap(hold, t);
        if (g > worstHeld.gap) worstHeld = { gap: g, t, a: hold.a, b: hold.b };
      }
      released = Math.min(released, gap(hold, hold.b1 + 0.3));
    }
    return { worstHeld, released };
  });
  expect(result.worstHeld.gap, JSON.stringify(result.worstHeld)).toBeLessThan(0.05);
  expect(result.released).toBeGreaterThan(0.1); // hands apart again after letting go
  expect(errors).toEqual([]);
});

test('elbows move smoothly: no flips while reaching, holding or letting go', async ({ page }) => {
  const errors = [];
  await open(page, errors);
  const worst = await page.evaluate(async () => {
    const { poseDancers } = await import('/src/dancers/dancers.js');
    const { perf, rigs } = window.scd;
    // Elbows in each dancer's own body frame, so travelling and turning don't count as movement.
    const elbows = () => rigs.flatMap((r) => ['L', 'R'].map((s) => {
      r.object.updateMatrixWorld(true);
      return r.object.worldToLocal(r.bones[`forearm${s}`].getWorldPosition(r.object.position.clone()));
    }));
    let worst = { jump: 0 };
    let prev = null;
    const step = 1 / 60;
    for (let t = 2; t < 42; t += step) {
      poseDancers(rigs, perf, t);
      const now = elbows();
      if (prev) {
        now.forEach((e, i) => {
          const jump = e.distanceTo(prev[i]);
          if (jump > worst.jump) worst = { jump, t, which: i };
        });
      }
      prev = now;
    }
    return worst;
  });
  // Reaching or letting go moves an elbow a few centimetres a step; a flip would jump far more.
  expect(worst.jump, JSON.stringify(worst)).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});
