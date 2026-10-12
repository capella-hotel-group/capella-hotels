const FALLBACK_BUFFER_MS = 50;

function milliseconds(value: string): number {
  return (Number.parseFloat(value) || 0) * (value.trim().endsWith('ms') ? 1 : 1000);
}

function transformTime(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const durations = style.transitionDuration.split(',').map(milliseconds);
  const delays = style.transitionDelay.split(',').map(milliseconds);
  let time = 0;
  style.transitionProperty.split(',').forEach((property, index) => {
    if (!['all', 'transform'].includes(property.trim())) return;
    const duration = durations[index % durations.length] ?? 0;
    time = duration > 0 ? Math.max(0, duration + (delays[index % delays.length] ?? 0)) : 0;
  });
  return time;
}

/** Wait for each element's own transform, with a computed-style fallback for missing events. */
export function waitForTransforms(elements: HTMLElement[], complete: (cancelled: boolean) => void): () => void {
  const timings = elements.map((element) => ({ element, time: transformTime(element) }));
  const pending = new Set(timings.filter(({ time }) => time > 0).map(({ element }) => element));
  if (!pending.size) {
    complete(false);
    return () => {};
  }

  let disposed = false;
  const timer = setTimeout(() => finish(false), Math.max(...timings.map(({ time }) => time)) + FALLBACK_BUFFER_MS);
  function cleanup(): void {
    disposed = true;
    clearTimeout(timer);
    elements.forEach((element) => {
      element.removeEventListener('transitionend', handleEvent);
      element.removeEventListener('transitioncancel', handleEvent);
    });
  }
  function finish(cancelled: boolean): void {
    if (disposed) return;
    cleanup();
    complete(cancelled);
  }
  function handleEvent(event: TransitionEvent): void {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (event.type === 'transitioncancel') {
      finish(true);
      return;
    }
    pending.delete(event.currentTarget as HTMLElement);
    if (!pending.size) finish(false);
  }
  pending.forEach((element) => {
    element.addEventListener('transitionend', handleEvent);
    element.addEventListener('transitioncancel', handleEvent);
  });
  return cleanup;
}
