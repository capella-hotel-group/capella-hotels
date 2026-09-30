interface GestureActions {
  next: () => void;
  previous: () => void;
  begin: () => void;
  end: () => void;
}

export const INTERACTIVE_TARGET =
  'a, button, input, textarea, select, [contenteditable]:not([contenteditable="false"]), .adobe-ue-edit [data-aue-prop]';

/** Recognize a swipe on release, leaving native vertical scroll and pinch zoom alone. */
export function bindGestures(
  surface: HTMLElement,
  actions: GestureActions,
): { cancel: () => void; cleanup: () => void } {
  const listeners = new AbortController();
  const { signal } = listeners;
  let start: { id: number; x: number; y: number } | null = null;
  const contacts = new Set<number>();
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => {
    if (!contacts.size) return;
    contacts.clear();
    start = null;
    actions.end();
  };
  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (
        contacts.size ||
        event.isPrimary === false ||
        event.button !== 0 ||
        !(event.target instanceof Element) ||
        event.target.closest(INTERACTIVE_TARGET)
      )
        return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
      contacts.add(event.pointerId);
      actions.begin();
    },
    { signal },
  );
  // A second contact anywhere cancels recognition, so pinch zoom cannot turn a slide.
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!contacts.size) return;
      contacts.add(event.pointerId);
      if (contacts.size > 1) start = null;
    },
    { signal },
  );
  window.addEventListener(
    'pointerup',
    (event) => {
      if (!contacts.has(event.pointerId)) return;
      if (start && start.id === event.pointerId) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
          suppressClick = true;
          clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            suppressClick = false;
          }, 400);
          if (dx < 0) actions.next();
          else actions.previous();
        }
      }
      if (contacts.size === 1) cancel();
      else contacts.delete(event.pointerId);
    },
    { signal },
  );
  window.addEventListener('pointercancel', cancel, { signal });
  window.addEventListener('blur', cancel, { signal });
  surface.addEventListener(
    'dragstart',
    (event) => {
      if (start) event.preventDefault();
    },
    { signal },
  );
  surface.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    },
    { signal, capture: true },
  );
  return {
    cancel,
    cleanup: () => {
      listeners.abort();
      clearTimeout(clickTimer);
      cancel();
    },
  };
}
