// input.js — keyboard + mouse with per-frame edge detection
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, buttons: new Set() };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { mouse.buttons.add(e.button); unlockAudio(); });
  window.addEventListener('mouseup', (e) => mouse.buttons.delete(e.button));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => { keys.clear(); mouse.buttons.clear(); });

  // audio unlock on first interaction (attach once)
  let unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    const g = window.__game;
    if (g && g.sfx) g.sfx.unlock();
  }
  window.addEventListener('keydown', unlockAudio, { once: true });

  return {
    down(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    mouseDown(btn) { return mouse.buttons.has(btn); },
    mouse,
    mouseWorld(cam) {
      // invert: screen -> unrotate about center -> divide by zoom -> add cam
      const z = cam.zoom || 1;
      const dx = (mouse.x - 640) / z, dy = (mouse.y - 360) / z;
      const c = Math.cos(-cam.angle), s = Math.sin(-cam.angle);
      return { x: cam.x + dx * c - dy * s, y: cam.y + dx * s + dy * c };
    },
    endFrame() { pressed.clear(); },
  };
}
