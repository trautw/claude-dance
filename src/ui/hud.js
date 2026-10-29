// The heads-up display: the title screen, the dance panel (title, time through, bar, figure),
// the minimap of the floor, the controls hint, the E prompt and the end-of-dance card. It only
// shows what it is told and reports button presses; main.js owns the clock.
import './hud.css';
import { CRIB } from '../dance/crib.js';
import { COUPLE_COLOURS } from '../dancers/placeholders.js';
import { describeHud } from './describe.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const DANCE = `${CRIB.title}`;
const SUBTITLE = `${CRIB.musicType} · ${CRIB.timesThrough}×${CRIB.barsPerTimeThrough}`;

const CONTROLS = [
  [['W', 'A', 'S', 'D'], 'Walk'],
  [['Shift'], 'Run'],
  [['Mouse'], 'Look'],
  [['E'], 'Interact'],
  [['C'], 'Gallery view'],
  [['Space'], 'Play / pause'],
  [['[', ']'], 'Bar back / on'],
  [[',', '.'], 'Figure back / on'],
  [['H'], 'Hide controls'],
];
/** "Couple B's woman". */
export const dancerName = ({ couple, role }) => `Couple ${couple}'s ${role === 'M' ? 'man' : 'woman'}`;
const CONTROLS_FOLD_S = 40;
const keys = (ks) => ks.map((k) => `<kbd>${k}</kbd>`).join('');

/**
 * @param {object} o
 * @param {object} o.perf
 * @param {object} o.layout the hall layout (for the minimap)
 * @param {boolean} o.titleScreen whether to start on the title screen
 * @param {() => void} o.onEnter  the title screen's button
 * @param {() => void} o.onAgain  the end card's button
 */
