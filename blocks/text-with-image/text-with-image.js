export default function decorate(block) {
  const rows = [...block.children];

  const sectionTitle = rows[0]?.firstElementChild?.textContent?.trim() || '';
  const subTitle = rows[1]?.firstElementChild?.textContent?.trim() || '';
  const descriptionEl = rows[2]?.firstElementChild;
  const pictureEl = rows[3]?.querySelector('picture');
  const altText = rows[4]?.firstElementChild?.textContent?.trim() || '';
  const ctaText = rows[5]?.firstElementChild?.textContent?.trim() || '';
  const ctaLinkEl = rows[6]?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';

  if (pictureEl && altText) {
    const img = pictureEl.querySelector('img');
    if (img) img.setAttribute('alt', altText);
  }

  const textCol = document.createElement('div');
  textCol.className = 'text-col';

  if (sectionTitle) {
    const h3 = document.createElement('h3');
    h3.textContent = sectionTitle;
    textCol.append(h3);
  }

  if (subTitle) {
    const bq = document.createElement('blockquote');
    bq.textContent = subTitle;
    textCol.append(bq);
  }

  if (descriptionEl) {
    const desc = document.createElement('div');
    desc.className = 'description';
    desc.innerHTML = descriptionEl.innerHTML;
    textCol.append(desc);
  }

  if (ctaText && ctaHref) {
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
