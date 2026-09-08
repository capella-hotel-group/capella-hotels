import { moveInstrumentation } from '@/app/scripts.js';

// Rows: 0=backgroundImage, 1=imageAlt, 2=toggleLabelLeft, 3=toggleLabelRight, then item rows (name/description/link/group)

interface ToggleItem {
  name: string;
  description: string;
  href: string;
  group: string;
  row: Element;
}

function textFromCell(cell?: Element | null): string {
  return cell?.textContent?.trim() ?? '';
}

function isItemRow(row: Element): boolean {
  return row.children.length > 1;
}

function getItemFields(row: Element): ToggleItem {
  const [nameCell, descriptionCell, linkCell, groupCell] = [...row.children];
  return {
    name: textFromCell(nameCell),
    description: textFromCell(descriptionCell),
    href: linkCell?.querySelector('a')?.getAttribute('href') || '',
    group: textFromCell(groupCell).toLowerCase() || 'destinations',
    row,
  };
}

function buildRow(item: ToggleItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'hero-banner-with-toggle-row';
  li.dataset.group = item.group;
  li.dataset.active = 'false';
  moveInstrumentation(item.row, li);

  const trigger = document.createElement('a');
  trigger.className = 'hero-banner-with-toggle-trigger';
  trigger.href = item.href || '#';

  const name = document.createElement('span');
  name.className = 'hero-banner-with-toggle-name';
  name.textContent = item.name;

  const description = document.createElement('span');
  description.className = 'hero-banner-with-toggle-description';
  const descriptionText = document.createElement('span');
  descriptionText.textContent = item.description;
  const icon = document.createElement('span');
  icon.className = 'hero-banner-with-toggle-icon';
  icon.setAttribute('aria-hidden', 'true');
  description.append(descriptionText, icon);

  trigger.append(name, description);
  li.append(trigger);
  return li;
}

function buildToggleSwitch(labelLeft: string, labelRight: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-banner-with-toggle-switch';

  const leftLabel = document.createElement('span');
  leftLabel.className = 'hero-banner-with-toggle-switch-label';
  leftLabel.textContent = labelLeft;

  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'hero-banner-with-toggle-switch-control';
  control.setAttribute('role', 'switch');
  control.setAttribute('aria-checked', 'false');
  control.setAttribute('aria-label', `${labelLeft} / ${labelRight}`);

  const rightLabel = document.createElement('span');
  rightLabel.className = 'hero-banner-with-toggle-switch-label';
  rightLabel.textContent = labelRight;

  wrapper.append(leftLabel, control, rightLabel);
  return wrapper;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const firstItemIndex = rows.findIndex(isItemRow);
  const settingsRows = firstItemIndex < 0 ? rows : rows.slice(0, firstItemIndex);
  const itemRows = firstItemIndex < 0 ? [] : rows.slice(firstItemIndex);

  const [backgroundRow, altRow, toggleLeftRow, toggleRightRow] = settingsRows;
  const picture = backgroundRow?.querySelector('picture');
  const imageAlt = textFromCell(altRow);
  const toggleLabelLeft = textFromCell(toggleLeftRow) || 'Destinations';
  const toggleLabelRight = textFromCell(toggleRightRow) || 'Experiences';

  const items = itemRows.map(getItemFields);
  const groups = [...new Set(items.map((item) => item.group))];

  block.innerHTML = '';

  if (picture) {
    picture.className = 'hero-banner-with-toggle-image';
    const img = picture.querySelector('img');
    if (img && imageAlt) img.alt = imageAlt;
    block.append(picture);
  }

  const overlay = document.createElement('div');
  overlay.className = 'hero-banner-with-toggle-overlay';
  block.append(overlay);

  const list = document.createElement('ul');
  list.className = 'hero-banner-with-toggle-list';
  const listItems = items.map((item) => {
    const li = buildRow(item);
    list.append(li);
    return li;
  });
  block.append(list);

  function setActiveRow(activeLi: HTMLLIElement): void {
    listItems.forEach((li) => {
      const isActive = li === activeLi;
      li.dataset.active = String(isActive);
      const anchor = li.querySelector('a');
      if (isActive) anchor?.setAttribute('aria-current', 'true');
      else anchor?.removeAttribute('aria-current');
    });
  }

  function setActiveGroup(group: string): void {
    block.dataset.group = group;
    let firstVisible: HTMLLIElement | undefined;
    listItems.forEach((li, index) => {
      const matches = items[index]?.group === group;
      li.hidden = !matches;
      if (matches && !firstVisible) firstVisible = li;
    });
    if (firstVisible) setActiveRow(firstVisible);
  }

  listItems.forEach((li, index) => {
    const item = items[index];
    const anchor = li.querySelector('a');
    anchor?.addEventListener('click', (e) => {
      const isActive = li.dataset.active === 'true';
      if (!isActive || !item?.href) {
        e.preventDefault();
        if (!isActive) setActiveRow(li);
      }
    });
  });

  if (groups.length > 1) {
    const toggle = buildToggleSwitch(toggleLabelLeft, toggleLabelRight);
    const control = toggle.querySelector<HTMLButtonElement>('.hero-banner-with-toggle-switch-control');
    control?.addEventListener('click', () => {
      const isRightActive = control.getAttribute('aria-checked') === 'true';
      const nextGroup = isRightActive ? groups[0] : (groups[1] ?? groups[0]);
      control.setAttribute('aria-checked', String(!isRightActive));
      if (nextGroup) setActiveGroup(nextGroup);
    });
    block.append(toggle);
  }

  if (groups[0]) setActiveGroup(groups[0]);
}
