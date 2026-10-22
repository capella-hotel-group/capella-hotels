import { el, nextId } from './dom';
import { BLOCK } from './types';
import type { Field, FieldKind } from './types';

/** A selector button plus the flyout panel it controls. */
export function buildField(kind: FieldKind, labelText: string, panelLabel: string): Field {
  const id = `${BLOCK}-${kind}-${nextId()}`;
  const root = el('div', `${BLOCK}-field ${BLOCK}-field-${kind}`);

  const trigger = el('button', `${BLOCK}-trigger`);
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${id}-panel`);
  trigger.setAttribute('aria-haspopup', kind === 'location' ? 'listbox' : 'dialog');
  trigger.dataset.testid = `${BLOCK}-${kind}`;

  const icon = el('span', `${BLOCK}-icon ${BLOCK}-icon-${kind}`);
  icon.setAttribute('aria-hidden', 'true');
  const label = el('span', `${BLOCK}-label`, labelText);
  const chevron = el('span', `${BLOCK}-chevron`);
  chevron.setAttribute('aria-hidden', 'true');
  const main = el('span', `${BLOCK}-trigger-main`);
  main.append(icon, label);
  trigger.append(main, chevron);

  const panel = el('div', `${BLOCK}-panel ${BLOCK}-panel-${kind}`);
  panel.id = `${id}-panel`;
  panel.hidden = true;
  // The location panel's listbox carries its own role.
  if (kind !== 'location') {
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', panelLabel);
  }

  root.append(trigger, panel);
  return { kind, root, trigger, label, panel };
}

export const isOpen = (field: Field): boolean => !field.panel.hidden;

export function setOpen(field: Field, open: boolean): void {
  field.panel.hidden = !open;
  field.root.classList.toggle('is-open', open);
  field.trigger.setAttribute('aria-expanded', String(open));
}
