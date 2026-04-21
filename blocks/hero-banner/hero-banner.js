export default function decorate(block) {
  const rows = [...block.children];

  // row 0: mediaAsset, row 1: description, row 2: ctaLabel
  const mediaEl = rows[0]?.firstElementChild;
  const descriptionEl = rows[1]?.firstElementChild;
  const ctaText = rows[2]?.firstElementChild?.textContent?.trim() || '';

  const mediaWrapper = document.createElement('div');
  mediaWrapper.className = 'media';
  if (mediaEl) mediaWrapper.append(...mediaEl.childNodes);

  const content = document.createElement('div');
  content.className = 'content';

  if (descriptionEl?.innerHTML) {
    const desc = document.createElement('div');
    desc.className = 'description';
    desc.innerHTML = descriptionEl.innerHTML;
    content.append(desc);
  }

  if (ctaText) {
    const cta = document.createElement('button');
    cta.className = 'cta-btn';
    cta.type = 'button';
    cta.textContent = ctaText;
    content.append(cta);
  }

  block.innerHTML = '';
  block.append(mediaWrapper, content);
}
