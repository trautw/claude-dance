// Procedural tartans, one per couple: a sett of coloured stripes woven both ways, with a fine
// twill texture over it. Drawn on a canvas, nothing downloaded.
import * as THREE from 'three';

// Each sett is half a repeat, mirrored at both ends as real setts are: [colour, threads].
// One per couple, one for the band and one for the spectator.
export const SETTS = {
  A: [['#9e1b1f', 24], ['#0d1b3d', 8], ['#9e1b1f', 4], ['#e9d07a', 2], ['#9e1b1f', 12], ['#14402a', 10], ['#9e1b1f', 6], ['#f2efe6', 2]],
  B: [['#1d3c7a', 22], ['#0d1528', 8], ['#1d3c7a', 4], ['#8db4e2', 2], ['#1d3c7a', 10], ['#10402c', 10], ['#1d3c7a', 4], ['#f2efe6', 2]],
  C: [['#163d26', 22], ['#0b1424', 10], ['#163d26', 4], ['#0d0d0d', 6], ['#163d26', 10], ['#1b2d55', 10], ['#163d26', 4], ['#d9c060', 2]],
  D: [['#c7932a', 20], ['#1a1a1a', 8], ['#c7932a', 4], ['#8f1d1d', 4], ['#c7932a', 10], ['#1a1a1a', 4], ['#c7932a', 4], ['#f2efe6', 2]],
  // The band's own sett: navy and green with a red overstripe.
  band: [['#101c3c', 20], ['#0c2a1c', 12], ['#101c3c', 4], ['#a3171c', 3], ['#101c3c', 10], ['#0c2a1c', 6], ['#101c3c', 4], ['#c9b26a', 2]],
  // The spectator's waistcoat: a hunting sett, green and navy with fine red and yellow lines.
  spectator: [['#1f3d2b', 22], ['#0f1a33', 10], ['#1f3d2b', 4], ['#8f1d1d', 2], ['#1f3d2b', 12], ['#0f1a33', 6], ['#1f3d2b', 4], ['#d6b24a', 2]],
};

const cache = new Map();

export function tartanTexture(couple) {
  if (cache.has(couple)) return cache.get(couple);
  const half = SETTS[couple];
  const sett = [...half, ...[...half].reverse()];
  const threads = sett.reduce((n, [, w]) => n + w, 0);
  const SIZE = 256;
  const px = SIZE / threads;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  // Warp (vertical stripes), then weft (horizontal) at half strength: where they cross they mix.
  let x = 0;
  for (const [col, w] of sett) {
    g.fillStyle = col;
    g.fillRect(x, 0, w * px + 0.5, SIZE);
    x += w * px;
  }
  g.globalAlpha = 0.5;
  let y = 0;
  for (const [col, w] of sett) {
    g.fillStyle = col;
    g.fillRect(0, y, SIZE, w * px + 0.5);
    y += w * px;
  }
  // Twill: fine diagonal ribs.
  g.globalAlpha = 0.12;
  g.strokeStyle = '#000';
  g.lineWidth = 1;
  for (let d = -SIZE; d < SIZE; d += 3) {
    g.beginPath();
    g.moveTo(d, 0);
    g.lineTo(d + SIZE, SIZE);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(couple, tex);
  return tex;
}

/** The couple's signature colour: the sett's ground. */
export const tartanGround = (couple) => SETTS[couple][0][0];
