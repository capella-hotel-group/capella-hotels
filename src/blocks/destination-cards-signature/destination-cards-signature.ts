import { moveInstrumentation } from '@/app/scripts.js';

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

  return {
    image: cells[0]?.querySelector('picture, img'),
    imageAlt: cells[1]?.textContent?.trim() || '',
    darkOverlay: isEnabled(cells[2]),
    title: textFromCell(cells[3]),
    description: textFromCell(cells[4]),
    ctaLabel: textFromCell(cells[5]),
    ctaActionMode: textFromCell(cells[6]),
    ctaLink: cells[7]?.querySelector('a')?.getAttribute('href') || textFromCell(cells[7]),
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
    const cta = document.createElement('button');
    cta.className = 'destination-cards-signature-cta';
    cta.setAttribute('data-testid', 'destination-cards-signature-cta');
    cta.textContent = fields.ctaLabel;
    cta.setAttribute('data-cta-action-mode', fields.ctaActionMode);
    if (fields.ctaLink) {
      cta.setAttribute('data-cta-link', fields.ctaLink);
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

  // Modal header
  const header = document.createElement('div');
  header.className = 'destination-cards-signature-modal-header';

  const title = document.createElement('h2');
  title.className = 'destination-cards-signature-modal-title';
  title.textContent = config.modalHeading || 'Choose destination';
  header.append(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'destination-cards-signature-modal-close';
  closeBtn.setAttribute('data-testid', 'destination-cards-signature-modal-close');
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.innerHTML = '✕';
  header.append(closeBtn);

  dialog.append(header);

  // Destination list
  const listContainer = document.createElement('div');
  listContainer.className = 'destination-cards-signature-modal-content';

  const list = document.createElement('ul');
  list.className = 'destination-cards-signature-destination-list';
  list.setAttribute('data-testid', 'destination-cards-signature-destination-list');

  config.destinationMappings.forEach((mapping, index) => {
    const item = document.createElement('li');
    item.className = 'destination-cards-signature-destination-item';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'destination';
    radio.value = mapping.url;
    radio.id = `destination-${index}`;
    radio.setAttribute('data-testid', `destination-cards-signature-destination-${index}`);

    const label = document.createElement('label');
    label.htmlFor = `destination-${index}`;
    label.textContent = mapping.location;

    item.append(radio, label);
    list.append(item);
  });

  listContainer.append(list);
  dialog.append(listContainer);

  // Modal footer with submit button
  const footer = document.createElement('div');
  footer.className = 'destination-cards-signature-modal-footer';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'destination-cards-signature-modal-submit';
  submitBtn.setAttribute('data-testid', 'destination-cards-signature-modal-submit');
  submitBtn.textContent = config.modalSubmitLabel || 'GO TO DESTINATION';

  footer.append(submitBtn);
  dialog.append(footer);

  modal.append(dialog);

  return modal;
}

function setupModalHandlers(block: Element, modal: HTMLElement): void {
  const dialog = modal.querySelector('dialog') as HTMLDialogElement;
  const closeBtn = modal.querySelector('.destination-cards-signature-modal-close') as HTMLButtonElement;
  const submitBtn = modal.querySelector('.destination-cards-signature-modal-submit') as HTMLButtonElement;
  const backdrop = modal.querySelector('.destination-cards-signature-modal-wrapper') as HTMLElement;

  const ctaButtons = block.querySelectorAll('.destination-cards-signature-cta');

  const openModal = () => {
    if (dialog.showModal) {
      dialog.showModal();
    } else {
      dialog.style.display = 'block';
    }
  };

  const closeModal = () => {
    if (dialog.close) {
      dialog.close();
    } else {
      dialog.style.display = 'none';
    }
  };

  ctaButtons.forEach((btn: Element) => {
    btn.addEventListener('click', (e: Event) => {
      const ctaBtn = btn as HTMLButtonElement;
      const actionMode = ctaBtn.getAttribute('data-cta-action-mode');

      if (actionMode === 'direct-url') {
        const url = ctaBtn.getAttribute('data-cta-link');
        if (url) {
          window.location.href = url;
        }
      } else {
        openModal();
      }
      e.preventDefault();
    });
  });

  closeBtn.addEventListener('click', closeModal);

  backdrop.addEventListener('click', (e: Event) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  submitBtn.addEventListener('click', () => {
    const selectedRadio = modal.querySelector('input[name="destination"]:checked') as HTMLInputElement;
    if (selectedRadio) {
      window.location.href = selectedRadio.value;
    }
  });

  dialog.addEventListener('cancel', closeModal);
}

function getBlockConfig(rows: Element[]): BlockConfig {
  const [idRow, testIdRow, eyebrowRow, titleRow, descriptionRow, bgStyleRow, modalHeadingRow, modalSubmitLabelRow] =
    rows.slice(0, 8);

  return {
    id: textFromCell(idRow?.firstElementChild || idRow),
    testId: textFromCell(testIdRow?.firstElementChild || testIdRow),
    eyebrow: textFromCell(eyebrowRow?.firstElementChild || eyebrowRow),
    title: textFromCell(titleRow?.firstElementChild || titleRow),
    description: textFromCell(descriptionRow?.firstElementChild || descriptionRow),
    backgroundStyle: textFromCell(bgStyleRow?.firstElementChild || bgStyleRow) || 'signature-warm',
    modalHeading: textFromCell(modalHeadingRow?.firstElementChild || modalHeadingRow),
    destinationMappings: [], // TODO: Parse repeatable mappings
    modalSubmitLabel: textFromCell(modalSubmitLabelRow?.firstElementChild || modalSubmitLabelRow),
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block: Element): Promise<void> {
  block.classList.add('destination-cards-signature');

  const rows = [...block.children] as Element[];

  // Parse block configuration (first 8 rows)
  const config = getBlockConfig(rows);

  // Parse card rows (remaining rows)
  const cardRows = rows.slice(8);

  // Set block attributes
  if (config.testId) {
    block.setAttribute('data-testid', config.testId);
  }

  block.classList.add(`destination-cards-signature--${config.backgroundStyle}`);

  // Build intro section
  const intro = buildIntro(config);
  block.prepend(intro);

  // Build carousel/grid
  const carousel = document.createElement('div');
  carousel.className = 'destination-cards-signature-carousel';

  const list = document.createElement('ul');
  list.className = 'destination-cards-signature-list';
  list.setAttribute('data-testid', 'destination-cards-signature-list');

  cardRows.forEach((row) => {
    if (row.querySelector('picture, img')) {
      const card = buildCard(row);
      list.append(card);
      row.remove();
    }
  });

  carousel.append(list);
  block.append(carousel);

  // Build and setup modal
  const modal = buildModal(config);
  block.append(modal);
  setupModalHandlers(block, modal);
}
