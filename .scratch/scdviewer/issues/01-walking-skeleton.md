# 01: Walking skeleton: Blender → browser → Playwright

**What to build:** `npm install && npm run dev` serves a Three.js page showing a placeholder dance floor that was produced as a .glb by a Blender script run headless (`blender --background --python …`) and kept in the `/blender` folder. A Playwright check loads the page, fails on any console error, and saves a screenshot. This proves the asset pipeline and the self-test loop end to end before anything else is built.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `npm install && npm run dev` starts the app with no extra steps
- [x] The dance floor shown is a .glb exported by a Blender script in `/blender`, run headless (Blender lives at `/Applications/Blender.app/Contents/MacOS/Blender`, not on PATH)
- [x] A single command rebuilds all Blender assets
- [x] A Playwright check fails on console errors and writes a screenshot
- [x] No models, textures, images, sounds, music or fonts are downloaded from the internet
