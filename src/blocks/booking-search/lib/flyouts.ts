import { isOpen, setOpen } from './field';
import type { Field } from './types';

const VIEWPORT_GAP = 8;

export interface Flyouts {
  closeAll: (except?: Field) => void;
  /** Opens one field, closing any other. */
  open: (field: Field) => void;
}

/** Keeps at most one flyout open and closes it on Escape, outside click or focus leaving the block. */
export function createFlyouts(block: HTMLElement, fields: Field[]): Flyouts {
  const closeAll = (except?: Field): void => {
    fields.forEach((field) => {
      if (field !== except && isOpen(field)) setOpen(field, false);
    });
  };

  const place = (field: Field): void => {
    const { panel, root } = field;
    panel.classList.remove('is-above');
    panel.style.removeProperty('translate');

    const anchor = root.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const below = window.innerHeight - anchor.bottom - VIEWPORT_GAP;
    const above = anchor.top - VIEWPORT_GAP;
    if (rect.height > below && above > below) panel.classList.add('is-above');

    // Horizontally only clamp to the edge: the tablet guests flyout is meant to sit flush with it.
    const overflowEnd = rect.right - document.documentElement.clientWidth;
    const overflowStart = -rect.left;
    const shift = overflowStart > 0 ? overflowStart : Math.min(0, Math.max(overflowStart, -overflowEnd));
    if (shift) panel.style.translate = `${shift}px 0`;
  };

  const placeOpen = (): void => {
    const opened = fields.find(isOpen);
    if (opened) place(opened);
  };
  // Panel heights change after opening (calendar months have 5 or 6 weeks).
  const resizeObserver = new ResizeObserver(placeOpen);
  fields.forEach((field) => resizeObserver.observe(field.panel));
  window.addEventListener('resize', placeOpen);

  const open = (field: Field): void => {
    closeAll(field);
    setOpen(field, true);
    // Wait for the caller to render the panel content before measuring.
    requestAnimationFrame(() => {
      if (!isOpen(field)) return;
      place(field);
      const rect = field.panel.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) field.panel.scrollIntoView({ block: 'nearest' });
    });
  };

  block.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const opened = fields.find(isOpen);
    if (!opened) return;
    closeAll();
    opened.trigger.focus();
  });
  block.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (next && !block.contains(next)) closeAll();
  });
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    const opened = fields.find(isOpen);
    if (!opened?.root.contains(target)) closeAll();
  });

  return { closeAll, open };
}
