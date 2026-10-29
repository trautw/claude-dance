Build a complete, polished 3D browser experience called "SCDVIEWER" — a realistic dance floor I can walk through in third-person view, where I watch a scottish country dancer set dancing mairis wedding.

TECH & ASSET RULES

* Three.js (installed via npm) + Vite. It must start with `npm install && npm run dev`.
* ALL 3D models (the dance floor, dancers, musicians, the player character) must be created by you in Blender, using Python scripts you write and run headless (`blender --background --python <script>.py`), exported as .glb into the project. Keep the Blender scripts in a /blender folder.
* Do NOT download any models, textures, images, sounds, music or fonts from the internet. Textures must be procedural (shaders, canvas) or baked in Blender. Code libraries from npm are allowed.
* ALL sounds and music must be generated in code with the Web Audio API.

PRESENTATION (make it look like a premium product, not a demo)

* Clean HUD: dance title, current bar, mjsic type, progress bar, mini-map of the dancefloor, controls hint.
* Sound: keep music in sync with dancers
* Smooth third-person controls: WASD to walk, Shift to run, mouse to look, E to interact. Camera must not clip through walls.
* controls to move to a point in time of the dance

QUALITY BAR & SELF-TESTING

* The whole dance can be seen
* Run the experience in a headless browser (e.g. Playwright), check for console errors, and take screenshots of the start, mid and end of the dance. Review the screenshots critically and improve visuals, animations and UI. Do at least two full improvement passes.
* Target 60 FPS on a normal laptop.
* When done, write a short README with controls and how to run it.
