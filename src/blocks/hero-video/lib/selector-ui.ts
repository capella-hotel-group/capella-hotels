// src/blocks/hero-video/lib/selector-ui.ts
import { moveInstrumentation } from '@/app/scripts';
import { isUniversalEditor } from '@/utils/env';
import type { HeroVideoItem } from './types';
import { cycleLayout, STEP_MS, WheelPicker } from './wheel-picker';
import type { PickerInputSource } from './wheel-picker';

const INACTIVE_OPACITY = 0.5;
const FALLBACK_ROW_HEIGHT = 56;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

function clickSource(e: MouseEvent): PickerInputSource {
  const { pointerType } = e as PointerEvent;
  if (pointerType === 'touch') return 'touch';
  // Keyboard-activated clicks (Enter/Space) carry an empty pointerType.
  if (pointerType === '') return 'keyboard';
  return 'pointer';
}

export class SelectorUI {
  private itemListEl: HTMLUListElement;
  private viewportEl: HTMLElement;
  private items: HeroVideoItem[] = [];
  private rowOffsets: number[] = [];
  private listHeight = 0;
  private origin = 0;
  private picker: WheelPicker | null = null;
  private selectCallbacks: Array<(index: number, source: PickerInputSource) => void> = [];
  private introComplete = false;
  private authoring: boolean;

  constructor(itemListEl: HTMLUListElement, viewportEl: HTMLElement) {
    this.itemListEl = itemListEl;
    this.viewportEl = viewportEl;
    this.authoring = isUniversalEditor();
    if (!this.authoring) {
      itemListEl.addEventListener('click', this.onClick);
      itemListEl.addEventListener('keydown', this.onKeyDown);
    }
  }

  /** The wheel only accepts scroll/drag/keys once the intro has finished. */
  setIntroComplete(complete: boolean): void {
    this.introComplete = complete;
    if (complete) this.picker?.enable();
    this.viewportEl.classList.toggle('hero-video-items-viewport--interactive', complete && this.picker !== null);
  }

  /** Fires once per user gesture, when the wheel settles. */
  onSelect(cb: (index: number, source: PickerInputSource) => void): void {
    this.selectCallbacks.push(cb);
  }

  isUserInteracting(): boolean {
    return this.picker?.isUserInteracting() ?? false;
  }

  /** Render the items, plus hidden clone cycles around them so the wheel can loop endlessly. */
  renderItems(items: HeroVideoItem[], activeIndex: number): void {
    this.picker?.destroy();
    this.picker = null;
    this.items = items;
    this.rowOffsets = [];

    const count = items.length;
    const { cycles, origin } = this.authoring ? { cycles: 1, origin: 0 } : cycleLayout(count);
    this.origin = origin;

    this.itemListEl.replaceChildren();
    for (let slot = 0; slot < cycles * count; slot += 1) {
      const index = slot % count;
      const item = items[index] as HeroVideoItem;
      const isOriginal = slot >= origin && slot < origin + count;

      const li = document.createElement('li');
      li.className = 'hero-video-item';
      li.dataset.index = String(index);
      li.dataset.slot = String(slot);

      const btn = document.createElement('button');
      btn.className = 'hero-video-item-btn';
      btn.type = 'button';
      btn.textContent = item.label;

      if (isOriginal) {
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
        moveInstrumentation(item.sourceRow, li);
      } else {
        li.setAttribute('aria-hidden', 'true');
        btn.tabIndex = -1;
      }

      li.append(btn);
      this.itemListEl.append(li);
    }

    if (cycles > 1) {
      this.picker = new WheelPicker(
        this.viewportEl,
        {
          render: (pos) => this.render(pos),
          rowHeight: () => this.rowHeight(),
          settle: (slot, source) => this.handleSettle(slot, source),
        },
        {
          period: count,
          origin,
          reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        },
      );
      this.setIntroComplete(this.introComplete);
    }

    this.positionForItem(activeIndex);
  }

