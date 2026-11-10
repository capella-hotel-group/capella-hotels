import { moveInstrumentation } from '@/app/scripts.js';
import { createCarouselControls } from '../destination-cards/carousel.ts';

function stripHtml(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.textContent?.trim() ?? '';
}

function textFromCell(cell?: Element | null): string {
  if (!cell) return '';
  const paragraphs = [...cell.querySelectorAll('p')];
  const sources = paragraphs.length ? paragraphs.map((p) => p.innerHTML) : [cell.innerHTML];
  const lines = sources
    .flatMap((html) => html.split(/<br\s*\/?>/i))
    .map(stripHtml)
    .filter(Boolean);
  return lines.length ? lines.join('\n') : (cell.textContent?.trim() ?? '');
}

function isEnabled(value?: Element | string | null, fallback = false): boolean {
  const text = typeof value === 'string' ? value : textFromCell(value);
  if (!text) return fallback;
  return ['true', 'yes', 'enabled'].includes(text.trim().toLowerCase());
}

function setLinkAttributes(link: HTMLAnchorElement, href: string, openInNewTab: boolean = false): void {
  link.setAttribute('href', href);
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

interface DestinationMapping {
  location: string;
  url: string;
}

interface CardFields {
  image: Element | null | undefined;
  imageAlt: string | null;
  darkOverlay: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  ctaActionMode: string;
  ctaLink: string;
  openInNewTab: boolean;
}

interface BlockConfig {
  id: string;
  testId: string;
  eyebrow: string;
  title: string;
  description: string;
  backgroundStyle: string;
  modalHeading: string;
  destinationMappings: DestinationMapping[];
  modalSubmitLabel: string;
}

function getCardFields(row: Element): CardFields {
  const cells = [...row.children];

  const ctaLabel = textFromCell(cells[4]) || 'EXPLORE NOW';
  const ctaActionMode = textFromCell(cells[5]) || 'destination-modal';

  return {
    image: cells[0]?.querySelector('picture, img'),
    imageAlt: cells[0]?.querySelector('img')?.getAttribute('alt') || '',
    darkOverlay: isEnabled(cells[1]),
    title: textFromCell(cells[2]),
    description: textFromCell(cells[3]),
    ctaLabel: ctaLabel.includes('modal') || ctaLabel.includes('url') ? 'EXPLORE NOW' : ctaLabel,
    ctaActionMode,
    ctaLink: cells[6]?.querySelector('a')?.getAttribute('href') || textFromCell(cells[6]),
    openInNewTab: isEnabled(cells[7]),
  };
}

function buildIntro(config: BlockConfig): HTMLDivElement {
  const intro = document.createElement('div');
  intro.className = 'destination-cards-signature-intro';

  if (config.id) {
    intro.id = config.id;
  }

  if (config.eyebrow) {
    const eyebrow = document.createElement('div');
    eyebrow.className = 'destination-cards-signature-eyebrow';
    eyebrow.textContent = config.eyebrow;
    intro.append(eyebrow);
  }

  if (config.title) {
    const heading = document.createElement('h2');
    heading.className = 'destination-cards-signature-title';
    heading.textContent = config.title;
    intro.append(heading);
  }

  if (config.description) {
    const subtitle = document.createElement('div');
    subtitle.className = 'destination-cards-signature-description';
    subtitle.innerHTML = config.description;
    intro.append(subtitle);
  }

  return intro;
}

function buildCard(row: Element): HTMLLIElement {
  const fields = getCardFields(row);
  const item = document.createElement('li');
  item.className = 'destination-cards-signature-item';
  item.setAttribute('data-testid', 'destination-cards-signature-card');
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'destination-cards-signature-card';

  // Image with optional dark overlay
  if (fields.image) {
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'destination-cards-signature-image-wrapper';
    if (fields.darkOverlay) {
      imageWrapper.classList.add('destination-cards-signature-image-wrapper--dark-overlay');
    }
    imageWrapper.append(fields.image.cloneNode(true));
    article.append(imageWrapper);
  }

  // Card content
  const content = document.createElement('div');
  content.className = 'destination-cards-signature-card-content';

  if (fields.title) {
    const title = document.createElement('h3');
    title.className = 'destination-cards-signature-card-title';
    title.textContent = fields.title;
    content.append(title);
  }

  if (fields.description) {
    const description = document.createElement('div');
    description.className = 'destination-cards-signature-card-description';
    description.innerHTML = fields.description;
    content.append(description);
  }

  if (fields.ctaLabel) {
    const cta = document.createElement('a');
    cta.className = 'destination-cards-signature-cta';
    cta.setAttribute('data-testid', 'destination-cards-signature-cta');
    cta.textContent = fields.ctaLabel;
    cta.setAttribute('data-cta-action-mode', fields.ctaActionMode);

    // Handle link based on action mode
    if (fields.ctaActionMode === 'destination-modal') {
      // For modal mode, use role="button"
      cta.setAttribute('role', 'button');
      cta.setAttribute('tabindex', '0');
    } else {
      // For direct link mode, set href and respect openInNewTab setting
      if (fields.ctaLink) {
        setLinkAttributes(cta, fields.ctaLink, fields.openInNewTab);
      } else {
        cta.href = '#';
      }
    }

    content.append(cta);
  }

  article.append(content);
  item.append(article);

  return item;
}

function buildModal(config: BlockConfig): HTMLDivElement {
  const modal = document.createElement('div');
  modal.className = 'destination-cards-signature-modal-wrapper';

  const dialog = document.createElement('dialog');
  dialog.className = 'destination-cards-signature-modal';
  dialog.setAttribute('data-testid', 'destination-cards-signature-modal');

  // Modal content container
  const content = document.createElement('div');
  content.className = 'destination-cards-signature-modal-content';

  // Modal title
  const title = document.createElement('h2');
  title.className = 'destination-cards-signature-modal-title';
  title.textContent = config.modalHeading || 'Choose destination';
  content.append(title);

  // Destination carousel group
  const carouselGroup = document.createElement('div');
  carouselGroup.className = 'destination-cards-signature-carousel-group';

  // Gradient mask overlay
  const maskOverlay = document.createElement('div');
  maskOverlay.className = 'destination-cards-signature-mask-overlay';
  carouselGroup.append(maskOverlay);

  // Carousel container with destinations
  const carouselContainer = document.createElement('div');
  carouselContainer.className = 'destination-cards-signature-carousel-container';

  const destinationList = document.createElement('div');
  destinationList.className = 'destination-cards-signature-destination-list';
  destinationList.setAttribute('data-testid', 'destination-cards-signature-destination-list');

  config.destinationMappings.forEach((mapping, index) => {
    const destinationItem = document.createElement('div');
    destinationItem.className = 'destination-cards-signature-destination-item';
    destinationItem.setAttribute('data-testid', `destination-cards-signature-destination-${index}`);
    destinationItem.setAttribute('data-destination', mapping.url);

    const destinationName = document.createElement('h3');
    destinationName.className = 'destination-cards-signature-destination-name';
    destinationName.textContent = mapping.location;
    destinationItem.append(destinationName);

    destinationList.append(destinationItem);
  });

  carouselContainer.append(destinationList);
  carouselGroup.append(carouselContainer);
  content.append(carouselGroup);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.className = 'destination-cards-signature-modal-submit';
  submitBtn.setAttribute('data-testid', 'destination-cards-signature-modal-submit');
  submitBtn.textContent = config.modalSubmitLabel || 'GO TO DESTINATION';
  content.append(submitBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'destination-cards-signature-modal-close';
  closeBtn.setAttribute('data-testid', 'destination-cards-signature-modal-close');
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.innerHTML = '✕';
  content.append(closeBtn);

  dialog.append(content);
  modal.append(dialog);

  return modal;
}

function setupModalHandlers(block: Element, modal: HTMLElement): void {
  const dialog = modal.querySelector('dialog') as HTMLDialogElement | null;
  const closeBtn = modal.querySelector('.destination-cards-signature-modal-close') as HTMLButtonElement | null;
  const submitBtn = modal.querySelector('.destination-cards-signature-modal-submit') as HTMLButtonElement | null;
  const destinationList = modal.querySelector('.destination-cards-signature-destination-list') as HTMLElement | null;
  const carouselContainer = modal.querySelector(
    '.destination-cards-signature-carousel-container',
  ) as HTMLElement | null;

  if (!dialog || !closeBtn || !submitBtn || !destinationList || !carouselContainer) {
    console.error('destination-cards-signature: Modal elements not found');
    return;
  }

  const ctaButtons = block.querySelectorAll('.destination-cards-signature-cta');
  let selectedDestination: HTMLElement | null = null;

  // Make carousel container scrollable with proper overflow
  carouselContainer.style.overflowY = 'scroll';
  carouselContainer.style.scrollSnapType = 'y mandatory';

  const destinationItems = destinationList.querySelectorAll('.destination-cards-signature-destination-item');
  let clickedDestination: HTMLElement | null = null;

  // Scroll handler to update active item based on center position
  const updateCenterItem = () => {
    const containerRect = carouselContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    let closestItem: HTMLElement | null = null;
    let closestDistance = Infinity;

    for (let i = 0; i < destinationItems.length; i += 1) {
      const item = destinationItems[i] as HTMLElement;
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(containerCenter - itemCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestItem = item;
      }
    }

    // Update active state
    for (let i = 0; i < destinationItems.length; i += 1) {
      (destinationItems[i] as HTMLElement).classList.remove('active');
    }
    if (closestItem) {
      closestItem.classList.add('active');
      selectedDestination = closestItem;
    }
  };

  const openModal = () => {
    if (dialog.showModal) {
      dialog.showModal();
    } else {
      dialog.style.display = 'block';
    }
    // Add modal-open class to body to prevent scroll
    document.body.classList.add('modal-open');
    // Update center item after modal opens and layout is settled
    setTimeout(() => {
      updateCenterItem();
      clickedDestination = null; // Reset clicked selection when modal opens
    }, 100);
  };

  const closeModal = () => {
    if (dialog.close) {
      dialog.close();
    } else {
      dialog.style.display = 'none';
    }
    // Remove modal-open class from body to restore scroll
    document.body.classList.remove('modal-open');
  };

  destinationItems.forEach((item: Element) => {
    item.addEventListener('click', () => {
      // Mark as clicked to persist selection
      clickedDestination = item as HTMLElement;
      selectedDestination = clickedDestination;
      // Update active state
      for (let i = 0; i < destinationItems.length; i += 1) {
        (destinationItems[i] as HTMLElement).classList.remove('active');
      }
      (item as HTMLElement).classList.add('active');
      // Scroll to center
      (item as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Hover listener to update active state (always show hover preview)
    item.addEventListener('mouseenter', () => {
      for (let i = 0; i < destinationItems.length; i += 1) {
        (destinationItems[i] as HTMLElement).classList.remove('active');
      }
      (item as HTMLElement).classList.add('active');
      selectedDestination = item as HTMLElement;
    });

    // Mouseleave listener to restore clicked item (if any)
    item.addEventListener('mouseleave', () => {
      if (clickedDestination) {
        for (let i = 0; i < destinationItems.length; i += 1) {
          (destinationItems[i] as HTMLElement).classList.remove('active');
        }
        clickedDestination.classList.add('active');
        selectedDestination = clickedDestination;
      }
    });
  });

  ctaButtons.forEach((btn: Element) => {
    btn.addEventListener('click', (e: Event) => {
      const ctaBtn = btn as HTMLAnchorElement;
      const actionMode = ctaBtn.getAttribute('data-cta-action-mode');

      if (actionMode === 'destination-modal') {
        e.preventDefault();
        selectedDestination = null; // Reset selection
        openModal();
      }
      // For 'direct-url' or any other mode, use the href normally (don't preventDefault)
    });

    // For keyboard accessibility of modal buttons (Enter/Space)
    if ((btn as HTMLAnchorElement).getAttribute('data-cta-action-mode') === 'destination-modal') {
      btn.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          selectedDestination = null; // Reset selection
          openModal();
        }
      });
    }
  });

  closeBtn.addEventListener('click', closeModal);

  // Close modal when clicking on the backdrop (wrapper) but not on the dialog itself
  modal.addEventListener('click', (e: Event) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  submitBtn.addEventListener('click', () => {
    if (selectedDestination) {
      const destinationUrl = selectedDestination.getAttribute('data-destination');
      if (destinationUrl) {
        window.location.href = destinationUrl;
      }
    }
  });

  dialog.addEventListener('cancel', closeModal);
}

function getBlockConfig(rows: Element[]): { config: BlockConfig; cardStartIndex: number } {
  const [idRow, testIdRow, eyebrowRow, titleRow, descriptionRow, bgStyleRow, modalHeadingRow, modalSubmitLabelRow] =
    rows.slice(0, 8);

  const config: BlockConfig = {
    id: textFromCell(idRow?.firstElementChild || idRow),
    testId: textFromCell(testIdRow?.firstElementChild || testIdRow),
    eyebrow: textFromCell(eyebrowRow?.firstElementChild || eyebrowRow),
    title: textFromCell(titleRow?.firstElementChild || titleRow),
    description: textFromCell(descriptionRow?.firstElementChild || descriptionRow),
    backgroundStyle: textFromCell(bgStyleRow?.firstElementChild || bgStyleRow) || 'signature-warm',
    modalHeading: textFromCell(modalHeadingRow?.firstElementChild || modalHeadingRow),
    destinationMappings: [],
    modalSubmitLabel: textFromCell(modalSubmitLabelRow?.firstElementChild || modalSubmitLabelRow),
  };

  // Parse destinationMappings: they are rows after config but before the first card row (which has an image)
  let cardStartIndex = 8;
  for (let i = 8; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) break;

    const hasImage = row.querySelector('picture, img');

    if (hasImage) {
      // This is the first card row
      cardStartIndex = i;
      break;
    }

    // This is a destinationMapping container row with <hr> separators
    const container = row.querySelector('div');
    if (container) {
      const children = [...container.children];
      let idx = 0;
      while (idx < children.length) {
        const child = children[idx];

        if (!child) {
          idx += 1;
          continue;
        }

        // Skip <hr> elements
        if (child.tagName === 'HR') {
          idx += 1;
          continue;
        }

        // Get destination name from current <p>
        const namePara = child.tagName === 'P' ? child : null;
        const destinationName = namePara ? textFromCell(namePara) : '';

        // Get destination link from next <p> with <a>
        let destinationLink = '';
        if (destinationName && idx + 1 < children.length) {
          const linkPara = children[idx + 1];
          if (linkPara && linkPara.tagName === 'P') {
            const link = linkPara.querySelector('a');
            destinationLink = link?.getAttribute('href') || textFromCell(linkPara);
            idx += 1; // Skip the next <p> since we just processed it
          }
        }

        if (destinationName && destinationLink) {
          config.destinationMappings.push({
            location: destinationName,
            url: destinationLink,
          });
        }

        idx += 1;
      }
    }
  }

  return { config, cardStartIndex };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block: Element): Promise<void> {
  block.classList.add('destination-cards-signature');

  const rows = [...block.children] as Element[];

  // Parse block configuration and destination mappings
  const { config, cardStartIndex } = getBlockConfig(rows);

  // Set block attributes
  if (config.testId) {
    block.setAttribute('data-testid', config.testId);
  }

  block.classList.add(`destination-cards-signature--${config.backgroundStyle}`);

  // Hide config and mapping rows (keep them for AEM instrumentation but hide visually)
  for (let i = 0; i < cardStartIndex; i += 1) {
    const row = rows[i];
    if (row) {
      (row as HTMLElement).style.display = 'none';
    }
  }

  // Build intro section
  const intro = buildIntro(config);
  block.prepend(intro);

  // Build carousel/grid
  const carousel = document.createElement('div');
  carousel.className = 'destination-cards-signature-carousel';

  const list = document.createElement('ul');
  list.className = 'destination-cards-signature-list';
  list.setAttribute('data-testid', 'destination-cards-signature-list');

  // Process card rows (starting from cardStartIndex)
  for (let i = cardStartIndex; i < rows.length; i += 1) {
    const row = rows[i];
    if (row && row.querySelector('picture, img')) {
      // Hide the original authored row and build a new card from its content
      (row as HTMLElement).style.display = 'none';
      const card = buildCard(row);
      list.append(card);
      (row as HTMLElement).style.display = 'none';
    }
  }

  carousel.append(list);

  // Add carousel controls if there are more than 2 cards (show on desktop only)
  const cardCount = list.querySelectorAll('.destination-cards-signature-item').length;
  if (cardCount > 2) {
    const controls = createCarouselControls({
      track: list,
      itemSelector: '.destination-cards-signature-item',
      classNames: {
        controls: 'destination-cards-signature-controls',
        control: 'destination-cards-signature-control',
        controlPrev: 'destination-cards-signature-control-prev',
        controlNext: 'destination-cards-signature-control-next',
      },
      labels: {
        track: 'Destination cards carousel',
        previous: 'Previous card',
        next: 'Next card',
      },
    });
    carousel.prepend(controls);
  }

  block.append(carousel);

  // Build and setup modal
  const modal = buildModal(config);
  block.append(modal);
  setupModalHandlers(block, modal);
}
