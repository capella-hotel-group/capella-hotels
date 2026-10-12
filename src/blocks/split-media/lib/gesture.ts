import type { Direction } from './carousel-controller';

export const INTERACTIVE_TARGET =
  'a, button, input, textarea, select, [contenteditable]:not([contenteditable="false"]), .adobe-ue-edit [data-aue-prop]';
// Touch has no hover and no second button, so a link cannot opt out of scrolling the way it can for a
// mouse: the 6px threshold below already separates a tap from a swipe, and the click suppression at
// the end of a drag keeps the tap intact. Only controls that consume a drag themselves stay excluded.
export const TOUCH_BLOCKING_TARGET =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .adobe-ue-edit [data-aue-prop]';
// Weight of the newest sample in the release velocity, and the pause before lift-off that cancels it.
const VELOCITY_SMOOTHING = 0.7;
const VELOCITY_IDLE_MS = 80;
// Coalesced touchmoves report a large jump across a sub-millisecond gap; past this the reading is an
// artefact of the event batching rather than how fast the finger actually moved.
const VELOCITY_LIMIT = 4;
interface GestureActions {
  begin: (target: Element, direction: Direction, touch: boolean) => boolean;
  move: (delta: number) => void;
  end: (direction: Direction | null, velocity: number) => boolean;
  cancel: () => void;
}
interface Contact {
  id: number;
  x: number;
  y: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  target: Element;
  touch: boolean;
  owned: boolean;
}
/** Touch scroll ownership is decided on the first directional move, never by changing touch-action mid-gesture. */
export function bindGestures(
  surface: HTMLElement,
  actions: GestureActions,
): { cancel: () => void; cleanup: () => void } {
  const listeners = new AbortController();
  const { signal } = listeners;
  let contact: Contact | undefined;
  let suppressClickUntil = 0;
  const cancel = (): void => {
    if (contact?.owned) actions.cancel();
    contact = undefined;
  };
  const start = (id: number, x: number, y: number, target: EventTarget | null, touch: boolean): void => {
    cancel();
    if (!(target instanceof Element) || target.closest(touch ? TOUCH_BLOCKING_TARGET : INTERACTIVE_TARGET)) return;
    // Mouse dragging text remains native selection; touch can scroll the same copy region.
    if (!touch && target.closest('.split-media-overlay')) return;
    contact = { id, x, y, lastY: y, lastTime: performance.now(), velocity: 0, target, touch, owned: false };
  };
  const move = (x: number, y: number, event: Event): void => {
    const current = contact;
    if (!current) return;
    const dx = x - current.x;
    const dy = current.y - y;
    if (!current.owned) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (
        Math.abs(dx) >= Math.abs(dy) ||
        !event.cancelable ||
        !actions.begin(current.target, dy > 0 ? 1 : -1, current.touch)
      ) {
        cancel();
        return;
      }
      current.owned = true;
    }
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    const delta = current.lastY - y;
    const sample = Math.max(-VELOCITY_LIMIT, Math.min(VELOCITY_LIMIT, delta / Math.max(1, now - current.lastTime)));
    current.velocity = VELOCITY_SMOOTHING * sample + (1 - VELOCITY_SMOOTHING) * current.velocity;
    current.lastTime = now;
    actions.move(delta);
    current.lastY = y;
  };
  const end = (x: number, y: number): void => {
    const current = contact;
    if (!current) return;
    contact = undefined;
    if (!current.owned) return;
    const dx = x - current.x;
    const dy = current.y - y;
    const direction = Math.abs(dy) >= 40 && Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 1 : -1) : null;
    // A finger resting before it lifts means a deliberate stop, not momentum.
    const velocity = performance.now() - current.lastTime > VELOCITY_IDLE_MS ? 0 : current.velocity;
    if (actions.end(direction, velocity)) suppressClickUntil = performance.now() + 400;
  };
  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'touch') return;
      if (event.button !== 0 || event.isPrimary === false) {
        cancel();
        return;
      }
      start(event.pointerId, event.clientX, event.clientY, event.target, false);
    },
    { signal },
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (contact && !contact.touch && event.pointerId === contact.id) move(event.clientX, event.clientY, event);
    },
    { signal, passive: false },
  );
  window.addEventListener(
    'pointerup',
    (event) => {
      if (contact && !contact.touch && event.pointerId === contact.id) end(event.clientX, event.clientY);
    },
    { signal },
  );
  window.addEventListener('pointercancel', cancel, { signal });
  surface.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const touch = event.touches[0];
      if (touch) start(touch.identifier, touch.clientX, touch.clientY, event.target, true);
    },
    { signal, passive: true },
  );
  window.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) cancel();
    },
    { signal, passive: true },
  );
  window.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const touch = event.touches[0];
      if (contact?.touch && touch && touch.identifier === contact.id) move(touch.clientX, touch.clientY, event);
    },
    { signal, passive: false },
  );
  window.addEventListener(
    'touchend',
    (event) => {
      const touch = [...event.changedTouches].find((item) => item.identifier === contact?.id);
      if (contact?.touch && touch) end(touch.clientX, touch.clientY);
    },
    { signal },
  );
  window.addEventListener('touchcancel', cancel, { signal });
  window.addEventListener('blur', cancel, { signal });
  surface.addEventListener(
    'dragstart',
    (event) => {
      if (contact) event.preventDefault();
    },
    { signal },
  );
  surface.addEventListener(
    'click',
    (event) => {
      if (performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    },
    { signal, capture: true },
  );
  return {
    cancel,
    cleanup: () => {
      cancel();
      listeners.abort();
    },
  };
}
