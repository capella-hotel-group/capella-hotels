import { moveInstrumentation } from '@/app/scripts';

export default function decorate(block: HTMLElement): void {
  block.dataset.testid = 'section-header';
  const rows = [...block.children];
  const fieldOf = (name: string) => block.querySelector<HTMLElement>(`[data-aue-prop="${name}"]`);
  const titleField = fieldOf('title');
  const bodyField = fieldOf('body');
  const hasAnchorRow = rows.length >= 3;
  const anchorRow = hasAnchorRow ? rows[0] : undefined;
  const titleRow = rows.find((row) => titleField && row.contains(titleField)) || rows[hasAnchorRow ? 1 : 0];
  const bodyRow = rows.find((row) => bodyField && row.contains(bodyField)) || rows[hasAnchorRow ? 2 : 1];
  const anchorId = fieldOf('id')?.textContent?.trim() || anchorRow?.textContent?.trim();
  if (anchorId) block.id = anchorId.replace(/^#/, '');
  anchorRow?.classList.add('section-header-anchor');
  titleRow?.classList.add('section-header-title-row');
  bodyRow?.classList.add('section-header-body-row');

  const headingSource = titleField || titleRow?.querySelector<HTMLElement>('div');
  if (headingSource) {
    const heading = document.createElement('h2');
    heading.className = 'section-header-title';
    const paragraphs = [...headingSource.querySelectorAll('p')];
    if (paragraphs.length) {
      paragraphs.forEach((paragraph, index) => {
        if (index > 0) heading.append(document.createElement('br'));
        heading.append(...paragraph.childNodes);
      });
    } else {
      heading.append(...headingSource.childNodes);
    }
    moveInstrumentation(headingSource, heading);
    headingSource.replaceWith(heading);
  }

  const narrative = bodyField || bodyRow?.querySelector<HTMLElement>('div');
  narrative?.classList.add('section-header-text');
}
