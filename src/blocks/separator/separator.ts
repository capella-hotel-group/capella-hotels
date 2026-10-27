const PADDING_OPTIONS = new Set(Array.from({ length: 10 }, (_, index) => `${(index + 1) * 10}px`));

function fieldOf(block: HTMLElement, name: string, index: number): Element | null {
  return (
    block.querySelector(`[data-aue-prop="${name}"]`) ||
    block.children[index]?.firstElementChild ||
    block.children[index] ||
    null
  );
}

function fieldText(block: HTMLElement, name: string, index: number): string {
  return fieldOf(block, name, index)?.textContent?.trim().toLowerCase() ?? '';
}

export default function decorate(block: HTMLElement): void {
  const topPadding = fieldText(block, 'topPadding', 0);
  const bottomPadding = fieldText(block, 'bottomPadding', 1);
  const visibleInPublish = fieldText(block, 'visibleInPublish', 2) === 'true';
  const visibleSeparator = fieldText(block, 'visibleSeparator', 3) === 'true';

  block.style.setProperty('--separator-padding-top', PADDING_OPTIONS.has(topPadding) ? topPadding : '10px');
  block.style.setProperty('--separator-padding-bottom', PADDING_OPTIONS.has(bottomPadding) ? bottomPadding : '10px');
  block.classList.toggle('separator--publish-hidden', !visibleInPublish);
  block.classList.toggle('separator--with-line', visibleSeparator);
  block.dataset.testid = 'separator';
}
