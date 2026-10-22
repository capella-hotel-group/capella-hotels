import { el } from './dom';
import { BLOCK } from './types';
import type { Location } from './types';

export interface LocationList {
  list: HTMLUListElement;
  focusOption: (index?: number) => void;
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

  const mark = (selected?: Location): void => {
    options.forEach((option, index) => {
      option.setAttribute('aria-selected', String(locations[index] === selected));
    });
  };

  return { list, focusOption, mark };
}
