// src/blocks/hero-destination/lib/swipe.ts
// "simulateTouch": lets mouse drag behave like a touch swipe (Pointer Events cover both), so
// desktop users can drag the carousel the same way touch users swipe it.
const SWIPE_THRESHOLD_PX = 50;

export function initSwipe(target: HTMLElement, onSwipe: (direction: 1 | -1) => void): void {
  let startX = 0;
  let startY = 0;
  // Tracks the pointer that started the drag so a second finger/pointer (multi-touch) or a
  // pointerup from an unrelated pointer can't be misread as ending this gesture.
  let activePointerId: number | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    // Without capture, a fast drag that releases outside `target` (very common on desktop,
    // dragging near the carousel edge) would never fire pointerup here at all.
    target.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    activePointerId = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    onSwipe(deltaX < 0 ? 1 : -1);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) activePointerId = null;
  };

  // Native image/video drag-ghost otherwise hijacks the gesture on desktop before pointerup fires.
  const onDragStart = (event: DragEvent): void => {
    event.preventDefault();
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('dragstart', onDragStart);
}
