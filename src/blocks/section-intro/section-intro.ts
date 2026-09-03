export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const fieldOf = (name: string) => block.querySelector<HTMLElement>(`[data-aue-prop="${name}"]`);
  const titleField = fieldOf('title');
  const bodyField = fieldOf('body');
  const hasLegacyAnchorRow = !titleField && rows.length >= 3;
  const anchorRow = hasLegacyAnchorRow ? rows[0] : undefined;
  const titleRow = rows[hasLegacyAnchorRow ? 1 : 0];
  const bodyRow = rows[hasLegacyAnchorRow ? 2 : 1];
  const anchorId = fieldOf('id')?.textContent?.trim() || anchorRow?.textContent?.trim();
  if (anchorId) block.id = anchorId.replace(/^#/, '');

  const headingText = titleField?.textContent?.trim() || titleRow?.querySelector('div')?.textContent?.trim() || '';
  const h2 = document.createElement('h2');
  h2.className = 'section-intro-title';
  h2.textContent = headingText;

  const narrative = bodyField || bodyRow?.querySelector<HTMLElement>('div');
  const textWrapper = document.createElement('div');
  textWrapper.className = 'section-intro-text';
  if (narrative) textWrapper.append(narrative);

  block.replaceChildren(h2, textWrapper);
}
