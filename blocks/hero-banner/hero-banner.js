import { resolveDAMUrl } from '../../scripts/env.js';

// Rows (authored): 0=media type, 1=mediaAsset, 2=mediaAssetMobile, 3=ctaLabel, 4=content

// ─── Breakpoint singleton ─────────────────────────────────────────────────────
const mqMobile = window.matchMedia('(max-width: 599px)');

function pickSrc(desktopSrc, mobileSrc) {
  return mqMobile.matches && mobileSrc ? mobileSrc : desktopSrc;
}

// ─── Background video ─────────────────────────────────────────────────────────
function buildBgVideo(desktopSrc, mobileSrc) {
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.setAttribute('playsinline', '');
  video.className = 'hero-banner-video';

  const source = document.createElement('source');
  source.type = 'video/mp4';
  source.src = pickSrc(desktopSrc, mobileSrc);
  video.append(source);

  mqMobile.addEventListener('change', () => {
    const next = pickSrc(desktopSrc, mobileSrc);
    if (source.src !== next) { source.src = next; video.load(); }
  });

  return video;
}

// ─── Modal video ──────────────────────────────────────────────────────────────
function buildModal(desktopSrc, mobileSrc) {
  const overlay = document.createElement('div');
  overlay.className = 'hero-banner-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'hero-banner-modal-inner';

  const modalVideo = document.createElement('video');
  modalVideo.controls = true;
  modalVideo.autoplay = true;
  modalVideo.className = 'hero-banner-modal-video';

  const source = document.createElement('source');
  source.src = pickSrc(desktopSrc, mobileSrc);
  source.type = 'video/mp4';
  modalVideo.append(source);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'hero-banner-modal-close';
  closeBtn.setAttribute('aria-label', 'Close video');

  inner.append(closeBtn, modalVideo);
  overlay.append(inner);

  // Mutual reference: close() needs keyHandler ref; assign before registering
  let keyHandler;
  const close = () => {
    modalVideo.pause();
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', keyHandler);
  };
  keyHandler = (e) => { if (e.key === 'Escape') close(); };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', keyHandler);

  return overlay;
}

// ─── Scroll-snap ──────────────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function initScrollSnap(block) {
  let snapTimer = null;
  let isSnapping = false;
  let animFrame = null;

  const cancelSnap = () => {
    clearTimeout(snapTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
    isSnapping = false;
    snapTimer = null;
    animFrame = null;
  };

  const snapTo = (target) => {
    if (isSnapping) return;
    const start = window.scrollY;
    const delta = target - start;
    if (Math.abs(delta) < 2) return;

    isSnapping = true;
    const duration = 400;
    let startTime = null;

    const step = (ts) => {
      if (!isSnapping) return;
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      window.scrollTo(0, start + delta * easeOutCubic(progress));
      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        isSnapping = false;
        animFrame = null;
      }
    };

    animFrame = requestAnimationFrame(step);
  };

  const onScroll = () => {
    const h = block.offsetHeight;
    if (window.scrollY > h) return;
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => snapTo(window.scrollY < h / 2 ? 0 : h), 300);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', cancelSnap, { passive: true });
  window.addEventListener('touchstart', cancelSnap, { passive: true });
  window.addEventListener('keydown', cancelSnap);
}

// ─── Decorate ─────────────────────────────────────────────────────────────────
// Rows: 0=media type, 1=mediaAsset, 2=logo(image)|mediaAssetMobile(video),
//       3=mediaAssetMobile(video), 4=ctaLabel(video), 5=content
export default function decorate(block) {
  const rows = [...block.children];
  const isVideo = rows[0]?.firstElementChild?.textContent?.trim().toLowerCase() === 'video';

  const desktopHref = rows[1]?.querySelector('a')?.getAttribute('href') || '';
  const mobileHref = isVideo ? rows[3]?.querySelector('a')?.getAttribute('href') || '' : '';
  const desktopSrc = isVideo ? resolveDAMUrl(desktopHref) : '';
  const mobileSrc = isVideo ? resolveDAMUrl(mobileHref || desktopHref) : '';

  block.innerHTML = '';

  // Background media
  if (isVideo) {
    const placeholder = document.createElement('div');
    placeholder.className = 'hero-banner-placeholder';

    const bgVideo = buildBgVideo(desktopSrc, mobileSrc);
    bgVideo.addEventListener('loadeddata', () => placeholder.classList.add('hidden'), { once: true });
    if (bgVideo.readyState >= 2) placeholder.classList.add('hidden');

    block.append(placeholder, bgVideo);
  } else {
    const pic = rows[1]?.querySelector('picture');
    if (pic) { pic.className = 'hero-banner-image'; block.append(pic); }
  }

  // Content overlay
  const overlay = document.createElement('div');
  overlay.className = 'hero-banner-overlay';

  // Logo (image variant only)
  if (!isVideo) {
    const logoPic = rows[2]?.querySelector('picture');
    if (logoPic) {
      const logoWrapper = document.createElement('div');
      logoWrapper.className = 'hero-banner-logo';
      logoWrapper.append(logoPic);
      overlay.append(logoWrapper);
    }
  }

  const contentEl = rows[5]?.firstElementChild;
  if (contentEl) {
    // Extract span.icon → scroll indicator; fallback to CSS SVG background if absent
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'hero-banner-scroll-icon';
    iconWrapper.setAttribute('role', 'button');
    iconWrapper.setAttribute('tabindex', '0');
    iconWrapper.setAttribute('aria-label', 'Scroll to next section');
    const scrollIcon = contentEl.querySelector('span.icon');
    if (scrollIcon) iconWrapper.append(scrollIcon);
    overlay.append(iconWrapper);

    const scrollToNext = () => {
      const nextSection = block.closest('.hero-banner-wrapper')?.nextElementSibling
        ?? block.closest('div')?.nextElementSibling;
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: block.offsetHeight, behavior: 'smooth' });
      }
    };
    iconWrapper.addEventListener('click', scrollToNext);
    iconWrapper.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') scrollToNext(); });

    const content = document.createElement('div');
    content.className = 'hero-banner-content';
    const lines = [...contentEl.querySelectorAll('p')]
      .map((p) => p.textContent.trim())
      .filter(Boolean);
    content.innerHTML = lines.join('<br>');
    overlay.append(content);
  }

  // CTA opens modal (video only)
  if (isVideo) {
    const ctaText = rows[4]?.firstElementChild?.textContent?.trim() || '';
    if (ctaText) {
      const cta = document.createElement('button');
      cta.className = 'hero-banner-cta';
      cta.type = 'button';
      cta.textContent = ctaText;
      cta.addEventListener('click', () => {
        document.body.style.overflow = 'hidden';
        document.body.append(buildModal(desktopSrc, mobileSrc));
      });
      overlay.append(cta);
    }
  }

  block.append(overlay);
  initScrollSnap(block);
}
