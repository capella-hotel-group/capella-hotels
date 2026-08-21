export default function decorate(block) {
  const rows = [...block.children];

  // row 0: title
  // row 1: eyebrow
  // row 2: description
  // row 3: desktop image (picture)
  // row 4: mobile/tablet image (picture)
  // row 5: cta group (label, link, open in new tab)
  const titleText = rows[0]?.firstElementChild?.textContent?.trim() || '';
  const eyebrowText = rows[1]?.firstElementChild?.textContent?.trim() || '';
  const descriptionEl = rows[2]?.firstElementChild;
  const pictureEl = rows[3]?.querySelector('picture');
  const desktopImg = pictureEl?.querySelector('img');
  const altText = desktopImg?.getAttribute('alt') || '';
  const mobilePictureEl = rows[4]?.querySelector('picture');
  const mobileImg = mobilePictureEl?.querySelector('img');
  const mobileAltText = mobileImg?.getAttribute('alt') || '';
  const ctaGroup = rows[5]?.firstElementChild;
  const ctaLinkEl = ctaGroup?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';
  const ctaTextEl = [...(ctaGroup?.children || [])].find((element) => !element.querySelector('a'));
  const ctaText = ctaTextEl?.textContent?.trim() || 'Read More';
  const openInNewTabEl = [...(ctaGroup?.children || [])]
    .find((element) => /^(true|false)$/i.test(element.textContent.trim()));
  const openInNewTabValue = openInNewTabEl?.textContent?.trim().toLowerCase() || '';
  const openInNewTab = openInNewTabValue === 'true';

  if (pictureEl) {
    const responsiveImageQuery = window.matchMedia('(max-width: 1024px)');
    const updateAltText = () => {
      if (desktopImg) {
        desktopImg.alt = responsiveImageQuery.matches && mobileAltText ? mobileAltText : altText;
      }
    };
    updateAltText();

    if (mobilePictureEl) {
      const mobilePictureImg = mobilePictureEl.querySelector('img');
      const mobileSource = mobilePictureEl.querySelector('source');
      const mobileSrc = mobileSource?.getAttribute('srcset') || mobilePictureImg?.getAttribute('src');
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
    desc.innerHTML += descriptionEl.innerHTML;
  }

  textCol.append(desc);

  if (ctaHref) {
    const cta = document.createElement('a');
    cta.className = 'cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaText;
    if (openInNewTab) cta.target = '_blank';
    textCol.append(cta);
  }

  const imageCol = document.createElement('div');
  imageCol.className = 'image-col';
  if (pictureEl) imageCol.append(pictureEl);
  mobilePictureEl?.remove();

  block.innerHTML = '';
  block.append(textCol, imageCol);
}
