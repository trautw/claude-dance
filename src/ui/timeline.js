// The transport bar: play/pause, a timeline of the whole dance marked by time through and
// figure, and the speed selector. It only reports intentions; the clock decides what happens.
import './timeline.css';
import { describe } from './describe.js';
import { figureStarts, snapToBar } from '../dance/navigation.js';
import { COUPLE_COLOURS } from '../dancers/placeholders.js';

const PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>';
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * @param {object} o
 * @param {(bar: number) => void} o.onScrub   preview a bar while dragging
 * @param {(bar: number) => void} o.onSeek    jump to a bar boundary
 * @param {() => void} o.onTogglePlay
 * @param {(speed: number) => void} o.onSpeed
 */
export function createTransport({ perf, speeds, onScrub, onSeek, onTogglePlay, onSpeed }) {
  const root = document.createElement('div');
  root.className = 'transport';
  root.innerHTML = `
    <button class="play" aria-label="Pause">${PAUSE}</button>
    <div class="timeline" role="slider" aria-label="Position in the dance" aria-valuemin="0"
         aria-valuemax="${perf.lengthBars}" tabindex="-1">
      <div class="rail"><div class="fill"></div></div>
      <div class="head"></div>
      <div class="tip"></div>
    </div>
    <div class="speeds" role="group" aria-label="Speed">
      ${speeds.map((s) => `<button data-speed="${s}">${s}×</button>`).join('')}
    </div>`;

  const playButton = root.querySelector('.play');
  const timeline = root.querySelector('.timeline');
  const fill = root.querySelector('.fill');
  const head = root.querySelector('.head');
  const tip = root.querySelector('.tip');
  const pct = (b) => `${(100 * b) / perf.lengthBars}%`;

  const segments = perf.sections
    .filter((s) => s.kind === 'timeThrough')
    .map((s) => {
      const el = document.createElement('div');
      el.className = 'segment';
      el.style.left = pct(s.b0);
      el.style.width = pct(s.b1 - s.b0);
      el.innerHTML = `${s.n}<span class="who" style="background:${hex(COUPLE_COLOURS[s.dancingCouple])}"></span>`;
      el.title = `Time through ${s.n} · Couple ${s.dancingCouple}`;
      timeline.append(el);
      return { s, el };
    });
  for (const b of figureStarts(perf)) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = pct(b);
    timeline.append(tick);
  }

  const barAt = (clientX) => {
    const r = timeline.getBoundingClientRect();
    return (Math.min(r.width, Math.max(0, clientX - r.left)) / r.width) * perf.lengthBars;
  };
  const showTip = (b) => {
    const { title, detail } = describe(perf, Math.min(b, perf.lengthBars - 1e-6));
    tip.innerHTML = `<b>${title}</b>${detail ? `<br><span>${detail}</span>` : ''}`;
    tip.style.left = pct(b);
  };

  let dragging = false;
  timeline.addEventListener('pointerdown', (e) => {
    dragging = true;
    timeline.classList.add('dragging');
    timeline.setPointerCapture(e.pointerId);
    const b = snapToBar(perf, barAt(e.clientX));
    showTip(b);
    onScrub(b);
  });
  timeline.addEventListener('pointermove', (e) => {
    const b = snapToBar(perf, barAt(e.clientX));
    showTip(b);
    if (dragging) onScrub(b);
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    timeline.classList.remove('dragging');
    onSeek(snapToBar(perf, barAt(e.clientX)));
  };
  timeline.addEventListener('pointerup', release);
  timeline.addEventListener('pointercancel', release);

  // Buttons let go of focus so Space keeps meaning play/pause rather than "press this again".
  playButton.addEventListener('click', () => {
    playButton.blur();
    onTogglePlay();
  });
  for (const b of root.querySelectorAll('.speeds button')) {
    b.addEventListener('click', () => {
      b.blur();
      onSpeed(Number(b.dataset.speed));
    });
  }

  let lastRunning = null;
  let lastSpeed = null;
  return {
    element: root,
    /** Redraws for bar time `bar`; cheap enough to call every frame. */
    update(bar, { running, speed }) {
      fill.style.width = pct(bar);
      head.style.left = pct(bar);
      timeline.setAttribute('aria-valuenow', bar.toFixed(1));
      for (const { s, el } of segments) el.classList.toggle('current', bar >= s.b0 && bar < s.b1);
      if (running !== lastRunning) {
        playButton.innerHTML = running ? PAUSE : PLAY;
        playButton.setAttribute('aria-label', running ? 'Pause' : 'Play');
        lastRunning = running;
      }
      if (speed !== lastSpeed) {
        for (const b of root.querySelectorAll('.speeds button')) {
          b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed));
        }
        lastSpeed = speed;
      }
    },
  };
}
