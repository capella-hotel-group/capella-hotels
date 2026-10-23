// src/blocks/hero-video/lib/auto-advance.ts

export const FALLBACK_ADVANCE_MS = 6000;

/** Decides when the hero should move to the next item: on video end, or after a fallback delay. */
export class AutoAdvance {
  private count: number;
  private onAdvance: (index: number) => void;
  private ready = false;
  private pendingIndex: number | null = null;
  private fallbackTimer = 0;
  private destroyed = false;

  constructor(count: number, onAdvance: (index: number) => void) {
    this.count = count;
    this.onAdvance = onAdvance;
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    if (ready && this.pendingIndex !== null) {
      const index = this.pendingIndex;
      this.pendingIndex = null;
      this.handleEnded(index);
    }
  }

  handleEnded(currentIndex: number): void {
    if (this.destroyed || this.count < 2) return;
    if (!this.ready) {
      this.pendingIndex = currentIndex;
      return;
    }
    this.cancel();
    this.onAdvance((currentIndex + 1) % this.count);
  }

  /** For items that will never fire `ended` (no video authored, or load failed). */
  scheduleFallback(currentIndex: number): void {
    if (this.destroyed || this.count < 2) return;
    this.cancel();
    this.fallbackTimer = window.setTimeout(() => {
      this.fallbackTimer = 0;
      if (document.hidden) this.scheduleFallback(currentIndex);
      else this.handleEnded(currentIndex);
    }, FALLBACK_ADVANCE_MS);
  }

  cancel(): void {
    window.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = 0;
  }

  destroy(): void {
    this.destroyed = true;
    this.pendingIndex = null;
    this.cancel();
  }
}
