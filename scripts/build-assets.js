// Rebuilds every 3D asset by running each blender/build_*.py headless.
// Blender is found via $BLENDER, then the macOS app bundle, then PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const macBlender = '/Applications/Blender.app/Contents/MacOS/Blender';
const blender = process.env.BLENDER || (existsSync(macBlender) ? macBlender : 'blender');

const scripts = readdirSync(join(root, 'blender'))
  .filter((f) => /^build_.*\.py$/.test(f))
  .sort();

for (const script of scripts) {
  console.log(`\n▶ ${script}`);
  execFileSync(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', join(root, 'blender', script)], {
    stdio: 'inherit',
  });
}
console.log(`\nBuilt ${scripts.length} asset script(s).`);
