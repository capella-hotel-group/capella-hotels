import { moveInstrumentation } from '../../scripts/scripts.js';
import { createOptimizedPicture } from '../../scripts/aem.js';
import { getPublishBaseUrl } from '../../scripts/env.js';

// Fetch CF details using persisted GraphQL query
async function fetchCFDetails(cfPath) {
  try {
    const publishBase = getPublishBaseUrl();
    const url = `${publishBase}/graphql/execute.json/capella-hotels/TabList;path=${cfPath}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // console.error(`GraphQL error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.tabDetailsByPath?.item || null;
  } catch (error) {
    // console.error(`Failed to fetch CF: ${cfPath}`, error);
    return null;
  }
}

// Render CF data into panel
async function renderCFPanel(panel, cfPath) {
  const cfData = await fetchCFDetails(cfPath);
  let content = panel.querySelector('.destination-tabs-panel-content');

  if (!cfData) {
    if (content) content.textContent = 'Failed to load content';
    return;
  }

  // Clear placeholder
  if (content) content.remove();
  // Create content structure from CF fields
  const panelContent = document.createElement('div');
  panelContent.className = 'destination-tabs-panel-content';

  // Header: Avatar + Name + Role (horizontal layout)
  const headerEl = document.createElement('div');
  headerEl.className = 'destination-tabs-header';

  // Avatar image
  if (cfData.image?._path) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'destination-tabs-avatar';
    avatarImg.src = cfData.image._path;
    avatarImg.alt = cfData.name || 'Avatar';
    headerEl.append(avatarImg);
  }

  // Header content: Name + Role
  const headerContent = document.createElement('div');
  headerContent.className = 'destination-tabs-header-content';

  // Name
  if (cfData.name) {
    const nameEl = document.createElement('h3');
    nameEl.className = 'destination-tabs-name';
    nameEl.textContent = cfData.name;
    headerContent.append(nameEl);
  }

  // Role
  if (cfData.role) {
    const roleEl = document.createElement('p');
    roleEl.className = 'destination-tabs-role';
    roleEl.textContent = cfData.role;
    headerContent.append(roleEl);
  }

  headerEl.append(headerContent);
  panelContent.append(headerEl);

  // Quote
  if (cfData.quote?.html) {
    const quoteEl = document.createElement('blockquote');
    quoteEl.className = 'destination-tabs-quote';
    quoteEl.innerHTML = cfData.quote.html;
    panelContent.append(quoteEl);
  }

  // Description (bio)
  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'destination-tabs-description';
    descEl.innerHTML = cfData.description.html;
    panelContent.append(descEl);
  }
  // Signature image
  if (cfData.signatureImage?._path) {
    const sigImg = document.createElement('img');
    sigImg.className = 'destination-tabs-signature';
    sigImg.src = cfData.signatureImage._path;
    sigImg.alt = `${cfData.name} Signature`;
    panelContent.append(sigImg);
  }  
  
  // Cards gallery from cardContentReference
  if (cfData.cardContentReference && cfData.cardContentReference.length > 0) {
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'destination-tabs-cards';

    cfData.cardContentReference.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'destination-tabs-card';

      if (card.image?._path) {
        const cardImg = document.createElement('img');
        cardImg.src = card.image._path;
        cardImg.alt = card.title || 'Card image';
        cardEl.append(cardImg);
      }

      if (card.title) {
        const titleEl = document.createElement('p');
        titleEl.className = 'destination-tabs-card-title';
        titleEl.textContent = card.title;
        cardEl.append(titleEl);
      }

      cardsContainer.append(cardEl);
    });

    panelContent.append(cardsContainer);
  }

  panel.append(panelContent);
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Main block structure:
  // row 0: image (feature image)
  // row 1: title (section heading)
  // row 2: ctaLabel
  // row 3: ctaLink
  // rows 4+: tab items

  const imageRow = rows[0];
  const titleRow = rows[1];
  const ctaLabelRow = rows[2];
  const ctaLinkRow = rows[3];
  const itemRows = rows.slice(4);

  // Create main wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'destination-tabs-wrapper';

  // Left column: feature image
  const leftCol = document.createElement('div');
  leftCol.className = 'destination-tabs-left';

  const imagePicture = imageRow?.querySelector('picture');
  if (imagePicture) {
    const img = imagePicture.querySelector('img');
    if (img) {
      const optimized = createOptimizedPicture(
        img.src,
        img.alt || 'Feature Image',
        false,
        [{ width: '400' }],
      );
      moveInstrumentation(imagePicture, optimized);
      leftCol.append(optimized);
    }
  }

  // Right column: title, tabs, CTA
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

  // Tab navigation
  const tabsNav = document.createElement('div');
  tabsNav.className = 'destination-tabs-nav';
  tabsNav.setAttribute('role', 'tablist');

  // Tab panels container
  const panelsContainer = document.createElement('div');
  panelsContainer.className = 'destination-tabs-panels';

  // Build tabs and panels from item rows
  itemRows.forEach((itemRow, index) => {
    const itemCells = [...itemRow.querySelectorAll(':scope > div')];

    // Item structure:
    // cell 0: tabName
    // cell 1: cfReference (content fragment path)

    const tabNameText = itemCells[0]?.textContent?.trim() || `Tab ${index + 1}`;
    const cfRef = itemCells[1]?.textContent?.trim() || '';

    // Create tab button
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

    // Create tab panel with CF reference
    const panel = document.createElement('div');
    panel.className = 'destination-tabs-panel';
    panel.id = `destination-tabs-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `destination-tabs-tab-${index}`);

    if (index === 0) {
      panel.classList.add('active');
    }

    // Fetch and render CF content
    if (cfRef) {
      panel.setAttribute('data-cf', cfRef);
      const panelContent = document.createElement('div');
      panelContent.className = 'destination-tabs-panel-content';
      panelContent.textContent = 'Loading...';
      panel.append(panelContent);

      // Fetch CF details using persisted query and render
      renderCFPanel(panel, cfRef);
    }

    panelsContainer.append(panel);
  });

  rightCol.append(tabsNav, panelsContainer);

  // CTA Link (at bottom of right column)
  const ctaLabelText = ctaLabelRow?.textContent?.trim() || 'Explore';
  const ctaLinkEl = ctaLinkRow?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || '#';

  if (ctaLabelText || ctaHref) {
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'destination-tabs-cta';

    const cta = document.createElement('a');
    cta.className = 'destination-tabs-cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaLabelText;
    ctaContainer.append(cta);

    rightCol.append(ctaContainer);
  }

  // Assemble wrapper
  wrapper.append(leftCol, rightCol);

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
