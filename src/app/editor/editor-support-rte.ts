// Group editable texts in single wrappers if applicable.
// This must execute after decorateMain() and every subsequent decorateBlocks() call,
// but before the Universal Editor CORS script and any block being loaded.

const NAV_RTE_HELP_TEXT =
  'Header navigation markers: | open-in-new-tab opens a link in a new tab; | open-in-same-tab keeps it in the current tab (default); | merge-columns joins this region with the next when the combined output has four or fewer columns. These are text markers, not CSS classes.';

function addNavRteHelp(container: Document | HTMLElement): void {
  if (!/\/nav(?:\.html)?\/?$/i.test(window.location.pathname)) return;

  container.querySelectorAll<HTMLElement>('[data-aue-type="richtext"]').forEach((field) => {
    if (field.nextElementSibling?.hasAttribute('data-nav-rte-help')) return;

    const help = document.createElement('div');
    help.dataset.navRteHelp = '';
    help.setAttribute('role', 'note');
    help.hidden = true;
    help.textContent = NAV_RTE_HELP_TEXT;
    field.insertAdjacentElement('afterend', help);
  });
}

document.addEventListener('aue:ui-select', (event) => {
  const { resource, selected } = (event as CustomEvent<{ resource?: string; selected?: boolean }>).detail ?? {};
  document.querySelectorAll<HTMLElement>('[data-nav-rte-help]').forEach((help) => {
    const field = help.previousElementSibling as HTMLElement | null;
    const fieldResource =
      field?.dataset.aueResource ?? field?.closest<HTMLElement>('[data-aue-resource]')?.dataset.aueResource;
    help.hidden = !selected || fieldResource !== resource;
  });
});

export function decorateRichtext(container: Document | HTMLElement = document): void {
  function deleteInstrumentation(element: HTMLElement): void {
    delete element.dataset.richtextResource;
    delete element.dataset.richtextProp;
    delete element.dataset.richtextFilter;
    delete element.dataset.richtextLabel;
  }

  let element: HTMLElement | null;

  while ((element = container.querySelector<HTMLElement>('[data-richtext-prop]:not(div)'))) {
    const { richtextResource, richtextProp, richtextFilter, richtextLabel } = element.dataset;
    deleteInstrumentation(element);
    const siblings: HTMLElement[] = [];
    let sibling: Element | null = element;

    while ((sibling = sibling.nextElementSibling)) {
      const siblingEl = sibling as HTMLElement;
      if (siblingEl.dataset.richtextResource === richtextResource && siblingEl.dataset.richtextProp === richtextProp) {
        deleteInstrumentation(siblingEl);
        siblings.push(siblingEl);
      } else break;
    }

    let orphanElements: NodeListOf<Element>;
    if (richtextResource && richtextProp) {
      orphanElements = document.querySelectorAll(
        `[data-richtext-id="${richtextResource}"][data-richtext-prop="${richtextProp}"]`,
      );
    } else {
      const editable = element.closest('[data-aue-resource]');
      if (editable) {
        orphanElements = editable.querySelectorAll(
          `:scope > :not([data-aue-resource]) [data-richtext-prop="${richtextProp}"]`,
        );
      } else {
        console.warn(`Editable parent not found or richtext property ${richtextProp}`);
        return;
      }
    }

    if (orphanElements.length) {
      console.warn(
        'Found orphan elements of a richtext, that were not consecutive siblings of the first paragraph',
        orphanElements,
      );
      orphanElements.forEach((orphanElement) => deleteInstrumentation(orphanElement as HTMLElement));
    } else {
      const group = document.createElement('div');
      if (richtextResource) {
        group.dataset.aueResource = richtextResource;
        group.dataset.aueBehavior = 'component';
      }
      if (richtextProp) group.dataset.aueProp = richtextProp;
      if (richtextLabel) group.dataset.aueLabel = richtextLabel;
      if (richtextFilter) group.dataset.aueFilter = richtextFilter;
      group.dataset.aueType = 'richtext';
      element.replaceWith(group);
      group.append(element, ...siblings);
    }
  }

  addNavRteHelp(container);
}

export default decorateRichtext;
