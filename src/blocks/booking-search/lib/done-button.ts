import { el } from './dom';
import { BLOCK } from './types';

/** Button/text-standard at the bottom of every flyout. */
export function buildDoneButton(label: string, onDone: () => void): HTMLButtonElement {
  const button = el('button', `${BLOCK}-done`, label);
  button.type = 'button';
  button.dataset.testid = `${BLOCK}-done`;
  button.addEventListener('click', onDone);
  return button;
}
