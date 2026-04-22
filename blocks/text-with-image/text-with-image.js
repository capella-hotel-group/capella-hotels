export default function decorate(block) {
  const rows = [...block.children];

  // row 0: title
  // row 1: blockquote (subtitle)
  // row 2: description
  // row 3: image (picture)
  // row 4: alt text
  // row 5: cta text
  // row 6: cta link
  const titleText = rows[0]?.firstElementChild?.textContent?.trim() || '';
  const blockquoteText = rows[1]?.firstElementChild?.textContent?.trim() || '';
  const descriptionEl = rows[2]?.firstElementChild;
  const pictureEl = rows[3]?.querySelector('picture');
  const altText = rows[4]?.firstElementChild?.textContent?.trim() || '';
  const ctaText = rows[5]?.firstElementChild?.textContent?.trim() || 'Read More';
  const ctaLinkEl = rows[6]?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';

  if (altText && pictureEl) {
    const img = pictureEl.querySelector('img');
    if (img) img.alt = altText;
  }

  const textCol = document.createElement('div');
  textCol.className = 'text-col';

  if (titleText) {
    const h3 = document.createElement('h3');
    h3.textContent = titleText;
    textCol.append(h3);
  }

  const desc = document.createElement('div');
  desc.className = 'description';

  if (blockquoteText) {
    const h4 = document.createElement('h4');
    h4.textContent = blockquoteText;
    desc.append(h4);
  }

  if (descriptionEl) {
    desc.innerHTML += descriptionEl.innerHTML;
  }

  textCol.append(desc);

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
