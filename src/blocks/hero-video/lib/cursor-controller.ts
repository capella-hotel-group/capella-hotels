// src/blocks/hero-video/lib/cursor-controller.ts

const CURSOR_LERP = 0.12;

export class CursorController {
  private container: HTMLElement;
  private cursorEl: HTMLElement;
  private rafId = 0;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private isActive = false;
  private mounted = false;

  constructor(container: HTMLElement, cursorEl: HTMLElement) {
    this.container = container;
    this.cursorEl = cursorEl;
  }

  mount(): void {
    if (this.mounted) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.mounted = true;
    this.cursorEl.style.display = 'block';
    this.container.addEventListener('mouseenter', this.onEnter);
    this.container.addEventListener('mouseleave', this.onLeave);
    this.container.addEventListener('mousemove', this.onMove);
  }

  private onEnter = (): void => {
    this.isActive = true;
    this.cursorEl.style.opacity = '1';
    this.tick();
  };

  private onLeave = (): void => {
    this.isActive = false;
    this.cursorEl.style.opacity = '0';
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  };

  private onMove = (e: MouseEvent): void => {
    const rect = this.container.getBoundingClientRect();
    this.targetX = e.clientX - rect.left;
    this.targetY = e.clientY - rect.top;
  };

  private tick = (): void => {
    this.currentX += (this.targetX - this.currentX) * CURSOR_LERP;
    this.currentY += (this.targetY - this.currentY) * CURSOR_LERP;
    this.cursorEl.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;
    if (this.isActive) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  destroy(): void {
    this.isActive = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.mounted) {
      this.container.removeEventListener('mouseenter', this.onEnter);
      this.container.removeEventListener('mouseleave', this.onLeave);
      this.container.removeEventListener('mousemove', this.onMove);
      this.mounted = false;
    }
  }
}
