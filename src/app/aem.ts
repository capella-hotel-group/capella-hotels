/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

interface RumData {
  source?: string;
  target?: unknown;
  [key: string]: unknown;
}

interface SampleRUMFn {
  (checkpoint?: string, data?: RumData): void;
  enhance?: () => void;
  enhancerContext?: { enhancerVersion?: string; enhancerHash?: string };
  baseURL?: URL;
  collectBaseURL?: URL;
  sendPing?: (ck: string, time: number, pingData?: RumData) => void;
}

declare global {
  interface Window {
    hlx: {
      rum?: {
        weight: number;
        id: string;
        isSelected: boolean;
        firstReadTime: number;
        sampleRUM: SampleRUMFn;
        queue: unknown[];
        collector: (...args: unknown[]) => number;
      };
      RUM_MASK_URL?: string;
      RUM_MANUAL_ENHANCE?: boolean;
      codeBasePath: string;
      lighthouse?: boolean;
    };
    SAMPLE_PAGEVIEWS_AT_RATE?: string;
    RUM_BASE?: string;
    RUM_PARAMS?: string;
  }
}

const sampleRUM: SampleRUMFn = (checkpoint, data) => {
  const timeShift = () =>
    window.performance ? window.performance.now() : Date.now() - (window.hlx.rum?.firstReadTime ?? 0);
  try {
    window.hlx = window.hlx || ({} as Window['hlx']);
    if (!window.hlx.rum || !window.hlx.rum.collector) {
      sampleRUM.enhance = () => {};
      const params = new URLSearchParams(window.location.search);
      const { currentScript } = document;
      const rate =
        params.get('rum') ||
        window.SAMPLE_PAGEVIEWS_AT_RATE ||
        params.get('optel') ||
        (currentScript as HTMLScriptElement)?.dataset.rate;
      const rateValue = (
        {
          on: 1,
          off: 0,
          high: 10,
          low: 1000,
        } as Record<string, number>
      )[rate ?? ''];
      const weight = rateValue !== undefined ? rateValue : 100;
      const id = window.hlx.rum?.id || crypto.randomUUID().slice(-9);
      const isSelected = window.hlx.rum?.isSelected || (weight > 0 && Math.random() * weight < 1);

      window.hlx.rum = {
        weight,
        id,
        isSelected,
        firstReadTime: window.performance ? window.performance.timeOrigin : Date.now(),
        sampleRUM,
        queue: [],
        collector: (...args: unknown[]) => window.hlx.rum!.queue.push(args),
      };
      if (isSelected) {
        const dataFromErrorObj = (error: Error) => {
          const errData: RumData = { source: 'undefined error' };
          try {
            errData.target = error.toString();
            if (error.stack) {
              errData.source = error.stack
                .split('\n')
                .filter((line) => line.match(/https?:\/\//))
                .shift()
                ?.replace(/at ([^ ]+) \((.+)\)/, '$1@$2')
                .replace(/ at /, '@')
                .trim();
            }
          } catch (err) {
            /* error structure was not as expected */
          }
          return errData;
        };

        window.addEventListener('error', ({ error }) => {
          const errData = dataFromErrorObj(error);
          sampleRUM('error', errData);
        });

        window.addEventListener('unhandledrejection', ({ reason }) => {
          let errData: RumData = {
            source: 'Unhandled Rejection',
            target: reason || 'Unknown',
          };
          if (reason instanceof Error) {
            errData = dataFromErrorObj(reason);
          }
          sampleRUM('error', errData);
        });

        window.addEventListener('securitypolicyviolation', (e) => {
          if (e.blockedURI.includes('helix-rum-enhancer') && e.disposition === 'enforce') {
            const errData: RumData = {
              source: 'csp',
              target: e.blockedURI,
            };
            sampleRUM.sendPing?.('error', timeShift(), errData);
          }
        });

        sampleRUM.baseURL = sampleRUM.baseURL || new URL(window.RUM_BASE || '/', new URL('https://ot.aem.live'));
        sampleRUM.collectBaseURL = sampleRUM.collectBaseURL || sampleRUM.baseURL;
        sampleRUM.sendPing = (ck: string, time: number, pingData: RumData = {}) => {
          const rumData = JSON.stringify({
            weight,
            id,
            referer: window.location.href,
            checkpoint: ck,
            t: time,
            ...pingData,
          });
          const urlParams = window.RUM_PARAMS ? new URLSearchParams(window.RUM_PARAMS).toString() || '' : '';
          const { href: url, origin } = new URL(
            `.rum/${weight}${urlParams ? `?${urlParams}` : ''}`,
            sampleRUM.collectBaseURL,
          );
          const body = origin === window.location.origin ? new Blob([rumData], { type: 'application/json' }) : rumData;
          navigator.sendBeacon(url, body);

          console.debug(`ping:${ck}`, pingData);
        };
        sampleRUM.sendPing('top', timeShift());

        sampleRUM.enhance = () => {
          // only enhance once
          if (document.querySelector('script[src*="rum-enhancer"]')) return;
          const { enhancerVersion, enhancerHash } = sampleRUM.enhancerContext || {};
          const script = document.createElement('script');
          if (enhancerHash) {
            script.integrity = enhancerHash;
            script.setAttribute('crossorigin', 'anonymous');
          }
          script.src = new URL(
            `.rum/@adobe/helix-rum-enhancer@${enhancerVersion || '^2'}/src/index.js`,
            sampleRUM.baseURL,
          ).href;
          document.head.appendChild(script);
        };
        if (!window.hlx.RUM_MANUAL_ENHANCE) {
          sampleRUM.enhance();
        }
      }
    }
    if (window.hlx.rum && window.hlx.rum.isSelected && checkpoint) {
      window.hlx.rum.collector(checkpoint, data, timeShift());
    }
    document.dispatchEvent(new CustomEvent('rum', { detail: { checkpoint, data } }));
  } catch (error) {
    // something went awry
  }
};

/**
 * Setup block utils.
 */
function setup() {
  window.hlx = window.hlx || ({} as Window['hlx']);
  window.hlx.RUM_MASK_URL = 'full';
  window.hlx.RUM_MANUAL_ENHANCE = true;
  window.hlx.codeBasePath = '';
  window.hlx.lighthouse = new URLSearchParams(window.location.search).get('lighthouse') === 'on';

  const scriptEl = document.querySelector<HTMLScriptElement>('script[src$="/scripts/scripts.js"]');
  if (scriptEl) {
    try {
      const scriptURL = new URL(scriptEl.src, window.location.href);
      if (scriptURL.host === window.location.host) {
        window.hlx.codeBasePath = scriptURL.pathname.split('/scripts/scripts.js')[0] ?? '';
      } else {
        window.hlx.codeBasePath = scriptURL.href.split('/scripts/scripts.js')[0] ?? '';
      }
    } catch (error) {
      console.log(error);
    }
  }
}

/**
 * Auto initialization.
 */
function init() {
  setup();
  sampleRUM.collectBaseURL = window.origin as unknown as URL;
  sampleRUM();
}

/**
 * Sanitizes a string for use as class name.
 * @param {string} name The unsanitized string
 * @returns {string} The class name
 */
function toClassName(name: string): string {
  return typeof name === 'string'
    ? name
        .toLowerCase()
        .replace(/[^0-9a-z]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    : '';
}

/**
 * Sanitizes a string for use as a js property name.
 * @param {string} name The unsanitized string
 * @returns {string} The camelCased name
 */
function toCamelCase(name: string): string {
  return toClassName(name).replace(/-([a-z])/g, (g) => (g[1] ?? '').toUpperCase());
}

/**
 * Extracts the config from a block.
 * @param {Element} block The block element
 * @returns {object} The block config
 */
function readBlockConfig(block: Element): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    if (row.children) {
      const cols = [...row.children];
      if (cols[1]) {
        const col = cols[1];
        const name = toClassName(cols[0]?.textContent ?? '');
        let value: unknown = '';
        if (col.querySelector('a')) {
          const as = [...col.querySelectorAll('a')];
          if (as.length === 1) {
            value = as[0]!.href;
          } else {
            value = as.map((a) => a.href);
          }
        } else if (col.querySelector('img')) {
          const imgs = [...col.querySelectorAll('img')];
          if (imgs.length === 1) {
            value = imgs[0]!.src;
          } else {
            value = imgs.map((img) => img.src);
          }
        } else if (col.querySelector('p')) {
          const ps = [...col.querySelectorAll('p')];
          if (ps.length === 1) {
            value = ps[0]!.textContent;
          } else {
            value = ps.map((p) => p.textContent);
          }
        } else value = row.children[1]?.textContent;
        config[name] = value;
      }
    }
  });
  return config;
}

