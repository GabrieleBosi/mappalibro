/**
 * Shared mutable input state, written by keyboard listeners, the virtual
 * joystick, and the touch-look surface; consumed once per frame by the
 * player controller. Deliberately NOT React state — it changes every frame.
 */

export interface InputState {
  /** Normalized move intent: x = strafe right, y = forward. Range -1..1. */
  move: { x: number; y: number };
  /** Accumulated look deltas in px since last frame; consumed each frame. */
  lookDelta: { x: number; y: number };
  /** Edge-triggered interact (E key / travel button); consumed once. */
  interactQueued: boolean;
}

export const input: InputState = {
  move: { x: 0, y: 0 },
  lookDelta: { x: 0, y: 0 },
  interactQueued: false,
};

export function consumeLookDelta(): { x: number; y: number } {
  const d = { x: input.lookDelta.x, y: input.lookDelta.y };
  input.lookDelta.x = 0;
  input.lookDelta.y = 0;
  return d;
}

export function consumeInteract(): boolean {
  const v = input.interactQueued;
  input.interactQueued = false;
  return v;
}

const pressed = new Set<string>();

function syncMoveFromKeys() {
  const x =
    (pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0) -
    (pressed.has('KeyA') || pressed.has('ArrowLeft') ? 1 : 0);
  const y =
    (pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0) -
    (pressed.has('KeyS') || pressed.has('ArrowDown') ? 1 : 0);
  input.move.x = x;
  input.move.y = y;
}

/** Attach WASD/arrow + E listeners. Returns cleanup (StrictMode-safe). */
export function attachKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') {
      input.interactQueued = true;
      return;
    }
    pressed.add(e.code);
    syncMoveFromKeys();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    pressed.delete(e.code);
    syncMoveFromKeys();
  };
  const onBlur = () => {
    pressed.clear();
    syncMoveFromKeys();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    onBlur();
  };
}

/** True on touch-first devices: render joystick + touch look instead of pointer lock. */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  // debug override: ?input=touch / ?input=pointer forces a control scheme
  const forced = new URLSearchParams(window.location.search).get('input');
  if (forced === 'touch') return true;
  if (forced === 'pointer') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
