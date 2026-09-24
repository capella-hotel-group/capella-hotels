export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const blockId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  if (blockId) block.id = blockId;

  block.setAttribute('data-testid', 'text-with-image');

  const getRowText = (row?: Element | null) =>
    row?.firstElementChild?.textContent?.trim() || row?.textContent?.trim() || '';
  const variationText =
    rows
      .find((row) => {
        const value = getRowText(row);
        return value === 'little-stars' || value === 'gift-card';
      })
      ?.firstElementChild?.textContent?.trim() ||
    block.querySelector('[data-aue-prop="variation"]')?.textContent?.trim() ||
    '';

  const resolvedLayout =
    block.classList.contains('image-left') ||
    block.querySelector('[data-aue-prop="classes"]')?.textContent?.trim() === 'image-left'
      ? 'image-left'
      : 'image-right';
  const resolvedVariant = variationText === 'gift-card' ? 'gift-card' : 'little-stars';

  block.classList.remove('image-left', 'image-right', 'little-stars', 'gift-card');
  block.classList.add(resolvedLayout, resolvedVariant);

  const titleText =
    rows
      .find((row) => {
        const text = getRowText(row);
        return (
          Boolean(text) &&
          text !== 'little-stars' &&
          text !== 'gift-card' &&
          !row.querySelector('picture') &&
          !row.querySelector('a') &&
          !['details', 'true', 'false'].includes(text.toLowerCase())
        );
      })
      ?.firstElementChild?.textContent?.trim() ||
    block.querySelector('[data-aue-prop="title"]')?.textContent?.trim() ||
    '';

  const descriptionText = rows.find((row) => {
    const text = getRowText(row);
    return (
      Boolean(text) &&
      !row.querySelector('picture') &&
      !row.querySelector('a') &&
      text !== titleText &&
      text !== 'details' &&
      text !== 'true' &&
      text !== 'false' &&
      text !== 'little-stars' &&
      text !== 'gift-card'
    );
  });

  const descriptionEl = descriptionText?.firstElementChild || block.querySelector('[data-aue-prop="description"]');

  const pictureRows = rows.filter((row) => row.querySelector('picture'));
  const pictureEl = pictureRows[0]?.querySelector('picture');
  const desktopImg = pictureEl?.querySelector('img');
  const altText = desktopImg?.getAttribute('alt') || '';
  const mobileAssetRow = pictureRows[1];
  const mobilePictureEl = mobileAssetRow?.querySelector('picture');
  const mobileImg = mobilePictureEl?.querySelector('img');
  const mobileSource = mobilePictureEl?.querySelector('source');
  const mobileAsset = mobileAssetRow?.querySelector('img, a[href]');
  const mobileSrc =
    mobileSource?.getAttribute('srcset') ||
    mobileImg?.getAttribute('src') ||
    mobileAsset?.getAttribute('src') ||
    mobileAsset?.getAttribute('href') ||
    mobileAssetRow?.textContent?.trim();
  const mobileAltText = mobileImg?.getAttribute('alt') || '';
  const responsiveAltText = mobileAltText || altText;

  const ctaGroup = rows.find((row) => row.querySelector('a'))?.firstElementChild;
  const ctaLinkEl = ctaGroup?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '';
  const ctaTextEl = [...(ctaGroup?.children || [])].find((element) => !element.querySelector('a'));
  const ctaText =
    ctaTextEl?.textContent?.trim() || block.querySelector('[data-aue-prop="cta"]')?.textContent?.trim() || '';
  const openInNewTab = [...(ctaGroup?.children || [])].some(
    (element) => element.textContent?.trim().toLowerCase() === 'true',
  );

  if (pictureEl) {
    const responsiveImageQuery = window.matchMedia('(max-width: 767px)');
    const updateAltText = () => {
      if (desktopImg) {
        desktopImg.alt = responsiveImageQuery.matches ? responsiveAltText : altText;
      }
    };
    updateAltText();

    if (mobilePictureEl) {
      if (mobileSrc) {
        const source = document.createElement('source');
        source.media = '(max-width: 767px)';
        source.srcset = mobileSrc;
        pictureEl.prepend(source);
      }
      responsiveImageQuery.addEventListener('change', updateAltText);
    }
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

  if (descriptionEl) {
    desc.append(...descriptionEl.childNodes);
  }

  textCol.append(desc);

  if (ctaHref && ctaText) {
    const cta = document.createElement('a');
    cta.className = 'cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaText;
    cta.setAttribute('data-testid', 'text-with-image-cta');
    if (openInNewTab) cta.target = '_blank';
    textCol.append(cta);
  }

  const imageCol = document.createElement('div');
  imageCol.className = 'image-col';

  if (resolvedVariant === 'gift-card') {
    const stack = document.createElement('div');
    stack.className = 'gift-card-stack';

    const layerRows = pictureRows.slice(0, 3);
    if (layerRows.length > 0) {
      layerRows.forEach((row, index) => {
        const layer = document.createElement('div');
        layer.className = 'gift-card-layer';
        layer.style.setProperty('--gift-card-offset', `${index * 18}px`);
        layer.style.setProperty('--gift-card-rotation', `${(index - 1) * 4}deg`);

        const rowPicture = row.querySelector('picture');
        const rowImg = rowPicture?.querySelector('img') || row.querySelector('img');

        if (rowPicture) {
          const cardPicture = rowPicture.cloneNode(true) as HTMLPictureElement;
          const cardImg = cardPicture.querySelector('img');
          if (cardImg) cardImg.alt = rowImg?.getAttribute('alt') || altText || '';
          layer.append(cardPicture);
        }

        stack.append(layer);
      });

      imageCol.append(stack);
    }
  } else if (pictureEl) {
    imageCol.append(pictureEl);
  }

  block.innerHTML = '';
  block.append(textCol, imageCol);
}
