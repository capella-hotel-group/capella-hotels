// src/blocks/hero-video/lib/selector-ui.ts
import { moveInstrumentation } from '@/app/scripts';
import type { HeroVideoItem } from './types';

const ANCHOR_MS = 310;
const OPACITY_MS = 190;

export class SelectorUI {
  private itemListEl: HTMLUListElement;
  private items: HeroVideoItem[] = [];
  private rowOffsets: number[] = [];
  private listHeight = 0;
  private activeIndex = 0;
  private selectCallbacks: Array<(index: number) => void> = [];
  private pendingAnchorAnimations: Animation[] = [];
  private pendingOpacityAnimations: Animation[] = [];
  private introComplete = false;

  constructor(itemListEl: HTMLUListElement) {
    this.itemListEl = itemListEl;
  }

  setIntroComplete(complete: boolean): void {
    this.introComplete = complete;
  }

  onSelect(cb: (index: number) => void): void {
    this.selectCallbacks.push(cb);
  }

  private emitSelect(index: number): void {
    this.selectCallbacks.forEach((cb) => cb(index));
  }

  /** Render the item list for the given items, preserving pointer listeners. */
  renderItems(items: HeroVideoItem[], activeIndex: number): void {
    this.items = items;
    this.activeIndex = activeIndex;

    this.itemListEl.replaceChildren();
    items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'hero-video-item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', idx === activeIndex ? 'true' : 'false');
      li.dataset.index = String(idx);

      // Carry Universal Editor instrumentation from the authored row
      moveInstrumentation(item.sourceRow, li);

      const btn = document.createElement('button');
      btn.className = 'hero-video-item-btn';
      btn.type = 'button';
      btn.textContent = item.label;
      // Set opacity via inline style so the active item is highlighted even if activateItem's
      // WAAPI opacity animation misfires (which happens when decorate() runs on a detached block
      // during mode-toggle soft-nav — `fill: forwards` doesn't retain after DOM adoption).
      btn.style.opacity = idx === activeIndex ? '1' : '0.5';
      if (item.link) btn.dataset.href = item.link;

      // Keyboard interaction
      btn.addEventListener('keydown', (e) => this.handleKeyDown(e, idx));
      btn.addEventListener('click', () => this.handleClick(idx));

