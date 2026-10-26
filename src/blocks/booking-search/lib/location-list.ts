import { el } from './dom';
import { BLOCK } from './types';
import type { Location } from './types';

export interface LocationList {
  list: HTMLUListElement;
  scrollbar: HTMLDivElement;
  focusOption: (index?: number) => void;
  updateScrollbar: () => void;
  /** Flags the picked location as `aria-selected`. */
  mark: (location?: Location) => void;
}

export function buildLocationList(
  locations: Location[],
  label: string,
  onSelect: (location: Location) => void,
): LocationList {
  const list = el('ul', `${BLOCK}-options`);
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);

  const scrollbar = el('div', `${BLOCK}-location-scrollbar`);
  scrollbar.setAttribute('aria-hidden', 'true');
  scrollbar.hidden = true;
  const thumb = el('span', `${BLOCK}-location-scrollbar-thumb`);
  scrollbar.append(thumb);

  const options = locations.map((location) => {
    const item = el('li', `${BLOCK}-option`, location.label);
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.tabIndex = -1;
    item.addEventListener('click', () => onSelect(location));
    list.append(item);
    return item;
  });

  const focusOption = (index = 0): void => {
    options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
  };

  list.addEventListener('keydown', (event) => {
    const current = options.indexOf(document.activeElement as HTMLLIElement);
    const move = (index: number): void => {
      event.preventDefault();
      focusOption(index);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(current + 1);
        break;
      case 'ArrowUp':
        move(current - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(options.length - 1);
        break;
      case 'Enter':
      case ' ': {
        const location = locations[current];
        if (location) {
          event.preventDefault();
          onSelect(location);
        }
        break;
      }
      default:
    }
  });

  const updateScrollbar = (): void => {
    const maxScrollTop = list.scrollHeight - list.clientHeight;
    scrollbar.hidden = maxScrollTop <= 0;
    if (maxScrollTop <= 0) return;

    const thumbTravel = scrollbar.clientHeight - thumb.offsetHeight;
    const thumbOffset = (list.scrollTop / maxScrollTop) * thumbTravel;
    thumb.style.transform = `translateY(${thumbOffset}px)`;
  };

  list.addEventListener('scroll', updateScrollbar);

  const mark = (selected?: Location): void => {
    options.forEach((option, index) => {
      option.setAttribute('aria-selected', String(locations[index] === selected));
    });
  };

  return { list, scrollbar, focusOption, updateScrollbar, mark };
}
