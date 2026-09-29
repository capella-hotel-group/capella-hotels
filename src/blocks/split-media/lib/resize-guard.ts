const RESIZE_SETTLE_MS = 150;

interface ResizeGuardOptions {
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

// Suppress breakpoint-driven transforms before asking the controller to settle its current
// transition. Keep queued navigation paused until resizing stops and transitions are restored.
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
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(timer);
    block.classList.remove(className);
  };
}