      li.append(btn);
      this.itemListEl.append(li);
    });
  }

  private handleKeyDown(e: KeyboardEvent, currentIndex: number): void {
    if (!this.introComplete) return;
    const count = this.items.length;
    let next = currentIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.min(count - 1, currentIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.max(0, currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = count - 1;
    } else return;

    if (next !== currentIndex) {
      this.activateItem(next, true);
      this.emitSelect(next);
      // Move focus to new item button
      const btn = this.itemListEl.children[next]?.querySelector<HTMLButtonElement>('button');
      btn?.focus();
    }
  }

  private handleClick(index: number): void {
    if (!this.introComplete) return;
    const item = this.items[index];
    if (index === this.activeIndex && item?.link) {
      window.location.href = item.link;
      return;
    }
    this.activateItem(index, true);
    this.emitSelect(index);
  }

  /**
   * Cache the Y offset (center of each row, relative to the list top) and the
   * total list height. Call after font load and on resize.
   */
  measureRows(): void {
    const listRect = this.itemListEl.getBoundingClientRect();
    this.listHeight = listRect.height;
    this.rowOffsets = [...this.itemListEl.children].map((li) => {
      const rect = li.getBoundingClientRect();
      return rect.top + rect.height / 2 - listRect.top;
    });
  }

  /**
   * Vertical translate (px) that brings item[index] to the list's vertical
   * center — which coincides with the fixed, centered prefix/suffix.
   */
  private translateForIndex(index: number): number | null {
    if (this.rowOffsets.length === 0) this.measureRows();
    const rowCenter = this.rowOffsets[index];
    if (rowCenter === undefined) return null;
    return this.listHeight / 2 - rowCenter;
  }

  /**
   * Position the item list so item[index] is centered, without touching opacity.
   * Used during intro: selector is invisible so we pre-position before fade-in.
   */
  positionForItem(index: number): void {
    const translateY = this.translateForIndex(index);
    if (translateY === null) return;

    this.pendingAnchorAnimations.forEach((a) => a.cancel());
    this.pendingAnchorAnimations = [];

    this.itemListEl.style.transform = `translateY(${translateY}px)`;
  }
  activateItem(index: number, animate: boolean): void {
    const prev = this.activeIndex;
    this.activeIndex = index;

    // Update aria-selected
    const lis = [...this.itemListEl.children] as HTMLElement[];
    lis.forEach((li, i) => {
      li.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });

    // Opacity transitions
    const prevBtn = lis[prev]?.querySelector<HTMLElement>('.hero-video-item-btn');
    const nextBtn = lis[index]?.querySelector<HTMLElement>('.hero-video-item-btn');

    // Cancel pending opacity animations (overwrite — latest wins)
    this.pendingOpacityAnimations.forEach((a) => a.cancel());
    this.pendingOpacityAnimations = [];

    if (prevBtn && prev !== index) {
      const prevStart = getComputedStyle(prevBtn).opacity || '1';
      const prevOpacityAnim = prevBtn.animate([{ opacity: prevStart }, { opacity: 0.5 }], {
        duration: animate ? OPACITY_MS : 0,
        fill: 'forwards',
      });
      this.pendingOpacityAnimations.push(prevOpacityAnim);
      prevOpacityAnim.finished
        .then(() => {
          prevBtn.style.opacity = '0.5';
          prevOpacityAnim.cancel();
          this.pendingOpacityAnimations = this.pendingOpacityAnimations.filter((a) => a !== prevOpacityAnim);
        })
        .catch(() => {});
    }
    if (nextBtn) {
      const nextStart = getComputedStyle(nextBtn).opacity || '0.5';
      const nextOpacityAnim = nextBtn.animate([{ opacity: nextStart }, { opacity: 1 }], {
        duration: animate ? OPACITY_MS : 0,
        fill: 'forwards',
      });
      this.pendingOpacityAnimations.push(nextOpacityAnim);
      nextOpacityAnim.finished
        .then(() => {
          nextBtn.style.opacity = '1';
          nextOpacityAnim.cancel();
          this.pendingOpacityAnimations = this.pendingOpacityAnimations.filter((a) => a !== nextOpacityAnim);
        })
        .catch(() => {});
    }

    // Slide the item list so the active row lands on the fixed center line
    const targetTranslateY = this.translateForIndex(index);
    if (targetTranslateY === null) return;

    this.pendingAnchorAnimations.forEach((a) => a.cancel());
    this.pendingAnchorAnimations = [];

    const currentTranslateY = this.getCurrentTranslateY(this.itemListEl);
    this.itemListEl.classList.add('hero-video-items--animating');
    const listAnim = this.itemListEl.animate(
      [{ transform: `translateY(${currentTranslateY}px)` }, { transform: `translateY(${targetTranslateY}px)` }],
      { duration: animate ? ANCHOR_MS : 0, easing: 'ease-out', fill: 'forwards' },
    );

    this.pendingAnchorAnimations = [listAnim];

    listAnim.finished
      .then(() => {
        this.itemListEl.style.transform = `translateY(${targetTranslateY}px)`;
        this.itemListEl.classList.remove('hero-video-items--animating');
        listAnim.cancel();
      })
      .catch(() => {
        this.itemListEl.classList.remove('hero-video-items--animating');
        /* cancelled by next activation */
      });
  }

  private getCurrentTranslateY(el: HTMLElement): number {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return matrix.m42;
  }

  destroy(): void {
    this.pendingAnchorAnimations.forEach((a) => a.cancel());
    this.pendingOpacityAnimations.forEach((a) => a.cancel());
  }
}
