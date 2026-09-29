// src/blocks/split-media/lib/resize-guard.ts
const RESIZE_SETTLE_MS = 150;

// breakpoint changes swap each item's enter/exit transform value; without suppressing the
// transition while the viewport is actively resizing, hidden slides visibly sweep through the
// frame as the media query recomputes ahead of the next JS-triggered slide change
export function suppressTransitionsDuringResize(block: HTMLElement, className = 'split-media-resizing'): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    block.classList.add(className);
    clearTimeout(timer);
    timer = setTimeout(() => block.classList.remove(className), RESIZE_SETTLE_MS);
  });
}
