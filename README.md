# SCDVIEWER

Walk round a village hall in third person while a Scottish country dance set dances
**Mairi's Wedding** (a reel, 8×40 bars) to a live band. Every model was built by a Blender
script in this repository, every texture is procedural, and all the music is played by Web
Audio, so nothing is downloaded at runtime.

**Try it in the browser:** https://trautw.github.io/claude-dance/

## Run it

```bash
npm install && npm run dev
```

Open the address Vite prints (usually http://localhost:5173) and press **Enter the hall**. The
browser only allows sound to start on a click, which is why the dance waits for that button.

## Controls

| Key | What it does |
| --- | --- |
| **W A S D** | Walk, relative to where you look |
| **Shift** | Run (hold with W A S D) |
| **Mouse** | Look round (click the hall to lock the pointer, Esc to release; dragging works too) |
| **E** | Interact. Looking at a dancer: select them, which draws their path on the floor and the minimap; on the selected dancer, or looking away, deselects. In front of the stage: pause or resume the band. Not from the gallery view. |
| **C** | Gallery view: watch the whole set from above, and back |
| **Space** | Play / pause |
| **[** / **]** | Back / on one bar |
| **,** / **.** | Back / on one figure |
| **H** | Show or hide the controls (they fold away by themselves after a while) |
| **Enter** | Dance again, at the end |

The timeline at the bottom shows the whole dance, divided by time through and figure: click or
drag it to go anywhere. The buttons beside it play the dance at 0.5×, 0.75× or full speed; the
band and dancers stay together at every speed.

## Other scripts

The browser tests, `review` and `fps` drive Chromium through Playwright. Install its browser
once first:

```bash
npx playwright install chromium
```

| Command | What it does |
| --- | --- |
| `npm run assets` | Rebuilds every model in `public/models` by running `blender/build_*.py` headless. Needs Blender 4.3 (found via `$BLENDER`, the macOS app or `PATH`). |
| `npm test` | Unit tests (choreography, footwork, music, band playing, HUD text, selection) |
| `npm run test:smoke` | Browser tests with Playwright, on software WebGL so they run anywhere |
| `npm run review -- <name>` | Screenshots the title and the start, middle and end of the dance on your GPU into `screenshots/review/<name>`; fails on any console error |
| `npm run fps` | Measures the frame rate on your GPU in four views (`-- --uncapped` shows headroom above 60) |

## Performance

Measured with `npm run fps` on a MacBook with an Apple M3 (1440×900 window on a 2× screen,
the dance playing):

| View | FPS | Without vsync |
| --- | --- | --- |
| Third person, by the set | 60 | 131 |
| Third person, looking up the hall | 60 | 126 |
| In front of the band | 60 | 116 |
| Gallery view | 60 | 108 |

At 60 fps the 1% lows were 59.5 in every view. The app draws at up to 1.5× pixel density.
On a GPU that can't hold about 52 fps, it lowers the resolution step by step, down to 1×.

How the improvement passes went is in [docs/quality-passes.md](docs/quality-passes.md).
