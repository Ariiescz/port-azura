import { KEYS } from './config.js';

// Central keyboard + pointer input for the shift.
//
// Held keys ("down") drive continuous motion. Edge keys ("consume") fire once
// per press. Synthetic keys let the headless autopilot drive the same code
// path as a real player. Pointer drag on the canvas feeds the orbit camera.
export function createInput(canvasEl) {
  const held = new Set();
  const synthetic = new Set();
  const pressed = new Set();

  // Game control keys (plus F and M used by later phases) should not trigger
  // browser scrolling or menu shortcuts.
  const ownedKeys = new Set([...Object.values(KEYS).flat(), 'KeyF', 'KeyM']);

  let pointerId;
  let lastX = 0;
  let lastY = 0;
  let moveX = 0;
  let moveY = 0;

  function down(code) {
    return held.has(code) || synthetic.has(code);
  }

  function consume(code) {
    return pressed.delete(code);
  }

  function consumeAny(codes) {
    let hit = false;
    for (const code of codes) {
      if (consume(code)) hit = true;
    }
    return hit;
  }

  function setSynthetic(codes) {
    const wanted = new Set(codes);
    for (const code of wanted) {
      if (!down(code)) pressed.add(code);
    }
    synthetic.clear();
    for (const code of wanted) synthetic.add(code);
  }

  function drag() {
    const result = { x: moveX, y: moveY };
    moveX = 0;
    moveY = 0;
    return result;
  }

  function releasePointer() {
    if (pointerId !== undefined) {
      if (canvasEl.hasPointerCapture(pointerId)) canvasEl.releasePointerCapture(pointerId);
      pointerId = undefined;
    }
  }

  function clear() {
    held.clear();
    synthetic.clear();
    pressed.clear();
    releasePointer();
    lastX = 0;
    lastY = 0;
    moveX = 0;
    moveY = 0;
  }

  function guard(event) {
    if (ownedKeys.has(event.code)) event.preventDefault();
  }

  window.addEventListener('keydown', event => {
    guard(event);
    if (!down(event.code) && !event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', event => {
    guard(event);
    held.delete(event.code);
  });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  });

  canvasEl.addEventListener('pointerdown', event => {
    if (pointerId !== undefined || event.button !== 0) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvasEl.setPointerCapture(pointerId);
  });
  canvasEl.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    moveX += event.clientX - lastX;
    moveY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvasEl.addEventListener('pointerup', event => {
    if (event.pointerId === pointerId) releasePointer();
  });
  canvasEl.addEventListener('pointercancel', event => {
    if (event.pointerId === pointerId) releasePointer();
  });
  canvasEl.addEventListener('lostpointercapture', event => {
    if (event.pointerId === pointerId) pointerId = undefined;
  });

  return { down, setSynthetic, consume, consumeAny, drag };
}
