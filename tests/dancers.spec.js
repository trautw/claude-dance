import { test, expect } from '@playwright/test';

async function open(page, bar, errors) {
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`/?bar=${bar}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

test('eight rigged dancers in their couples’ tartans', async ({ page }) => {
  const errors = [];
  await open(page, 0, errors);
  const info = await page.evaluate(() => window.scd.rigs.map((r) => ({
    id: r.dancer.id,
    skinned: (() => { let n = 0; r.object.traverse((o) => { if (o.isSkinnedMesh) n++; }); return n; })(),
    tartan: (() => { let uuid = null; r.object.traverse((o) => { const ms = [o.material].flat(); for (const m of ms) if (m?.name === 'Tartan') uuid = m.map?.uuid; }); return uuid; })(),
  })));
  expect(info).toHaveLength(8);
  for (const d of info) expect(d.skinned).toBeGreaterThan(0);
  // Partners share a tartan; couples differ.
  const byCouple = Object.groupBy(info, (d) => d.id[0]);
  for (const c of 'ABCD') expect(byCouple[c][0].tartan).toBe(byCouple[c][1].tartan);
  expect(new Set(info.map((d) => d.tartan)).size).toBe(4);
  expect(errors).toEqual([]);
});

test('planted feet stay exactly where the footwork puts them, all through a time through', async ({ page }) => {
  const errors = [];
  await open(page, 0, errors);
  const worst = await page.evaluate(async () => {
    const { footAt } = await import('/src/dance/footwork.js');
    let worst = { err: 0 };
    for (const rig of window.scd.rigs) {
      for (let t = 2; t < 42; t += 1 / 16) {
        rig.update(t);
        rig.object.updateMatrixWorld(true);
        for (const side of ['L', 'R']) {
          const f = footAt(rig.plan, side, t);
          if (!f.planted) continue;
          const ankle = rig.bones[`foot${side}`].getWorldPosition(new rig.object.position.constructor());
          const want = rig.toWorld(f.point);
          const err = Math.hypot(ankle.x - want.x, ankle.z - want.z);
          if (err > worst.err) worst = { err, t, id: rig.dancer.id, side };
        }
      }
    }
    return worst;
  });
  expect(worst.err, `${worst.id} ${worst.side} at bar time ${worst.t}`).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('the men bow and the women curtsey on the opening chord', async ({ page }) => {
  const errors = [];
  await open(page, 0, errors);
  const heads = await page.evaluate(() => window.scd.rigs.map((r) => {
    const y = (t) => {
      r.update(t);
      r.object.updateMatrixWorld(true);
      return r.bones.head.getWorldPosition(new r.object.position.constructor()).y;
    };
    return { id: r.dancer.id, upright: y(0.2), bowed: y(1.25), after: y(1.95) };
  }));
  for (const h of heads) {
    expect(h.upright - h.bowed, `${h.id} lowers their head`).toBeGreaterThan(0.04);
    expect(Math.abs(h.after - h.upright), `${h.id} stands up again`).toBeLessThan(0.01);
  }
  expect(errors).toEqual([]);
});

test('the kilt swings out as the man turns', async ({ page }) => {
  const errors = [];
  await open(page, 0, errors);
  const swing = await page.evaluate(() => {
    const r = window.scd.rigs.find((x) => x.dancer.id === 'A.M');
    // The kilt's swing relative to the hips, against its resting angle.
    const relative = () => {
      r.object.updateMatrixWorld(true);
      const hips = r.bones.hips.getWorldQuaternion(r.object.quaternion.clone());
      return hips.invert().multiply(r.bones.kilt.getWorldQuaternion(r.object.quaternion.clone()));
    };
    r.update(0.5);
    const rest = relative();
    const tilt = (t) => {
      r.update(t);
      return relative().angleTo(rest);
    };
    return { standing: tilt(0.5), turning: tilt(3.0) };
  });
  expect(swing.turning).toBeGreaterThan(swing.standing + 0.05);
  expect(errors).toEqual([]);
});
