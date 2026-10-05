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

  const headingSource = titleField || titleRow?.querySelector<HTMLElement>('div');
  const headingParagraphs = headingSource ? [...headingSource.querySelectorAll('p')] : [];
  const headingLines = (headingParagraphs.length ? headingParagraphs : [headingSource])
    .map((el) => el?.textContent?.trim() || '')
    .filter(Boolean);

  const h2 = document.createElement('h2');
  h2.className = 'section-intro-title';
  // authors author each title line as its own <p>; keep the hard break instead of flattening to one line
  headingLines.forEach((line, i) => {
    if (i > 0) h2.append(document.createElement('br'));
    h2.append(document.createTextNode(line));
  });

  const narrative = bodyField || bodyRow?.querySelector<HTMLElement>('div');
  const textWrapper = document.createElement('div');
  textWrapper.className = 'section-intro-text';
  if (narrative) textWrapper.append(narrative);

  block.replaceChildren(h2, textWrapper);
}
