import { moveInstrumentation } from '@/app/scripts.js';

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const blockId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  if (blockId) block.id = blockId;

  block.setAttribute('data-testid', 'text-with-image');

  const getRowText = (row?: Element | null) =>
    row?.firstElementChild?.textContent?.trim() || row?.textContent?.trim() || '';
  const getField = (name: string): Element | null => block.querySelector(`[data-aue-prop="${name}"]`);
  const getFieldText = (name: string): string => getField(name)?.textContent?.trim() || '';
  const variationText =
    getFieldText('variation') ||
    rows
      .find((row) => {
        const value = getRowText(row);
        return value === 'little-stars' || value === 'gift-card';
      })
      ?.firstElementChild?.textContent?.trim() ||
    '';

  const resolvedLayout =
    block.classList.contains('image-left') ||
    block.querySelector('[data-aue-prop="classes"]')?.textContent?.trim() === 'image-left'
      ? 'image-left'
      : 'image-right';
  const resolvedVariant = variationText === 'gift-card' ? 'gift-card' : 'little-stars';

  block.classList.remove('image-left', 'image-right', 'little-stars', 'gift-card');
  block.classList.add(resolvedLayout, resolvedVariant);

  const eyebrowField = getField('eyebrow');
  const titleField = getField('title');
  const descriptionField = getField('description');
  const eyebrowSource = eyebrowField || rows[0]?.firstElementChild || null;
  const titleSource = titleField || rows[1]?.firstElementChild || null;
  const titleText = titleSource?.textContent?.trim() || '';
  const eyebrowText = eyebrowSource?.textContent?.trim() || '';
  const descriptionEl = descriptionField || rows[2]?.firstElementChild || null;

  const pictureRows = rows.filter((row) => row.querySelector('picture'));
  const pictureEl = getField('image')?.querySelector('picture') || pictureRows[0]?.querySelector('picture');
  const desktopImg = pictureEl?.querySelector('img');
  const altText = desktopImg?.getAttribute('alt') || '';
  const mobileField = getField('imageMobile');
  const mobileAssetRow = mobileField?.closest('div') || pictureRows[1];
  const mobilePictureEl = mobileField?.querySelector('picture') || mobileAssetRow?.querySelector('picture');
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

  const ctaGroup = getField('cta_link')?.closest('div') || rows.find((row) => row.querySelector('a'))?.firstElementChild;
  const ctaLinkEl = ctaGroup?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || getFieldText('cta_link');
  const ctaTextEl = [...(ctaGroup?.children || [])].find((element) => !element.querySelector('a'));
  const ctaText =
    ctaTextEl?.textContent?.trim() || getFieldText('cta') || '';
  const openInNewTab = [...(ctaGroup?.children || [])].some(
    (element) => element.textContent?.trim().toLowerCase() === 'true',
  ) || getFieldText('cta_openInNewTab').toLowerCase() === 'true';

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

  if (eyebrowText) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = eyebrowText;
    if (eyebrowSource) moveInstrumentation(eyebrowSource, eyebrow);
    textCol.append(eyebrow);
  }

  if (titleText) {
    const h3 = document.createElement('h3');
    h3.textContent = titleText;
    if (titleSource) moveInstrumentation(titleSource, h3);
    textCol.append(h3);
  }

  const desc = document.createElement('div');
  desc.className = 'description';

  if (descriptionEl) {
    moveInstrumentation(descriptionEl, desc);
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

    const giftCardRows: Element[] = [];
    ['image1', 'image2', 'image3'].forEach((field) => {
      const row = getField(field)?.closest('div');
      if (row?.querySelector('picture')) giftCardRows.push(row);
    });
    const layerRows = giftCardRows.length ? giftCardRows : pictureRows.slice(0, 3);
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
          moveInstrumentation(rowPicture, cardPicture);
        }

        stack.append(layer);
      });

      imageCol.append(stack);
    }
  } else if (pictureEl) {
    imageCol.append(pictureEl);
  }

  const hasImage = imageCol.hasChildNodes();
  if (!hasImage) block.classList.add('no-image');

  if (hasImage && ctaHref) {
    const imageLink = document.createElement('a');
    imageLink.className = 'image-link';
    imageLink.href = ctaHref;
    imageLink.setAttribute('data-testid', 'text-with-image-image-link');
    if (openInNewTab) imageLink.target = '_blank';
    imageLink.append(...imageCol.childNodes);
    imageCol.append(imageLink);
  }

  block.replaceChildren(textCol);
  if (hasImage) block.append(imageCol);
}