/**
 * Loads a CSS file.
 * @param {string} href URL to the CSS file
 */
async function loadCSS(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = reject;
      document.head.append(link);
    } else {
      resolve();
    }
  });
}

/**
 * Loads a non module JS file.
 * @param {string} src URL to the JS file
 * @param {Object} attrs additional optional attributes
 */
async function loadScript(src: string, attrs?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.src = src;
      if (attrs) {
        Object.entries(attrs).forEach(([attr, val]) => script.setAttribute(attr, val));
      }
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.append(script);
    } else {
      resolve();
    }
  });
}

/**
 * Retrieves the content of metadata tags.
 * @param {string} name The metadata name (or property)
 * @param {Document} doc Document object to query for metadata. Defaults to the window's document
 * @returns {string} The metadata value(s)
 */
function getMetadata(name: string, doc: Document = document): string {
  const attr = name && name.includes(':') ? 'property' : 'name';
  const meta = [...doc.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${name}"]`)]
    .map((m) => m.content)
    .join(', ');
  return meta || '';
}

interface PictureBreakpoint {
  media?: string;
  width: string;
}

/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {string} [alt] The image alternative text
 * @param {boolean} [eager] Set loading attribute to eager
 * @param {Array} [breakpoints] Breakpoints and corresponding params (eg. width)
 * @returns {Element} The picture element
 */
function createOptimizedPicture(
  src: string,
  alt = '',
  eager = false,
  breakpoints: PictureBreakpoint[] = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
): HTMLPictureElement {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${pathname}?width=${br.width}&format=webply&optimize=medium`);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
    }
  });

  return picture;
}

/**
 * Set template (page structure) and theme (page styles).
 */
function decorateTemplateAndTheme(): void {
  const addClasses = (element: Element, classes: string) => {
    classes.split(',').forEach((c) => {
      element.classList.add(toClassName(c.trim()));
    });
  };
  const template = getMetadata('template');
  if (template) addClasses(document.body, template);
  const theme = getMetadata('theme');
  if (theme) addClasses(document.body, theme);
}

/**
 * Wrap inline text content of block cells within a <p> tag.
 * @param {Element} block the block element
 */
function wrapTextNodes(block: Element): void {
  const validWrappers = ['P', 'PRE', 'UL', 'OL', 'PICTURE', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR'];

  const wrap = (el: Element) => {
    const wrapper = document.createElement('p');
    wrapper.append(...el.childNodes);
    [...el.attributes]
      // move the instrumentation from the cell to the new paragraph, also keep the class
      // in case the content is a buttton and the cell the button-container
      .filter(
        ({ nodeName }) =>
          nodeName === 'class' || nodeName.startsWith('data-aue') || nodeName.startsWith('data-richtext'),
      )
      .forEach(({ nodeName, nodeValue }) => {
        wrapper.setAttribute(nodeName, nodeValue ?? '');
        el.removeAttribute(nodeName);
      });
    el.append(wrapper);
  };

  block.querySelectorAll(':scope > div > div').forEach((blockColumn) => {
    if (blockColumn.hasChildNodes()) {
      const hasWrapper =
        !!blockColumn.firstElementChild &&
        validWrappers.some((tagName) => blockColumn.firstElementChild?.tagName === tagName);
      if (!hasWrapper) {
        wrap(blockColumn);
      } else if (
        blockColumn.firstElementChild?.tagName === 'PICTURE' &&
        (blockColumn.children.length > 1 || !!blockColumn.textContent?.trim())
      ) {
        wrap(blockColumn);
      }
    }
  });
}

/**
 * Decorates paragraphs containing a single link as buttons.
 * @param {Element} element container element
 */
function decorateButtons(element: Element): void {
  element.querySelectorAll('a').forEach((a) => {
    a.title = a.title || a.textContent || '';
    if (a.href !== a.textContent) {
      const up = a.parentElement;
      const twoup = a.parentElement?.parentElement;
      if (up && twoup && !a.querySelector('img')) {
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          a.className = 'button'; // default
          up.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1 &&
          up.tagName === 'STRONG' &&
          twoup.childNodes.length === 1 &&
          twoup.tagName === 'P'
        ) {
          a.className = 'button primary';
          twoup.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1 &&
          up.tagName === 'EM' &&
          twoup.childNodes.length === 1 &&
          twoup.tagName === 'P'
        ) {
          a.className = 'button secondary';
          twoup.classList.add('button-container');
        }
      }
    }
  });
}

/**
 * Add <img> for icon, prefixed with codeBasePath and optional prefix.
 * @param {Element} [span] span element with icon classes
 * @param {string} [prefix] prefix to be added to icon src
 * @param {string} [alt] alt text to be added to icon
 */
function decorateIcon(span: HTMLElement, prefix = '', alt = ''): void {
  const iconName = Array.from(span.classList)
    .find((c) => c.startsWith('icon-'))
    ?.substring(5);
  const img = document.createElement('img');
  img.dataset.iconName = iconName;
  img.src = `${window.hlx.codeBasePath}${prefix}/icons/${iconName}.svg`;
  img.alt = alt;
  img.loading = 'lazy';
  img.width = 16;
  img.height = 16;
  span.append(img);
}

/**
 * Add <img> for icons, prefixed with codeBasePath and optional prefix.
 * @param {Element} [element] Element containing icons
 * @param {string} [prefix] prefix to be added to icon the src
 */
function decorateIcons(element: Element, prefix = ''): void {
  const icons = element.querySelectorAll<HTMLElement>('span.icon');
  icons.forEach((span) => {
    decorateIcon(span, prefix);
  });
}

/**
 * Decorates all sections in a container element.
 * @param {Element} main The container element
 */
function decorateSections(main: Element): void {
  main.querySelectorAll(':scope > div:not([data-section-status])').forEach((section) => {
    const wrappers: HTMLDivElement[] = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if ((e.tagName === 'DIV' && e.className) || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV' || !e.className;
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1]?.append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    (section as HTMLElement).dataset.sectionStatus = 'initialized';
    (section as HTMLElement).style.display = 'none';

    // Process section metadata
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      Object.keys(meta).forEach((key) => {
        if (key === 'style') {
          const styles = String(meta.style)
            .split(',')
            .filter((style) => style)
            .map((style) => toClassName(style.trim()));
          styles.forEach((style) => section.classList.add(style));
        } else {
          (section as HTMLElement).dataset[toCamelCase(key)] = String(meta[key]);
        }
      });
      sectionMeta.parentNode?.removeChild(sectionMeta);
    }
  });
}

type BlockCellValue = string | Element | undefined;
type BlockCell = BlockCellValue | { elems: BlockCellValue[] };
type BlockContent = BlockCell[][] | string | Record<string, unknown>;

/**
 * Builds a block DOM Element from a two dimensional array, string, or object
 * @param {string} blockName name of the block
 * @param {*} content two dimensional array or string or object of content
 */
function buildBlock(blockName: string, content: BlockContent): HTMLDivElement {
  const table: BlockCell[][] = Array.isArray(content) ? content : [[content as BlockCell]];
  const blockEl = document.createElement('div');
  // build image block nested div structure
  blockEl.classList.add(blockName);
  table.forEach((row) => {
    const rowEl = document.createElement('div');
    row.forEach((col) => {
      const colEl = document.createElement('div');
      const vals = col && typeof col === 'object' && 'elems' in col ? col.elems : [col];
      vals.forEach((val) => {
        if (val) {
          if (typeof val === 'string') {
            colEl.innerHTML += val;
          } else {
            colEl.appendChild(val);
          }
        }
      });
      rowEl.appendChild(colEl);
    });
    blockEl.appendChild(rowEl);
  });
  return blockEl;
}

/**
 * Loads JS and CSS for a block.
 * @param {Element} block The block element
 */
async function loadBlock(block: HTMLElement): Promise<HTMLElement> {
  const status = block.dataset.blockStatus;
  if (status !== 'loading' && status !== 'loaded') {
    block.dataset.blockStatus = 'loading';
    const { blockName } = block.dataset;
    try {
      const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`);
      const decorationComplete = new Promise<void>((resolve) => {
        (async () => {
          try {
            const mod = await import(
              /* @vite-ignore */
              `${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.js`
            );
            if (mod.default) {
              await mod.default(block);
            }
          } catch (error) {
            console.error(`failed to load module for ${blockName}`, error);
          }
          resolve();
        })();
      });
      await Promise.all([cssLoaded, decorationComplete]);
    } catch (error) {
      console.error(`failed to load block ${blockName}`, error);
    }
    block.dataset.blockStatus = 'loaded';
  }
  return block;
}

