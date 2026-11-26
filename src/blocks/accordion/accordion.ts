import { moveInstrumentation } from '@/app/scripts.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';

const BLOCK = 'accordion';
const ITEM_MODEL = 'accordion-item';

let instanceCount = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Item rows by `data-aue-model` in the editor, by cell count (question + answer) in delivery HTML. */
function findItemRows(rows: HTMLElement[]): HTMLElement[] {
  if (rows.some((row) => row.dataset.aueModel)) {
    return rows.filter((row) => row.dataset.aueModel === ITEM_MODEL);
  }
  return rows.filter((row) => row.children.length > 1);
}

/** Moves a cell's field instrumentation (on the cell or its inner element) onto a built element. */
function transferFieldInstrumentation(cell: Element, target: Element): void {
  moveInstrumentation(cell, target);
  const inner = cell.querySelector('[data-aue-prop]');
  if (inner && !target.hasAttribute('data-aue-prop')) moveInstrumentation(inner, target);
}

function setOpen(item: HTMLElement, open: boolean): void {
  const trigger = item.querySelector<HTMLButtonElement>(`.${BLOCK}-trigger`);
  const panel = item.querySelector<HTMLElement>(`.${BLOCK}-answer`);
  if (!trigger || !panel) return;
  item.classList.toggle('is-open', open);
  trigger.setAttribute('aria-expanded', String(open));
  panel.toggleAttribute('inert', !open);
}

function buildItem(row: HTMLElement, instanceId: number, index: number): HTMLLIElement | null {
  const [questionCell, answerCell] = [...row.children] as HTMLElement[];
  const isEditorItem = row.dataset.aueModel === ITEM_MODEL;
  const questionText = questionCell?.textContent?.trim() || (isEditorItem ? 'New question' : '');
  if (!questionText) return null;

  const item = el('li', `${BLOCK}-item`);
  moveInstrumentation(row, item);

  const triggerId = `${BLOCK}-${instanceId}-trigger-${index}`;
  const panelId = `${BLOCK}-${instanceId}-panel-${index}`;

  const question = el('h3', `${BLOCK}-question`);
  const trigger = el('button', `${BLOCK}-trigger`);
  trigger.type = 'button';
  trigger.id = triggerId;
  trigger.setAttribute('aria-controls', panelId);
  trigger.setAttribute('data-testid', `${BLOCK}-trigger`);

  const text = el('span', `${BLOCK}-question-text`, questionText);
  if (questionCell) transferFieldInstrumentation(questionCell, text);
  trigger.append(text, el('span', `${BLOCK}-icon`));
  question.append(trigger);

  const panel = el('div', `${BLOCK}-answer`);
  panel.id = panelId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', triggerId);
  if (answerCell) {
    answerCell.classList.add(`${BLOCK}-answer-content`);
    panel.append(answerCell);
  }

  item.append(question, panel);
  return item;
}

export default function decorate(block: HTMLElement): void {
  instanceCount += 1;
  block.setAttribute('data-testid', BLOCK);

  const rows = [...block.children] as HTMLElement[];
  const itemRows = findItemRows(rows);
  const contentRows = rows.filter((row) => !itemRows.includes(row));
  const [headingRow] = applyBlockIdentity(block, contentRows, { contentRows: 1, hiddenClass: `${BLOCK}-hidden` });
  headingRow?.classList.add(`${BLOCK}-heading`);

  const list = el('ol', `${BLOCK}-items`);
  itemRows.forEach((row, index) => {
    const item = buildItem(row, instanceCount, index + 1);
    if (item) list.append(item);
    row.remove();
  });
  block.append(list);

  const items = [...list.children] as HTMLElement[];
  items.forEach((item, index) => setOpen(item, index === 0));

  list.addEventListener('click', (event) => {
    const trigger = (event.target as Element).closest<HTMLButtonElement>(`.${BLOCK}-trigger`);
    const item = trigger?.closest<HTMLElement>(`.${BLOCK}-item`);
    if (trigger && item) setOpen(item, trigger.getAttribute('aria-expanded') !== 'true');
  });

  // Selecting an item in the editor rail opens it so its answer is reachable on the canvas.
  block.addEventListener('aue:ui-select', (event) => {
    const item = (event.target as Element).closest<HTMLElement>(`.${BLOCK}-item`);
    if (item) setOpen(item, true);
  });
}
