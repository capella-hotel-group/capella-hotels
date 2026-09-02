import { moveInstrumentation } from '@/app/scripts.js';

interface StoryImage {
  media: Element;
  alt: string;
}

interface StoryLink {
  label: string;
  href: string;
  openInNewTab: boolean;
}

function textFrom(element?: Element | null): string {
  return element?.textContent?.trim() || '';
}

function field(block: Element, name: string): Element | null {
  return block.querySelector(`[data-aue-prop="${name}"]`);
}

function fieldText(block: Element, name: string): string {
  return textFrom(field(block, name));
}

function enabled(value: string): boolean {
  return ['true', 'yes', 'enabled'].includes(value.toLowerCase());
}

function getLink(block: Element, urlName: string, labelName: string, targetName: string): StoryLink | null {
  const urlField = field(block, urlName);
  const href = urlField?.querySelector('a')?.getAttribute('href') || textFrom(urlField);
  const label = fieldText(block, labelName);
  if (!href || !label) return null;
  return { label, href, openInNewTab: enabled(fieldText(block, targetName)) };
}

function getImages(rows: Element[], galleryOnly = false): StoryImage[] {
  const mediaRows = rows.filter(
    (row) =>
      (!galleryOnly ||
        row.matches('[data-aue-model="featured-story-card-item"]') ||
        row.querySelector('[data-aue-prop="galleryMedia"]')) &&
      row.querySelector('picture, img, video'),
  );
  return rows
    .filter((row) => mediaRows.includes(row))
    .slice(0, 3)
    .map((row) => {
      const media = row.querySelector('picture, img, video') as Element;
      return {
        media,
        alt:
          row.querySelector('[data-aue-prop="galleryMediaAlt"]')?.textContent?.trim() ||
          row.querySelector('[data-aue-prop="imageAlt"]')?.textContent?.trim() ||
          media.querySelector('img')?.alt ||
          '',
      };
    });
}

function addLink(container: HTMLElement, link: StoryLink | null): void {
  if (!link) return;
  const anchor = document.createElement('a');
  anchor.className = 'featured-story-card-cta';
  anchor.href = link.href;
  anchor.textContent = link.label;
  if (link.openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  container.append(anchor);
}

function mediaNode(image: StoryImage): HTMLElement {
  const node =
    image.media.tagName.toLowerCase() === 'picture' ? image.media : image.media.closest('picture') || image.media;
  const clone = node.cloneNode(true) as HTMLElement;
  const imageElement = clone.matches('img') ? (clone as HTMLImageElement) : clone.querySelector('img');
  if (imageElement) imageElement.alt = image.alt;
  if (clone.matches('video')) {
    clone.setAttribute('aria-label', image.alt);
    clone.setAttribute('playsinline', '');
    clone.setAttribute('controls', '');
  }
  return clone;
}

function getPrimaryImage(block: Element, rows: Element[]): StoryImage | null {
  const primaryField = field(block, 'primaryMedia');
  const media = primaryField?.querySelector('picture, img, video');
  if (media) {
    return { media, alt: fieldText(block, 'primaryMediaAlt') || media.querySelector('img')?.alt || '' };
  }
  return getImages(rows)[0] || null;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const primaryImage = getPrimaryImage(block, rows);
  const galleryImages = getImages(rows, true);
  if (!primaryImage) return;
  const images = [primaryImage, ...galleryImages.filter((image) => image.media !== primaryImage.media)];

  const root = document.createElement('div');
  root.className = 'featured-story-card-layout';
  const alignment = fieldText(block, 'imageAlignment') || textFrom(rows[0]);
  root.classList.add(alignment === 'right' ? 'image-right' : 'image-left');
  const blockId = fieldText(block, 'id');
  if (blockId) root.id = blockId.replace(/^#/, '');

  const content = document.createElement('div');
  content.className = 'featured-story-card-content';
  const eyebrow = fieldText(block, 'eyebrow');
  if (eyebrow) {
    const eyebrowElement = document.createElement('p');
    eyebrowElement.className = 'featured-story-card-eyebrow';
    eyebrowElement.textContent = eyebrow;
    content.append(eyebrowElement);
  }

  const headline = field(block, 'headline');
  if (headline) {
    const heading = document.createElement('h2');
    heading.className = 'featured-story-card-headline';
    heading.innerHTML = headline.innerHTML;
    content.append(heading);
  }

  const description = field(block, 'description');
  if (description) {
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'featured-story-card-description';
    descriptionElement.innerHTML = description.innerHTML;
    content.append(descriptionElement);
  }

  const ctas = document.createElement('div');
  ctas.className = 'featured-story-card-ctas';
  addLink(ctas, getLink(block, 'primaryCtaUrl', 'primaryCtaLabel', 'primaryCtaOpenInNewTab'));
  addLink(ctas, getLink(block, 'secondaryCtaUrl', 'secondaryCtaLabel', 'secondaryCtaOpenInNewTab'));
  if (ctas.children.length) content.append(ctas);

  const gallery = document.createElement('div');
  gallery.className = 'featured-story-card-gallery';
  const viewport = document.createElement('div');
  viewport.className = 'featured-story-card-viewport';
  const track = document.createElement('div');
  track.className = 'featured-story-card-track';
  galleryImages.forEach((image, index) => {
    const slide = document.createElement('div');
    slide.className = 'featured-story-card-slide';
    slide.append(mediaNode(image));
    slide.dataset.index = String(index);
    track.append(slide);
  });
  viewport.append(track);
  gallery.append(viewport);

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'featured-story-card-control featured-story-card-control-prev';
  previous.setAttribute('aria-label', 'Previous story image');
  previous.innerHTML = '<span aria-hidden="true">&#8249;</span>';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'featured-story-card-control featured-story-card-control-next';
  next.setAttribute('aria-label', 'Next story image');
  next.innerHTML = '<span aria-hidden="true">&#8250;</span>';
  gallery.append(previous, next);

  const thumbnails = document.createElement('div');
  thumbnails.className = 'featured-story-card-thumbnails';
  let activeIndex = 0;
  const update = () => {
    track.style.transform = `translateX(-${activeIndex * 100}%)`;
    [...thumbnails.children].forEach((thumbnail, index) => {
      thumbnail.setAttribute('aria-current', String(index === activeIndex));
    });
  };
  images.forEach((image, index) => {
    const thumbnail = document.createElement('button');
    thumbnail.type = 'button';
    thumbnail.className = 'featured-story-card-thumbnail';
    thumbnail.setAttribute('aria-label', `Show story image ${index + 1}`);
    thumbnail.append(mediaNode(image));
    thumbnail.addEventListener('click', () => {
      activeIndex = index;
      update();
    });
    thumbnails.append(thumbnail);
  });
  gallery.append(thumbnails);

  const move = (direction: number) => {
    activeIndex = (activeIndex + direction + images.length) % images.length;
    update();
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  let startX = 0;
  viewport.addEventListener('pointerdown', (event) => {
    startX = (event as PointerEvent).clientX;
  });
  viewport.addEventListener('pointerup', (event) => {
    const delta = (event as PointerEvent).clientX - startX;
    if (Math.abs(delta) > 40) move(delta < 0 ? 1 : -1);
  });
  update();

  const media = document.createElement('div');
  media.className = 'featured-story-card-media';
  media.append(gallery);
  root.append(media, content);
  moveInstrumentation(block, root);
  block.replaceChildren(root);
}