/**
 * Decorates a block.
 * @param {Element} block The block element
 */
function decorateBlock(block: HTMLElement): void {
  const shortBlockName = block.classList[0];
  if (shortBlockName && !block.dataset.blockStatus) {
    block.classList.add('block');
    block.dataset.blockName = shortBlockName;
    block.dataset.blockStatus = 'initialized';
    wrapTextNodes(block);
    const blockWrapper = block.parentElement;
    blockWrapper?.classList.add(`${shortBlockName}-wrapper`);
    const section = block.closest('.section');
    if (section) section.classList.add(`${shortBlockName}-container`);
    decorateButtons(block);
  }
}

/**
 * Decorates all blocks in a container element.
 * @param {Element} main The container element
 */
function decorateBlocks(main: Element): void {
  main.querySelectorAll<HTMLElement>('div.section > div > div').forEach(decorateBlock);
}

/**
 * Loads a block named 'header' into header
 * @param {Element} header header element
 * @returns {Promise}
 */
async function loadHeader(header: HTMLElement): Promise<HTMLElement> {
  const headerBlock = buildBlock('header', '');
  header.append(headerBlock);
  decorateBlock(headerBlock);
  return loadBlock(headerBlock);
}

/**
 * Loads a block named 'footer' into footer
 * @param footer footer element
 * @returns {Promise}
 */