export function createHud({ perf, layout, titleScreen, onEnter, onAgain }) {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <section class="panel dance" aria-live="off">
      <header>
        <h1>${DANCE}</h1>
        <span class="type" id="hud-type">${CRIB.musicType}</span>
      </header>
      <p class="sub">${CRIB.timesThrough}×${CRIB.barsPerTimeThrough} · 3 couples in a 4-couple set</p>
      <div class="where">
        <div class="through">
          <b id="hud-through"></b>
          <span class="couple"><span class="dot"></span><span id="hud-couple"></span></span>
        </div>
        <div class="bar"><span class="label">Bar</span><b id="hud-bar"></b><span id="hud-bars"></span></div>
      </div>
      <dl class="figures">
        <dt>Now</dt><dd id="hud-figure"></dd>
        <dt>Next</dt><dd id="hud-next"></dd>
      </dl>
    </section>
    <aside class="side">
      <section class="panel map">
        <header><span>Dance floor</span><span class="legend">${
          Object.entries(COUPLE_COLOURS).map(([c, n]) => `<i style="--c:${hex(n)}">${c}</i>`).join('')
        }</span></header>
        <canvas id="minimap" aria-label="Minimap of the dance floor"></canvas>
        <footer><span><i class="man"></i>Man</span><span><i class="woman"></i>Woman</span><span><i class="you"></i>You</span></footer>
        <p class="selected" id="hud-selected" hidden></p>
      </section>
      <section class="panel controls" id="controls">
        ${CONTROLS.map(([k, what]) => `<div><span class="keys">${keys(k)}</span><span>${what}</span></div>`).join('')}
      </section>
      <button class="panel show-controls" id="show-controls"><kbd>H</kbd> Controls</button>
    </aside>
    <div class="prompt" id="prompt"></div>
    <section class="panel end" id="end" role="dialog" aria-label="The dance is over">
      <p>The set has danced ${DANCE} ${CRIB.timesThrough} times through.</p>
      <button id="again">Dance again <kbd>Enter</kbd></button>
    </section>`;
  // A soft vignette over the hall, under the HUD: draws the eye in to the set.
  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  document.body.append(vignette, root);

  const title = document.createElement('div');
  title.className = 'title-screen';
  title.innerHTML = `
    <div class="title-card">
      <p class="brand">SCDVIEWER</p>
      <h1>${DANCE}</h1>
      <p class="sub">${SUBTITLE}</p>
      <p class="blurb">A Scottish country dance set and its band, in the hall. Walk round them, watch from the gallery, or skip to any figure.</p>
      <button id="start" disabled>Tuning up…</button>
    </div>`;
  if (titleScreen) {
    document.body.appendChild(title);
    root.classList.add('hidden');
  }
  const startButton = title.querySelector('#start');
  startButton.addEventListener('click', () => {
    startButton.blur();
    onEnter();
  });

  const $ = (id) => root.querySelector(`#${id}`);
  const el = {
    through: $('hud-through'), couple: $('hud-couple'), bar: $('hud-bar'), bars: $('hud-bars'), figure: $('hud-figure'),
    next: $('hud-next'), selected: $('hud-selected'), prompt: $('prompt'), end: $('end'), controls: $('controls'), show: $('show-controls'),
    dot: root.querySelector('.couple .dot'),
  };
  const againButton = $('again');
  againButton.addEventListener('click', () => {
    againButton.blur();
    onAgain();
  });

  let controlsShown = true;
  let controlsTouched = false;
  const showControls = (shown) => {
    controlsShown = shown;
    el.controls.hidden = !shown;
    el.show.hidden = shown;
  };
  showControls(true);
  el.show.addEventListener('click', () => {
    el.show.blur();
    controlsTouched = true;
    showControls(true);
  });

  const minimap = createMinimap(root.querySelector('#minimap'), layout);

  // Only touch the DOM when a value changes.
  const shown = new Map();
  const set = (node, key, value, prop = 'textContent') => {
    if (shown.get(key) === value) return;
    shown.set(key, value);
    node[prop] = value;
  };

  return {
    element: root,
    minimap,
    /** The hall has loaded: the title screen's button can be pressed. */
    ready() {
      startButton.disabled = false;
      startButton.textContent = 'Enter the hall';
    },
    /** Leaves the title screen for the hall. */
    enter() {
      // The controls fold away after a while, unless the visitor has shown or hidden them.
      setTimeout(() => {
        if (!controlsTouched) showControls(false);
      }, CONTROLS_FOLD_S * 1000);
      title.classList.add('leaving');
      setTimeout(() => title.remove(), 700);
      root.classList.remove('hidden');
    },
    toggleControls() {
      controlsTouched = true;
      showControls(!controlsShown);
    },
    /**
     * Redraws for bar time `bar`. `dancers` are { couple, role, x, z, facing } in world
     * metres; `spectator` is { x, z, yaw }; `prompt` is HTML for the E prompt or null;
     * `ended` shows the end card; `selected` is the selected dancer { id, couple, role, points }
     * (their path this section, world metres) or null.
     */
    update(bar, { dancers, spectator, prompt, ended, selected = null }) {
      const h = describeHud(perf, bar);
      set(el.through, 'through', h.section);
      set(el.couple, 'couple', h.couple ? `Couple ${h.couple} dancing` : 'All couples');
      set(el.dot.style, 'dot', h.couple ? hex(COUPLE_COLOURS[h.couple]) : 'transparent', 'background');
      set(el.dot.style, 'dotShown', h.couple ? '' : 'none', 'display');
      set(el.bar, 'bar', String(h.bar));
      set(el.bars, 'bars', `/ ${h.bars}`);
      set(el.figure, 'figure', h.figure);
      set(el.next, 'next', h.next ?? '—');
      set(el.prompt, 'prompt', prompt ?? '', 'innerHTML');
      set(el.prompt.style, 'promptShown', prompt && !ended ? 'block' : 'none', 'display');
      set(el.end.style, 'end', ended ? 'block' : 'none', 'display');
      set(el.selected, 'selected', selected ? `Selected: ${dancerName(selected)}` : '');
      set(el.selected, 'selectedShown', !selected, 'hidden');
      minimap.draw(dancers, spectator, h.couple, selected);
    },
  };
}

