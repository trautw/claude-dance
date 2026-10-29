// Draws every dancer's floor path, one panel per figure, as seen from above with the band at the top.
// Writes screenshots/floor-paths.png (and .svg) for reviewing choreography by eye.
// Usage: npm run plot [-- <time through, default 1>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createPerformance } from '../src/dance/choreography.js';
import { CRIB } from '../src/dance/crib.js';
const perf = createPerformance();
const n = Number(process.argv[2] ?? 1);
const section = perf.sections.find((x) => x.kind === 'timeThrough' && x.n === n);
const col = { A: '#c0392b', B: '#2e6fd8', C: '#2e9e5b', D: '#e0a526' };
// d down the page; s across: s<0 (men) drawn on the right as seen from the band at the top of the page
const X = (s) => 150 - s * 80, Y = (d) => 60 + d * 80;
const panels = [];
const figs = CRIB.figures.map((f) => [section.b0 + f.bars[0] - 1, section.b0 + f.bars[1], `${f.bars[0]}–${f.bars[1]} ${f.name}`.slice(0, 34)]);
figs.forEach(([b0,b1,name],k)=>{
  let g = `<g transform="translate(${(k%5)*300},${Math.floor(k/5)*420})"><rect width="296" height="416" fill="#fbf8f2" stroke="#ccc"/><text x="10" y="22" font-size="15" font-family="sans-serif">${name}</text><text x="10" y="40" font-size="11" fill="#888" font-family="sans-serif">T${n} · band at top · men right</text>`;
  for (const d of perf.dancers) {
    const pts=[]; for(let t=b0;t<=b1+1e-9;t+=0.05){const {p}=perf.poseAt(d.id,t);pts.push(`${X(p[1]).toFixed(1)},${Y(p[0]).toFixed(1)}`);}
    const dash = d.role==='W' ? 'stroke-dasharray="5 3"' : '';
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col[d.couple]}" stroke-width="2.2" ${dash}/>`;
    const s=perf.poseAt(d.id,b0), e=perf.poseAt(d.id,b1);
    g += `<circle cx="${X(s.p[1])}" cy="${Y(s.p[0])}" r="5" fill="none" stroke="${col[d.couple]}" stroke-width="1.5"/>`;
    g += `<circle cx="${X(e.p[1])}" cy="${Y(e.p[0])}" r="5" fill="${col[d.couple]}"/><line x1="${X(e.p[1])}" y1="${Y(e.p[0])}" x2="${X(e.p[1]+e.h[1]*0.25)}" y2="${Y(e.p[0]+e.h[0]*0.25)}" stroke="#000" stroke-width="2"/>`;
    g += `<text x="${X(e.p[1])+7}" y="${Y(e.p[0])+4}" font-size="10" font-family="sans-serif">${d.couple}${d.role==='M'?'m':'w'}</text>`;
  }
  panels.push(g+'</g>');
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="840">${panels.join('')}</svg>`;
mkdirSync('screenshots', { recursive: true });
writeFileSync(`screenshots/floor-paths-${n}.svg`, svg);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 840 } });
await page.setContent(svg);
await page.screenshot({ path: `screenshots/floor-paths-${n}.png` });
await browser.close();
console.log(`Wrote screenshots/floor-paths-${n}.png`);
