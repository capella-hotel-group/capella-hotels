import { moveInstrumentation } from '@/app/scripts.js';
import {
  decorateLinkFields,
  fieldOf,
  hasAuthoringInstrumentation,
  isEnabled,
  propertyOf,
  textOf,
} from '@/utils/link.js';

const CONTAINER_FIELD_COUNT = 4;
const ITEM_MODELS = new Set(['link-item', 'navigation-list-item']);

function isItemRow(row: Element): boolean {
  return ITEM_MODELS.has(row.getAttribute('data-aue-model') || '');
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const titleFields = {
    label: fieldOf(block, 'navTitle', 0),
    url: fieldOf(block, 'ctaLink', 1),
    openInNewTab: fieldOf(block, 'openInNewTab', 2),
  };
  const mergeColumns = fieldOf(block, 'mergeColumns', 3);
  const instrumentedItems = rows.filter(isItemRow);
  const itemRows = instrumentedItems.length ? instrumentedItems : rows.slice(CONTAINER_FIELD_COUNT);
  const { content: titleLink } = decorateLinkFields(titleFields, 'Navigation');
  const sublist = document.createElement('ul');

  itemRows.forEach((row) => {
    const collapsedLink = fieldOf(row, 'link', 0);
    const authoredHref = collapsedLink?.querySelector('a')?.getAttribute('href')?.trim();
    if (!textOf(collapsedLink) && !authoredHref && !isItemRow(row)) return;

    const itemFields = {
      label: propertyOf(row, 'linkText') || collapsedLink,
      url: propertyOf(row, 'link') || collapsedLink,
      openInNewTab: propertyOf(row, 'openInNewTab') || fieldOf(row, 'openInNewTab', 1),
    };
    const { content } = decorateLinkFields(itemFields);
    const item = document.createElement('li');
    moveInstrumentation(row, item);
    item.append(content);
    if (hasAuthoringInstrumentation(itemFields.openInNewTab)) item.append(itemFields.openInNewTab);
    sublist.append(item);
  });

  const titleItem = document.createElement('li');
  titleItem.append(titleLink);
  if (hasAuthoringInstrumentation(titleFields.openInNewTab)) titleItem.append(titleFields.openInNewTab);
  if (hasAuthoringInstrumentation(mergeColumns)) {
    mergeColumns.hidden = true;
    titleItem.append(mergeColumns);
  }
  if (sublist.children.length) titleItem.append(sublist);

  const list = document.createElement('ul');
  list.append(titleItem);

  block.classList.toggle('merge-columns', isEnabled(mergeColumns));
  block.dataset.testid = 'navigation-lists';
  block.replaceChildren(list);
}
