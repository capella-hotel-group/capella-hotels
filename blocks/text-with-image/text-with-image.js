export default function decorate(block) {
  const rows = [...block.children];

  // row 0: title, row 1: description, row 2: image, row 3: cta
  const titleText = rows[0]?.firstElementChild?.textContent?.trim() || '';
  const descriptionEl = rows[1]?.firstElementChild;
  const pictureEl = rows[2]?.querySelector('picture');
  const ctaLinkEl = rows[3]?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';
  const ctaText = ctaLinkEl?.textContent?.trim() || 'Read More';

  const textCol = document.createElement('div');
  textCol.className = 'text-col';

  if (titleText) {
    const h3 = document.createElement('h3');
    h3.textContent = titleText;
    textCol.append(h3);
  }

  if (descriptionEl) {
    const desc = document.createElement('div');
    desc.className = 'description';
    desc.innerHTML = descriptionEl.innerHTML;
    textCol.append(desc);
  }

  if (ctaHref) {
    const cta = document.createElement('a');
    cta.className = 'cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaText;
    textCol.append(cta);
  }

  const imageCol = document.createElement('div');
  imageCol.className = 'image-col';
  if (pictureEl) imageCol.append(pictureEl);

  block.innerHTML = '';
  block.append(textCol, imageCol);
}
