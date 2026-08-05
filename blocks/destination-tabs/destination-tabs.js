import { moveInstrumentation } from '../../scripts/scripts.js';
import { createOptimizedPicture } from '../../scripts/aem.js';
import { getPublishBaseUrl } from '../../scripts/env.js';

function resolveAssetUrl(damPath) {
  if (!damPath) return null;
  if (damPath.startsWith('http')) return damPath;
  const publishBase = getPublishBaseUrl();
  return `${publishBase}${damPath}`;
}

async function fetchCFDetails(cfPath) {
  try {
    const publishBase = getPublishBaseUrl();
    const url = `${publishBase}/graphql/execute.json/capella-hotels/TabList;path=${cfPath}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.tabDetailsByPath?.item || null;
  } catch (error) {
    return null;
  }
}

async function renderCFPanel(panel, cfPath) {
  const cfData = await fetchCFDetails(cfPath);
  const content = panel.querySelector('.destination-tabs-panel-content');

  if (!cfData) {
    if (content) content.textContent = 'Failed to load content';
    return;
  }

  if (content) content.remove();

  const panelContent = document.createElement('div');
  panelContent.className = 'destination-tabs-panel-content';

  // --- CULTURIST HEADER (Avatar + Name & Role) ---
  const headerEl = document.createElement('div');
  headerEl.className = 'destination-tabs-header';

  const avatarCol = document.createElement('div');
  avatarCol.className = 'destination-tabs-avatar-col';

  // Destructure _path to satisfy no-underscore-dangle & dot-notation rules
  const { _path: avatarPath } = cfData.image || {};
  if (avatarPath) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'destination-tabs-avatar';
    avatarImg.src = resolveAssetUrl(avatarPath);
    avatarImg.alt = cfData.name || 'Avatar';
    avatarCol.append(avatarImg);
  }

  headerEl.append(avatarCol);

  const infoCol = document.createElement('div');
  infoCol.className = 'destination-tabs-info-col';

  if (cfData.name) {
    const nameEl = document.createElement('h3');
    nameEl.className = 'destination-tabs-name';
    nameEl.textContent = cfData.name;
    infoCol.append(nameEl);
  }

  if (cfData.role) {
    const roleEl = document.createElement('p');
    roleEl.className = 'destination-tabs-role';
    roleEl.textContent = cfData.role;
    infoCol.append(roleEl);
  }

  headerEl.append(infoCol);
  panelContent.append(headerEl);

  // Quote
  if (cfData.quote?.html) {
    const quoteEl = document.createElement('blockquote');
    quoteEl.className = 'destination-tabs-quote';
    quoteEl.innerHTML = cfData.quote.html;
    panelContent.append(quoteEl);
  }

  // Description / Bio
  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'destination-tabs-description';
    descEl.innerHTML = cfData.description.html;
    panelContent.append(descEl);
  }

  // Signature Image
  const { _path: signaturePath } = cfData.signatureImage || {};
  if (signaturePath) {
    const sigImg = document.createElement('img');
    sigImg.className = 'destination-tabs-signature';
    sigImg.src = resolveAssetUrl(signaturePath);
    sigImg.alt = `${cfData.name || 'Culturist'} Signature`;
    panelContent.append(sigImg);
  }

  // Cards Gallery
  if (cfData.cardContentReference && cfData.cardContentReference.length > 0) {
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'destination-tabs-cards-wrapper';

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'destination-tabs-cards';

    cfData.cardContentReference.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'destination-tabs-card';

      const { _path: cardImgPath } = card.image || {};
      if (cardImgPath) {
        const cardImg = document.createElement('img');
        cardImg.className = 'destination-tabs-card-img';
        cardImg.src = resolveAssetUrl(cardImgPath);
        cardImg.alt = card.title || 'Card image';
        cardEl.append(cardImg);
      }

      if (card.title) {
        const titleEl = document.createElement('span');
        titleEl.className = 'destination-tabs-card-title';
        titleEl.textContent = card.title;
        cardEl.append(titleEl);
      }

      cardsContainer.append(cardEl);
    });

    cardsWrapper.append(cardsContainer);
    panelContent.append(cardsWrapper);
  }

  panel.append(panelContent);
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const imageRow = rows[0];
  const titleRow = rows[1];
  const ctaLabelRow = rows[2];
  const ctaLinkRow = rows[3];

  const itemRows = rows.slice(4).filter((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.some((cell) => cell.textContent.trim() !== '');
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'destination-tabs-wrapper';

  // Left Feature Image
  const leftCol = document.createElement('div');
  leftCol.className = 'destination-tabs-left';

  if (imageRow) {
    const imagePicture = imageRow.querySelector('picture');
    if (imagePicture) {
      const img = imagePicture.querySelector('img');
      if (img) {
        const optimized = createOptimizedPicture(
          img.src,
          img.alt || 'Feature Image',
          false,
          [{ width: '800' }],
        );
        moveInstrumentation(imagePicture, optimized);
        leftCol.append(optimized);
      }
    }
  }

  // Right Content Column
  const rightCol = document.createElement('div');
  rightCol.className = 'destination-tabs-right';

  // Title
  const titleText = titleRow?.textContent?.trim() || '';
  if (titleText) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'destination-tabs-title';
    titleEl.textContent = titleText;
    rightCol.append(titleEl);
  }

  // Tabs Nav
  const tabsNav = document.createElement('div');
  tabsNav.className = 'destination-tabs-nav';
  tabsNav.setAttribute('role', 'tablist');

  // Panels Container
  const panelsContainer = document.createElement('div');
  panelsContainer.className = 'destination-tabs-panels';

  itemRows.forEach((itemRow, index) => {
    const itemCells = [...itemRow.querySelectorAll(':scope > div')];

    const tabNameText = itemCells[0]?.textContent?.trim() || `Tab ${index + 1}`;
    const cfRef = itemCells[1]?.textContent?.trim() || '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'destination-tabs-btn';
    btn.id = `destination-tabs-tab-${index}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `destination-tabs-panel-${index}`);
    btn.textContent = tabNameText;

    if (index === 0) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.setAttribute('aria-selected', 'false');
    }

    btn.addEventListener('click', () => {
      tabsNav.querySelectorAll('.destination-tabs-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      panelsContainer.querySelectorAll('.destination-tabs-panel').forEach((p) => {
        p.classList.remove('active');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(`destination-tabs-panel-${index}`);
      if (panel) panel.classList.add('active');
    });

    tabsNav.append(btn);

    const panel = document.createElement('div');
    panel.className = 'destination-tabs-panel';
    panel.id = `destination-tabs-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `destination-tabs-tab-${index}`);

    if (index === 0) panel.classList.add('active');

    if (cfRef) {
      panel.setAttribute('data-cf', cfRef);
      const panelContent = document.createElement('div');
      panelContent.className = 'destination-tabs-panel-content';
      panelContent.textContent = 'Loading...';
      panel.append(panelContent);

      renderCFPanel(panel, cfRef);
    }

    panelsContainer.append(panel);
  });

  rightCol.append(tabsNav, panelsContainer);

  // Bottom CTA
  const ctaLabelText = ctaLabelRow?.textContent?.trim() || 'EXPLORE KYOTO';
  const ctaLinkEl = ctaLinkRow?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || ctaLinkRow?.textContent?.trim() || '#';

  if (ctaLabelText) {
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'destination-tabs-cta';

    const cta = document.createElement('a');
    cta.className = 'destination-tabs-cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaLabelText;
    ctaContainer.append(cta);

    rightCol.append(ctaContainer);
  }

  wrapper.append(leftCol, rightCol);
  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
