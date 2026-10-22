import { el, nextId } from './dom';
import { BLOCK } from './types';
import type { Range, Selection } from './types';

export function buildCounter(
  name: 'adults' | 'children',
  { min, max }: Range,
  labelText: string,
  selection: Selection,
  onChange: () => void,
): HTMLElement {
  const row = el('div', `${BLOCK}-counter`);
  const id = `${BLOCK}-counter-${name}-${nextId()}`;

  const label = el('span', `${BLOCK}-counter-label`, labelText);
  label.id = id;

  const button = (action: 'decrease' | 'increase'): HTMLButtonElement => {
    const node = el('button', `${BLOCK}-counter-button ${BLOCK}-counter-${action}`);
    node.type = 'button';
    node.setAttribute('aria-label', `${action === 'decrease' ? 'Decrease' : 'Increase'} ${labelText}`);
    node.dataset.testid = `${BLOCK}-${name}-${action}`;
    return node;
  };
  const decrease = button('decrease');
  const increase = button('increase');

  const value = el('output', `${BLOCK}-counter-value`);
  value.setAttribute('aria-labelledby', id);

  const refresh = (): void => {
    value.textContent = String(selection[name]);
    decrease.disabled = selection[name] <= min;
    increase.disabled = selection[name] >= max;
  };
  const step = (delta: number): void => {
    selection[name] = Math.max(min, Math.min(max, selection[name] + delta));
    refresh();
    onChange();
  };
  decrease.addEventListener('click', () => step(-1));
  increase.addEventListener('click', () => step(1));
  refresh();

  const controls = el('div', `${BLOCK}-counter-controls`);
  controls.append(decrease, value, increase);
  row.append(label, controls);
  return row;
}
