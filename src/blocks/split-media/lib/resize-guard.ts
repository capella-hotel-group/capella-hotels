const RESIZE_SETTLE_MS = 150;

interface ResizeGuardOptions {
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

// Suppress breakpoint-driven transforms before asking the controller to settle its current
// transition. Navigation stays paused until resizing stops and transitions are restored.
export function suppressTransitionsDuringResize(
  block: HTMLElement,
  { className = 'split-media-resizing', onStart, onEnd }: ResizeGuardOptions = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resizing = false;
  const handleResize = (): void => {
    block.classList.add(className);
    if (!resizing) {
      resizing = true;
      onStart?.();
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Commit the breakpoint's resting transforms before restoring transitions.
      void block.offsetHeight;
      block.classList.remove(className);
      resizing = false;
      onEnd?.();
    }, RESIZE_SETTLE_MS);
  };
  window.addEventListener('resize', handleResize);
  const track = block.querySelector<HTMLElement>('.split-media-track');
  // Only width crosses a breakpoint. The track is 100dvh, so its height also changes every time a
  // mobile URL bar collapses — reacting to that would cancel gestures and re-align mid-scroll.
  let lastWidth = track?.getBoundingClientRect().width;
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          const width = track?.getBoundingClientRect().width;
          if (width === undefined || width === lastWidth) return;
          lastWidth = width;
          handleResize();
        });
  if (track) observer?.observe(track);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', handleResize);
    clearTimeout(timer);
    block.classList.remove(className);
  };
}
