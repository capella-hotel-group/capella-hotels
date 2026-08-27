export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const blockId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  if (blockId) block.id = blockId;

  // row 0: eyebrow
  // row 1: title
  // row 2: description
  // row 3: desktop image (picture)
  // row 4: mobile/tablet image (picture)
  // row 5: cta group (label, link, open in new tab)
  const eyebrowText = rows[0]?.firstElementChild?.textContent?.trim() || '';
  const titleText = rows[1]?.firstElementChild?.textContent?.trim() || '';
  const descriptionEl = rows[2]?.firstElementChild;
  const pictureEl = rows[3]?.querySelector('picture');
  const desktopImg = pictureEl?.querySelector('img');
  const altText = desktopImg?.getAttribute('alt') || '';
  const mobilePictureEl = rows[4]?.querySelector('picture');
  const mobileImg = mobilePictureEl?.querySelector('img');
  const mobileSource = mobilePictureEl?.querySelector('source');
  const mobileSrc = mobileSource?.getAttribute('srcset') || mobileImg?.getAttribute('src');
  const mobileAltText = mobileImg?.getAttribute('alt') || '';
  const responsiveAltText = mobileAltText || altText;
  const ctaGroup = rows[5]?.firstElementChild;
  const ctaLinkEl = ctaGroup?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';
  const ctaTextEl = [...(ctaGroup?.children || [])].find((element) => !element.querySelector('a'));
  const ctaText = ctaTextEl?.textContent?.trim() || '';
  const openInNewTabEl = [...(ctaGroup?.children || [])].find((element) =>
    /^(true|false)$/i.test(element.textContent?.trim() ?? ''),
  );
  const openInNewTabValue = openInNewTabEl?.textContent?.trim().toLowerCase() || '';
  const openInNewTab = openInNewTabValue === 'true';

  if (pictureEl) {
    const responsiveImageQuery = window.matchMedia('(max-width: 1024px)');
    const updateAltText = () => {
      if (desktopImg) {
        desktopImg.alt = responsiveImageQuery.matches ? responsiveAltText : altText;
      }
    };
    updateAltText();

    if (mobilePictureEl) {
      if (mobileSrc) {
        const source = document.createElement('source');
        source.media = '(max-width: 1024px)';
        source.srcset = mobileSrc;
        pictureEl.prepend(source);
      }
      responsiveImageQuery.addEventListener('change', updateAltText);
    }
  }

  const textCol = document.createElement('div');
  textCol.className = 'text-col';

  if (eyebrowText) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = eyebrowText;
    textCol.append(eyebrow);
  }

  if (titleText) {
    const h3 = document.createElement('h3');
    h3.textContent = titleText;
    textCol.append(h3);
  }

  const desc = document.createElement('div');
  desc.className = 'description';

  if (descriptionEl) {
    desc.append(...descriptionEl.childNodes);
  }

  textCol.append(desc);

  if (ctaHref && ctaText) {
    const cta = document.createElement('a');
    cta.className = 'cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaText;
    if (openInNewTab) cta.target = '_blank';
    textCol.append(cta);
  }

  const imageCol = document.createElement('div');
  imageCol.className = 'image-col';
  if (mobileSrc) imageCol.classList.add('has-mobile-image');
  if (pictureEl) imageCol.append(pictureEl);
  mobilePictureEl?.remove();

  block.innerHTML = '';
  block.append(textCol, imageCol);
}
