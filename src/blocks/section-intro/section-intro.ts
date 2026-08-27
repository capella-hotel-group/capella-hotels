export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];

  // Row 0 → h2 heading
  const headingText = rows[0]?.querySelector('div')?.textContent?.trim();
  const h2 = document.createElement('h2');
  h2.textContent = headingText ?? '';
  rows[0]?.replaceWith(h2);

  // Rows 1 & 2 → wrap in a flex container
  const textWrapper = document.createElement('div');
  textWrapper.classList.add('section-intro-text');
  const classNames = ['subtext', 'desc'];
  rows.slice(1).forEach((row, i) => {
    const cell = row.querySelector('div');
    if (cell) {
      const className = classNames[i];
      if (className) cell.classList.add(className);
      textWrapper.appendChild(cell);
    }
    row.remove();
  });
  block.appendChild(textWrapper);
}
