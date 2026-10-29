# Quality passes

Each pass: screenshots of the title and the start, middle and end of the dance (`npm run review`,
on the GPU, failing on any console error), a critical look, fixes, and the same screenshots
again. Before and after sets are in `screenshots/review/`.

## Pass 0: frame rate

Measured with `npm run fps` (Apple M3, 1440×900 window on a 2× screen, dance playing).

| | Capped FPS | Uncapped FPS | Main cost |
| --- | --- | --- | --- |
| Before | 60 | 66–88 | GPU pixel fill: 2880×1800 with antialiasing, about 10 ms a frame |
| After | 60 (1% lows 59.5) | 108–131 | |

- Profiling showed the page's own work is about 1 ms a frame. Rendering at 1× instead of 2×
  was 2.5 times faster, the shadow map cost about 3 ms, and the HUD's blur barely mattered.
- **Changes**
  - The canvas draws at up to 1.5× pixel density; with antialiasing on a Retina screen it is
    hard to tell from 2×.
  - Dynamic resolution steps the density down toward 1× on a GPU that can't hold about
    52 fps. It judges by the median frame, so a hitch from the browser doesn't set it off.
- `npm run fps -- --uncapped` shows the headroom above 60.

## Pass 1: the people

Before: `screenshots/review/pass1-before/` · after: `screenshots/review/pass1-after/`

| Seen | Fixed |
| --- | --- |
| All eight dancers had the same hair and skin: the set looked like copies of one person | Each dancer has their own hair (black, brown, auburn, red, blonde, grey) and skin tone |
| The spectator's shirt showed as a wide white ruff across the shoulders and back | The waistcoat comes up over the shoulder blades; the shirt shows only at the collar, in the V at the front and in the sleeves |
| During the chords, "All couples" sat indented by an empty colour dot | The dot is gone when no couple is dancing |
| The controls panel stays up the whole dance | It folds into a small "H Controls" button after 40 seconds, unless the visitor has opened or closed it |
| The review's start shots caught the set just before the bow | They're taken during the bow |

The spectator's walk and run were also checked from the side (`screenshots/review/gait/`). The
walk reads heel to toe with an opposite arm swing; the run has both feet off the ground between
strides and bent arms. No change needed.

## Pass 2: light and focus

Before: `screenshots/review/pass2-before/` (the pass 1 results) · after: `screenshots/review/pass2-after/`

| Seen | Fixed |
| --- | --- |
| The hall was lit evenly edge to edge, so the set didn't stand out from the walls | A soft pool of light over the set, and the general fill turned down a little |
| The picture felt flat at the edges | A light vignette under the HUD draws the eye to the middle |
| In the gallery view the spectator stood half out of the bottom of the frame, and the E prompt offered to select dancers from the balcony | From the gallery the spectator is hidden and nothing offers interaction |
| A console warning on every load: "PCFSoftShadowMap has been removed" | The shadow type asked for is the one three.js uses |

The frame rate was measured again after the extra light: still 60 everywhere, 108–131 uncapped.
