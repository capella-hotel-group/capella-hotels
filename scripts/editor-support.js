/*! v1.3.0 | h651cf6fd */
import {
  decorateBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  loadBlock,
  loadScript,
  loadSections,
} from '/scripts/aem.js';
import { decorateMain } from '/scripts/scripts.js';
//#region src/app/editor/editor-support-rte.ts
function decorateRichtext(container = document) {
  function deleteInstrumentation(element) {
    delete element.dataset.richtextResource;
    delete element.dataset.richtextProp;
    delete element.dataset.richtextFilter;
    delete element.dataset.richtextLabel;
  }
  let element;
  while ((element = container.querySelector('[data-richtext-prop]:not(div)'))) {
    const { richtextResource, richtextProp, richtextFilter, richtextLabel } = element.dataset;
    deleteInstrumentation(element);
    const siblings = [];
    let sibling = element;
    while ((sibling = sibling.nextElementSibling)) {
      const siblingEl = sibling;
      if (siblingEl.dataset.richtextResource === richtextResource && siblingEl.dataset.richtextProp === richtextProp) {
        deleteInstrumentation(siblingEl);
        siblings.push(siblingEl);
      } else break;
    }
    let orphanElements;
    if (richtextResource && richtextProp)
      orphanElements = document.querySelectorAll(
        `[data-richtext-id="${richtextResource}"][data-richtext-prop="${richtextProp}"]`,
      );
    else {
      const editable = element.closest('[data-aue-resource]');
      if (editable)
        orphanElements = editable.querySelectorAll(
          `:scope > :not([data-aue-resource]) [data-richtext-prop="${richtextProp}"]`,
        );
      else {
        console.warn(`Editable parent not found or richtext property ${richtextProp}`);
        return;
      }
    }
    if (orphanElements.length) {
      console.warn(
        'Found orphan elements of a richtext, that were not consecutive siblings of the first paragraph',
        orphanElements,
      );
      orphanElements.forEach((orphanElement) => deleteInstrumentation(orphanElement));
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
//#endregion
//#region src/app/editor/editor-support.ts
var promiseChanges$ = Promise.resolve(false);
async function applyChanges(event) {
  await promiseChanges$;
  const { detail } = event;
  const resource =
    detail?.request?.target?.resource ||
    detail?.request?.target?.container?.resource ||
    detail?.request?.to?.container?.resource;
  if (!resource) return false;
  const updates = detail?.response?.updates;
  if (!updates?.length) return false;
  const content = updates[0]?.content;
  if (!content) return false;
  await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
  const sanitizedContent = window.DOMPurify?.sanitize(content, { USE_PROFILES: { html: true } }) ?? '';
  const parsedUpdate = new DOMParser().parseFromString(sanitizedContent, 'text/html');
  const element = document.querySelector(`[data-aue-resource="${resource}"]`);
  if (element) {
    if (element.matches('main')) {
      const newMain = parsedUpdate.querySelector(`[data-aue-resource="${resource}"]`);
      if (!newMain) return false;
      newMain.style.display = 'none';
      element.insertAdjacentElement('afterend', newMain);
      decorateMain(newMain);
      decorateRichtext(newMain);
      await loadSections(newMain);
      element.remove();
      newMain.style.display = '';
      attachEventListeners(newMain);
      return true;
    }
    const block =
      element.parentElement?.closest('.block[data-aue-resource]') || element.closest('.block[data-aue-resource]');
    if (block) {
      const blockResource = block.getAttribute('data-aue-resource');
      const newBlock = parsedUpdate.querySelector(`[data-aue-resource="${blockResource}"]`);
      if (newBlock) {
        newBlock.style.display = 'none';
        block.insertAdjacentElement('afterend', newBlock);
        decorateButtons(newBlock);
        decorateIcons(newBlock);
        decorateBlock(newBlock);
        decorateRichtext(newBlock);
        await loadBlock(newBlock);
        block.remove();
        newBlock.style.display = '';
        return true;
      }
    } else {
      const newElements = parsedUpdate.querySelectorAll(
        `[data-aue-resource="${resource}"],[data-richtext-resource="${resource}"]`,
      );
      if (newElements.length) {
        const { parentElement } = element;
        const [newSection] = newElements;
        if (element.matches('.section') && parentElement && newSection) {
          newSection.style.display = 'none';
          element.insertAdjacentElement('afterend', newSection);
          decorateButtons(newSection);
          decorateIcons(newSection);
          decorateRichtext(newSection);
          decorateSections(parentElement);
          decorateBlocks(parentElement);
          await loadSections(parentElement);
          element.remove();
          newSection.style.display = '';
        } else if (parentElement) {
          element.replaceWith(...newElements);
          decorateButtons(parentElement);
          decorateIcons(parentElement);
          decorateRichtext(parentElement);
        }
        return true;
      }
    }
  }
  return false;
}
function attachEventListeners(main) {
  [
    'aue:content-patch',
    'aue:content-update',
    'aue:content-add',
    'aue:content-move',
    'aue:content-remove',
    'aue:content-copy',
  ].forEach((eventType) =>
    main?.addEventListener(eventType, async (event) => {
      event.stopPropagation();
      promiseChanges$ = applyChanges(event);
      if (!(await promiseChanges$)) window.location.reload();
    }),
  );
}
attachEventListeners(document.querySelector('main'));
decorateRichtext();
new MutationObserver(() => decorateRichtext()).observe(document, {
  attributeFilter: ['data-richtext-prop'],
  subtree: true,
});
//#endregion
