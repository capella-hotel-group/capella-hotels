export default function decorate(block) {
  const rows = [...block.children];

  // row 0: mediaAsset (picture), row 1: description, row 2: ctaLabel
  const imageContainer = rows[0]?.firstElementChild;
  const descriptionEl = rows[1]?.firstElementChild;
  const ctaLinkEl = rows[2]?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';
  const ctaText = ctaLinkEl?.textContent?.trim()
    || rows[2]?.firstElementChild?.textContent?.trim()
    || '';

  const textCol = document.createElement('div');
  textCol.className = 'text-col';

  if (descriptionEl) {
    const desc = document.createElement('div');
    desc.className = 'description';
    desc.innerHTML = descriptionEl.innerHTML;
    textCol.append(desc);
  }

  if (ctaText) {
    const cta = document.createElement('a');
    cta.className = 'cta-link';
    if (ctaHref) cta.href = ctaHref;
    cta.textContent = ctaText;
    textCol.append(cta);
  }

  const imageCol = document.createElement('div');
  imageCol.className = 'image-col';
  if (imageContainer) imageCol.innerHTML = imageContainer.innerHTML;

  block.innerHTML = '';
  block.append(textCol, imageCol);
}
