import { moveInstrumentation } from '../../scripts/scripts.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const CARD_W = 200;
const GAP = 80;
const ANIM_DURATION = 500;

// ── Tween helpers ─────────────────────────────────────────────────────────────
function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

function evalTween(tw, now) {
  const t = Math.min(1, (now - tw.start) / ANIM_DURATION);
  return { value: tw.from + (tw.to - tw.from) * easeOut(t), done: t >= 1 };
}

// ── Carousel engine ───────────────────────────────────────────────────────────
function initCarousel(slider, track, cards, prevBtn, nextBtn, dragCursor, stride) {
  const N = cards.length;
  if (N === 0) return;

  let cardsPerView = 1;
  let vIdx = 0;
  let trackX = 0;
  let trackTween = null;
  let isDragging = false;
  let dragMoved = false;
  let startX = 0;
  let dragStartTrackX = 0;
  let rafId = 0;

  function maxIdx() {
    return Math.max(0, N - cardsPerView);
  }

  function computeTargetX(idx) {
    return -(idx * stride);
  }

  function applyTrack() {
    track.style.transform = `translateX(${trackX}px)`;
  }

  function updateArrows() {
    prevBtn.disabled = vIdx <= 0;
    nextBtn.disabled = vIdx >= maxIdx();

    const noScroll = N <= cardsPerView;
    slider.classList.toggle('cc-no-scroll', noScroll);
  }

  function recalcCardsPerView() {
    cardsPerView = Math.max(1, Math.floor((slider.offsetWidth + GAP) / stride));
  }

  function tick(now) {
    if (!trackTween) {
      rafId = 0;
      return;
    }
    const { value, done } = evalTween(trackTween, now);
    trackX = value;
    applyTrack();
    if (done) {
      trackTween = null;
      rafId = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function startRAF() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function go(idx, animated = true) {
    vIdx = Math.max(0, Math.min(idx, maxIdx()));

    const atEnd = vIdx >= maxIdx() && N > cardsPerView;
    const targetX = atEnd ? slider.offsetWidth - (N * stride - GAP) : computeTargetX(vIdx);

    if (!animated) {
      trackX = targetX;
      trackTween = null;
      applyTrack();
      updateArrows();
      return;
    }

    trackTween = { from: trackX, to: targetX, start: performance.now() };
    startRAF();
    updateArrows();
  }

  function snapToNearest() {
    const nearest = Math.round(-trackX / stride);
    go(nearest);
  }

  slider.addEventListener('pointerdown', (e) => {
    if (N <= cardsPerView) return;
    isDragging = true;
    dragMoved = false;
    startX = e.clientX;
    dragStartTrackX = trackX;
    trackTween = null;
    slider.setPointerCapture(e.pointerId);
  });

  slider.addEventListener('pointermove', (e) => {
    dragCursor.style.left = `${e.clientX}px`;
    dragCursor.style.top = `${e.clientY}px`;

    if (!isDragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) dragMoved = true;
    trackX = dragStartTrackX + dx;
    applyTrack();
  });

  slider.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    slider.releasePointerCapture(e.pointerId);
    snapToNearest();
  });

  slider.addEventListener('pointercancel', (e) => {
    if (!isDragging) return;
    isDragging = false;
    slider.releasePointerCapture(e.pointerId);
    go(vIdx);
  });

  slider.addEventListener(
    'click',
    (e) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  prevBtn.addEventListener('click', () => go(vIdx - 1));
  nextBtn.addEventListener('click', () => go(vIdx + 1));

  slider.addEventListener('pointerenter', () => {
    if (N > cardsPerView) dragCursor.classList.add('cc-drag-cursor--visible');
  });
  slider.addEventListener('pointerleave', () => {
    dragCursor.classList.remove('cc-drag-cursor--visible');
  });

  const ro = new ResizeObserver(() => {
    recalcCardsPerView();
    vIdx = Math.min(vIdx, maxIdx());
    go(vIdx, false);
  });
  ro.observe(slider);

  recalcCardsPerView();
  trackX = computeTargetX(vIdx);
  applyTrack();
  updateArrows();
}

// ── Block decorator ───────────────────────────────────────────────────────────
export default async function decorate(block) {
  const stride = CARD_W + GAP;

  // Build slider structure
  const sliderWrapper = document.createElement('div');
  sliderWrapper.className = 'cc-slider-wrapper';

  const slider = document.createElement('div');
  slider.className = 'cc-slider';

  const track = document.createElement('ul');
  track.className = 'cc-track';

  const cards = [];

  // ── Title row ────────────────────────────────────────────────────────────────
  const allRows = [...block.children];
  const titleRow = allRows[0];
  const blockTitle = document.createElement('h2');
  blockTitle.className = 'cc-block-title';
  blockTitle.textContent = titleRow?.textContent?.trim() ?? '';
  const itemRows = allRows.slice(1);

  itemRows.forEach((row) => {
    const cells = [...row.children];

    // 4 cells: cell[0]=picture, cell[1]=alt, cell[2]=title, cell[3]=body
    // 3 cells: cell[0]=picture, cell[1]=title, cell[2]=body
    const has4 = cells.length >= 4;
    const pictureEl = cells[0]?.querySelector('picture');
    const altText = has4 ? cells[1]?.textContent?.trim() ?? '' : '';
    const title = has4 ? cells[2]?.textContent?.trim() ?? '' : cells[1]?.textContent?.trim() ?? '';
    const contentCells = has4 ? cells.slice(3) : cells.slice(2);

    const li = document.createElement('li');
    li.className = 'cc-card-wrapper ac-card-wrapper';
    moveInstrumentation(row, li);

    const cardEl = document.createElement('div');
    cardEl.className = 'cc-card';

    // Card image — apply alt text if provided
    const imageDiv = document.createElement('div');
    imageDiv.className = 'cc-card-image ac-card-image';
    if (pictureEl) {
      const cloned = pictureEl.cloneNode(true);
      if (altText) {
        const img = cloned.querySelector('img');
        if (img) img.alt = altText;
      }
      imageDiv.append(cloned);
    }

    // Card body
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'cc-card-body ac-card-body';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    bodyDiv.append(h3);

    contentCells.forEach((cell, i) => {
      const hasContent = cell.children.length > 0 || cell.textContent?.trim();
      if (!hasContent) return;

      if (i === 0) {
        const hr = document.createElement('hr');
        hr.className = 'cc-card-divider';
        bodyDiv.append(hr);
      }

      // Clone rich HTML (preserves <p>, <strong>, etc.)
      const wrapper = document.createElement('div');
      wrapper.className = 'ac-card-body-section';
      [...cell.childNodes].forEach((node) => wrapper.append(node.cloneNode(true)));
      bodyDiv.append(wrapper);
    });

    cardEl.append(imageDiv, bodyDiv);
    li.append(cardEl);
    track.append(li);
    cards.push(li);
  });

  slider.append(track);
  sliderWrapper.append(slider);

  // Dummy off-DOM buttons (arrows not shown in this block)
  const prevBtn = document.createElement('button');
  const nextBtn = document.createElement('button');

  // Drag cursor
  const dragCursor = document.createElement('div');
  dragCursor.className = 'cc-drag-cursor';

  const dragInner = document.createElement('div');
  dragInner.className = 'cc-drag-inner';
  dragInner.innerHTML = '<span class="cc-drag-arrow cc-drag-arrow--left">&#9664;</span><span class="cc-drag-circle">Drag</span><span class="cc-drag-arrow cc-drag-arrow--right">&#9654;</span>';
  dragCursor.append(dragInner);

  block.replaceChildren(blockTitle, sliderWrapper, dragCursor);

  initCarousel(slider, track, cards, prevBtn, nextBtn, dragCursor, stride);
}
