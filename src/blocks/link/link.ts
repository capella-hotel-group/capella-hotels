import { decorateLinkFields, fieldOf, hasAuthoringInstrumentation, propertyOf } from '@/utils/link.js';

export default function decorate(block: HTMLElement): void {
  const collapsedLink = fieldOf(block, 'link', 0);
  const fields = {
    label: propertyOf(block, 'linkText') || collapsedLink,
    url: propertyOf(block, 'link') || collapsedLink,
    openInNewTab: propertyOf(block, 'openInNewTab') || fieldOf(block, 'openInNewTab', 1),
  };
  const { content } = decorateLinkFields(fields);

  block.dataset.testid = 'link';
  block.replaceChildren(content);
  if (hasAuthoringInstrumentation(fields.openInNewTab)) block.append(fields.openInNewTab);
}