  /**
   * Cache each row's center (relative to the list top) and the viewport's own height — the fixed,
   * never-transformed mask window whose center is where the active row must sit. Call after font
   * load and on resize.
   */
  measureRows(): void {
    const listRect = this.itemListEl.getBoundingClientRect();
    this.listHeight = this.viewportEl.getBoundingClientRect().height;
    this.rowOffsets = [...this.itemListEl.children].map((li) => {
      const rect = li.getBoundingClientRect();
      return rect.top + rect.height / 2 - listRect.top;
    });
  }

  /** Jump (no animation, no selection) so item[index] is centered; returns the list translateY. */
  positionForItem(index: number): number | null {
    const slot = this.origin + index;
    if (this.picker) this.picker.setPosition(slot);
    else this.render(slot);
    return this.translateForPos(slot);
  }

  /** Programmatic move (intro, auto-advance): scrolls the shortest way round, never emits onSelect. */
  activateItem(index: number, animate: boolean): void {
    if (!this.picker) {
      this.render(this.origin + index);
      this.setActive(index);
      return;
    }
    this.picker.scrollTo(this.picker.nearestSlot(index), animate ? STEP_MS : 0, null);
  }

  destroy(): void {
    this.picker?.destroy();
    this.picker = null;
  }

  private emitSelect(index: number, source: PickerInputSource): void {
    this.selectCallbacks.forEach((cb) => cb(index, source));
  }

  private handleSettle(slot: number, source: PickerInputSource | null): void {
    const index = mod(slot - this.origin, this.items.length);
    this.setActive(index);
    if (!source) return;
    // A tapped clone may hold focus; hand it to the original row now centered in its place.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && this.itemListEl.contains(focused)) this.focusItem(index);
    this.emitSelect(index, source);
  }

  private setActive(index: number): void {
    this.itemListEl.querySelectorAll<HTMLElement>('[role="option"]').forEach((li) => {
      li.setAttribute('aria-selected', li.dataset.index === String(index) ? 'true' : 'false');
    });
  }

  private focusItem(index: number): void {
    this.itemListEl
      .querySelector<HTMLButtonElement>(`[role="option"][data-index="${index}"] button`)
      ?.focus({ preventScroll: true });
  }

  private render(pos: number): void {
    const lis = this.itemListEl.children;
    for (let slot = 0; slot < lis.length; slot += 1) {
      const btn = lis[slot]?.firstElementChild as HTMLElement | null;
      const distance = Math.min(1, Math.abs(slot - pos));
      if (btn) btn.style.opacity = String(1 - (1 - INACTIVE_OPACITY) * distance);
    }
    const translateY = this.translateForPos(pos);
    if (translateY !== null) this.itemListEl.style.transform = `translateY(${translateY}px)`;
  }

  private translateForPos(pos: number): number | null {
    if (this.rowOffsets.length !== this.itemListEl.children.length) this.measureRows();
    const lo = this.rowOffsets[Math.floor(pos)];
    const hi = this.rowOffsets[Math.ceil(pos)];
    if (lo === undefined || hi === undefined) return null;
    const center = lo + (hi - lo) * (pos - Math.floor(pos));
    return this.listHeight / 2 - center;
  }

  private rowHeight(): number {
    const [first, second] = this.rowOffsets;
    if (first === undefined || second === undefined || second <= first) return FALLBACK_ROW_HEIGHT;
    return second - first;
  }

  private onClick = (e: MouseEvent): void => {
    if (!this.introComplete) return;
    const li = (e.target as Element | null)?.closest<HTMLElement>('.hero-video-item');
    if (!li || !this.itemListEl.contains(li)) return;
    const slot = Number(li.dataset.slot);
    const source = clickSource(e);
    if (this.picker) this.picker.scrollTo(slot, STEP_MS, source);
    else this.handleSettle(slot, source);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const { picker } = this;
    if (!this.introComplete || !picker) return;
    let slot: number;
    if (e.key === 'ArrowDown') slot = picker.stepBy(1, 'keyboard');
    else if (e.key === 'ArrowUp') slot = picker.stepBy(-1, 'keyboard');
    else if (e.key === 'Home' || e.key === 'End') {
      slot = picker.nearestSlot(e.key === 'Home' ? 0 : this.items.length - 1);
      picker.scrollTo(slot, STEP_MS, 'keyboard');
    } else return;
    e.preventDefault();
    this.focusItem(mod(slot - this.origin, this.items.length));
  };
}
