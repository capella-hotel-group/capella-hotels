import { isOpen, setOpen } from './field';
import type { Field } from './types';

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

  const open = (field: Field): void => {
    closeAll(field);
    setOpen(field, true);
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