/**
 * The floor around the set seen from above, the stage on the left: world x runs right and
 * world z down, so the map is the hall turned, not mirrored. Men are squares and women
 * circles, as in dance diagrams. A spectator off the map is pinned to its edge.
 */
function createMinimap(canvas, layout) {
  const { stage } = layout;
  const area = { minX: stage.maxX - 0.8, maxX: -stage.maxX + 0.8, minZ: -5, maxZ: 5 };
  const W = 232;
  const scale = W / (area.maxX - area.minX);
  const H = Math.round((area.maxZ - area.minZ) * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const g = canvas.getContext('2d');
  const toMap = (x, z) => [(x - area.minX) * scale, (z - area.minZ) * scale];
  let points = [];

  return {
    /** What was drawn last, in map pixels (tests). */
    get points() {
      return points;
    },
    toMap,
    draw(dancers, spectator, dancingCouple, selected) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // The floor and the edge of the stage.
      g.fillStyle = 'rgba(214, 170, 112, 0.16)';
      g.fillRect(0, 0, W, H);
      const [stageEdge] = toMap(stage.maxX, 0);
      g.fillStyle = 'rgba(255, 240, 220, 0.16)';
      g.fillRect(0, 0, stageEdge, H);
      g.save();
      g.translate(stageEdge / 2 + 3, H / 2);
      g.rotate(-Math.PI / 2);
      g.fillStyle = 'rgba(244, 234, 216, 0.6)';
      g.font = '600 8px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('STAGE', 0, 0);
      g.restore();

      // The selected dancer's path this section, under the marks.
      if (selected) {
        g.beginPath();
        selected.points.forEach(({ x, z }, i) => g[i ? 'lineTo' : 'moveTo'](...toMap(x, z)));
        g.strokeStyle = hex(COUPLE_COLOURS[selected.couple]);
        g.globalAlpha = 0.7;
        g.lineWidth = 1.5;
        g.lineJoin = 'round';
        g.stroke();
        g.globalAlpha = 1;
      }

      points = [];
      // The dancing couple are drawn last, on top.
      const order = [...dancers].sort((a, b) => (a.couple === dancingCouple) - (b.couple === dancingCouple));
      for (const d of order) {
        const [u, v] = toMap(d.x, d.z);
        points.push({ id: d.id, u, v, selected: d.id === selected?.id });
        const r = d.couple === dancingCouple ? 5 : 4.2;
        g.fillStyle = hex(COUPLE_COLOURS[d.couple]);
        g.strokeStyle = 'rgba(12, 9, 7, 0.85)';
        g.lineWidth = 1.5;
        g.beginPath();
        if (d.role === 'M') g.rect(u - r, v - r, 2 * r, 2 * r);
        else g.arc(u, v, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (d.id === selected?.id) {
          g.beginPath();
          g.arc(u, v, r + 4, 0, Math.PI * 2);
          g.strokeStyle = '#ffffff';
          g.lineWidth = 2;
          g.stroke();
        }
      }

      // The spectator: an arrow pointing where they face (world (sin yaw, cos yaw) in x/z).
      const [mu, mv] = toMap(spectator.x, spectator.z);
      const u = Math.min(W - 6, Math.max(6, mu));
      const v = Math.min(H - 6, Math.max(6, mv));
      const fu = Math.sin(spectator.yaw);
      const fv = Math.cos(spectator.yaw);
      g.save();
      g.globalAlpha = u === mu && v === mv ? 1 : 0.55;
      g.translate(u, v);
      g.rotate(Math.atan2(fv, fu));
      g.beginPath();
      g.moveTo(7, 0);
      g.lineTo(-5, -5);
      g.lineTo(-2, 0);
      g.lineTo(-5, 5);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.strokeStyle = 'rgba(12, 9, 7, 0.85)';
      g.lineWidth = 1.5;
      g.fill();
      g.stroke();
      g.restore();
    },
  };
}