async function loadFooter(footer: HTMLElement): Promise<HTMLElement> {
  const footerBlock = buildBlock('footer', '');
  footer.append(footerBlock);
  decorateBlock(footerBlock);
  return loadBlock(footerBlock);
}

/**
 * Wait for Image.
 * @param {Element} section section element
 */
async function waitForFirstImage(section: Element): Promise<void> {
  const lcpCandidate = section.querySelector<HTMLImageElement>('img');
  await new Promise<void>((resolve) => {
    if (lcpCandidate && !lcpCandidate.complete) {
      lcpCandidate.setAttribute('loading', 'eager');
      lcpCandidate.addEventListener('load', () => resolve());
      lcpCandidate.addEventListener('error', () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * Loads all blocks in a section.
 * @param {Element} section The section element
 */
async function loadSection(
  section: HTMLElement,
  loadCallback?: (sectionEl: HTMLElement) => Promise<void>,
): Promise<void> {
  const status = section.dataset.sectionStatus;
  if (!status || status === 'initialized') {
    section.dataset.sectionStatus = 'loading';
    const blocks = [...section.querySelectorAll<HTMLElement>('div.block')];
    for (let i = 0; i < blocks.length; i += 1) {
      await loadBlock(blocks[i]!);
    }
    if (loadCallback) await loadCallback(section);
    section.dataset.sectionStatus = 'loaded';
    section.style.display = '';
  }
}

/**
 * Loads all sections.
 * @param {Element} element The parent element of sections to load
 */
async function loadSections(element: Element): Promise<void> {
  const sections = [...element.querySelectorAll<HTMLElement>('div.section')];
  for (let i = 0; i < sections.length; i += 1) {
    await loadSection(sections[i]!);
    if (i === 0 && sampleRUM.enhance) {
      sampleRUM.enhance();
    }
  }
}

init();

export {
  buildBlock,
  createOptimizedPicture,
  decorateBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
  getMetadata,
  loadBlock,
  loadCSS,
  loadFooter,
  loadHeader,
  loadScript,
  loadSection,
  loadSections,
  readBlockConfig,
  sampleRUM,
  setup,
  toCamelCase,
  toClassName,
  waitForFirstImage,
  wrapTextNodes,
};
