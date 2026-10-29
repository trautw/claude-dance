// Keyboard and mouse for the spectator: WASD to move, Shift to run, mouse to look (pointer
// lock on click, or drag when the browser won't lock), C for the gallery view.

export function createInput(canvas, { onLook, onGallery }) {
  const held = new Set();
  let enabled = false;
  let dragging = false;

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
  window.addEventListener('keydown', (e) => {
    if (!enabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (MOVE_KEYS.has(e.code)) {
      held.add(e.code);
      e.preventDefault();
    } else if (e.code === 'KeyC' && !e.repeat) {
      onGallery();
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('click', () => {
    if (!enabled || document.pointerLockElement === canvas) return;
    // Some browsers (and headless ones) refuse; dragging still works then.
    Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
  });
  canvas.addEventListener('mousedown', () => {
    dragging = true;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!enabled) return;
    if (document.pointerLockElement === canvas || dragging) onLook(e.movementX, e.movementY);
  });

  return {
    enable() {
      enabled = true;
    },
    get state() {
      return {
        forward: held.has('KeyW'),
        back: held.has('KeyS'),
        left: held.has('KeyA'),
        right: held.has('KeyD'),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
  };
}
