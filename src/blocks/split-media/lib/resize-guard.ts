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
  const track = block.querySelector<HTMLElement>('.split-media-track');
  const measure = (): number => (track ? track.getBoundingClientRect().width : window.innerWidth);
  let lastWidth = measure();
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
  // Only width crosses a breakpoint. The track is 100dvh, so its height also changes every time a
  // mobile URL bar collapses — and that fires `resize` just as it fires the observer, so both paths
  // have to go through the same check or a URL bar would cancel the gesture and re-align mid-scroll.
  const handleWidthChange = (): void => {
    const width = measure();
    if (width === lastWidth) return;
    lastWidth = width;
    handleResize();
  };
  window.addEventListener('resize', handleWidthChange);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(handleWidthChange);
  if (track) observer?.observe(track);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', handleWidthChange);
    clearTimeout(timer);
    block.classList.remove(className);
  };
}
