// Group editable texts in single wrappers if applicable.
// This must execute after decorateMain() and every subsequent decorateBlocks() call,
// but before the Universal Editor CORS script and any block being loaded.

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
}

export default decorateRichtext;
