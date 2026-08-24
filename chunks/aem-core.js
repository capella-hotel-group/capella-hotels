var e = (function () {
    let e = typeof document < `u` && document.createElement(`link`).relList;
    return e && e.supports && e.supports(`modulepreload`) ? `modulepreload` : `preload`;
  })(),
  t = function (e) {
    return `/` + e;
  },
  n = {},
  r = function (r, i, a) {
    let o = Promise.resolve();
    if (i && i.length > 0) {
      let r = document.getElementsByTagName(`link`),
        s = document.querySelector(`meta[property=csp-nonce]`),
        c = s?.nonce || s?.getAttribute(`nonce`);
      function l(e) {
        return Promise.all(
          e.map((e) =>
            Promise.resolve(e).then(
              (e) => ({ status: `fulfilled`, value: e }),
              (e) => ({ status: `rejected`, reason: e }),
            ),
          ),
        );
      }
      function u(e) {
        return import.meta.resolve ? import.meta.resolve(e) : new URL(e, import.meta.url).href;
      }
      o = l(
        i.map((i) => {
          if (((i = t(i, a)), (i = u(i)), i in n)) return;
          n[i] = !0;
          let o = i.endsWith(`.css`);
          for (let e = r.length - 1; e >= 0; e--) {
            let t = r[e];
            if (t.href === i && (!o || t.rel === `stylesheet`)) return;
          }
          let s = document.createElement(`link`);
          if (
            ((s.rel = o ? `stylesheet` : e),
            o || (s.as = `script`),
            (s.crossOrigin = ``),
            (s.href = i),
            c && s.setAttribute(`nonce`, c),
            document.head.appendChild(s),
            o)
          )
            return new Promise((e, t) => {
              (s.addEventListener(`load`, e),
                s.addEventListener(`error`, () => t(Error(`Unable to preload CSS for ${i}`))));
            });
        }),
      );
    }
    function s(e) {
      let t = new Event(`vite:preloadError`, { cancelable: !0 });
      if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented)) throw e;
    }
    return o.then((e) => {
      for (let t of e || []) t.status === `rejected` && s(t.reason);
      return r().catch(s);
    });
  },
  i = (e, t) => {
    let n = () => (window.performance ? window.performance.now() : Date.now() - (window.hlx.rum?.firstReadTime ?? 0));
    try {
      if (((window.hlx = window.hlx || {}), !window.hlx.rum || !window.hlx.rum.collector)) {
        i.enhance = () => {};
        let e = new URLSearchParams(window.location.search),
          { currentScript: t } = document,
          r = { on: 1, off: 0, high: 10, low: 1e3 }[
            (e.get(`rum`) || window.SAMPLE_PAGEVIEWS_AT_RATE || e.get(`optel`) || t?.dataset.rate) ?? ``
          ],
          a = r === void 0 ? 100 : r,
          o = window.hlx.rum?.id || crypto.randomUUID().slice(-9),
          s = window.hlx.rum?.isSelected || (a > 0 && Math.random() * a < 1);
        if (
          ((window.hlx.rum = {
            weight: a,
            id: o,
            isSelected: s,
            firstReadTime: window.performance ? window.performance.timeOrigin : Date.now(),
            sampleRUM: i,
            queue: [],
            collector: (...e) => window.hlx.rum.queue.push(e),
          }),
          s)
        ) {
          let e = (e) => {
            let t = { source: `undefined error` };
            try {
              ((t.target = e.toString()),
                e.stack &&
                  (t.source = e.stack
                    .split(
                      `
`,
                    )
                    .filter((e) => e.match(/https?:\/\//))
                    .shift()
                    ?.replace(/at ([^ ]+) \((.+)\)/, `$1@$2`)
                    .replace(/ at /, `@`)
                    .trim()));
            } catch {}
            return t;
          };
          (window.addEventListener(`error`, ({ error: t }) => {
            i(`error`, e(t));
          }),
            window.addEventListener(`unhandledrejection`, ({ reason: t }) => {
              let n = { source: `Unhandled Rejection`, target: t || `Unknown` };
              (t instanceof Error && (n = e(t)), i(`error`, n));
            }),
            window.addEventListener(`securitypolicyviolation`, (e) => {
              if (e.blockedURI.includes(`helix-rum-enhancer`) && e.disposition === `enforce`) {
                let t = { source: `csp`, target: e.blockedURI };
                i.sendPing?.(`error`, n(), t);
              }
            }),
            (i.baseURL = i.baseURL || new URL(window.RUM_BASE || `/`, new URL(`https://ot.aem.live`))),
            (i.collectBaseURL = i.collectBaseURL || i.baseURL),
            (i.sendPing = (e, t, n = {}) => {
              let r = JSON.stringify({ weight: a, id: o, referer: window.location.href, checkpoint: e, t, ...n }),
                s = (window.RUM_PARAMS && new URLSearchParams(window.RUM_PARAMS).toString()) || ``,
                { href: c, origin: l } = new URL(`.rum/${a}${s ? `?${s}` : ``}`, i.collectBaseURL),
                u = l === window.location.origin ? new Blob([r], { type: `application/json` }) : r;
              (navigator.sendBeacon(c, u), console.debug(`ping:${e}`, n));
            }),
            i.sendPing(`top`, n()),
            (i.enhance = () => {
              if (document.querySelector(`script[src*="rum-enhancer"]`)) return;
              let { enhancerVersion: e, enhancerHash: t } = i.enhancerContext || {},
                n = document.createElement(`script`);
              (t && ((n.integrity = t), n.setAttribute(`crossorigin`, `anonymous`)),
                (n.src = new URL(`.rum/@adobe/helix-rum-enhancer@${e || `^2`}/src/index.js`, i.baseURL).href),
                document.head.appendChild(n));
            }),
            window.hlx.RUM_MANUAL_ENHANCE || i.enhance());
        }
      }
      (window.hlx.rum && window.hlx.rum.isSelected && e && window.hlx.rum.collector(e, t, n()),
        document.dispatchEvent(new CustomEvent(`rum`, { detail: { checkpoint: e, data: t } })));
    } catch {}
  };
function a() {
  ((window.hlx = window.hlx || {}),
    (window.hlx.RUM_MASK_URL = `full`),
    (window.hlx.RUM_MANUAL_ENHANCE = !0),
    (window.hlx.codeBasePath = ``),
    (window.hlx.lighthouse = new URLSearchParams(window.location.search).get(`lighthouse`) === `on`));
  let e = document.querySelector(`script[src$="/scripts/scripts.js"]`);
  if (e)
    try {
      let t = new URL(e.src, window.location.href);
      t.host === window.location.host
        ? (window.hlx.codeBasePath = t.pathname.split(`/scripts/scripts.js`)[0] ?? ``)
        : (window.hlx.codeBasePath = t.href.split(`/scripts/scripts.js`)[0] ?? ``);
    } catch (e) {
      console.log(e);
    }
}
function o() {
  (a(), (i.collectBaseURL = window.origin), i());
}
function s(e) {
  return typeof e == `string`
    ? e
        .toLowerCase()
        .replace(/[^0-9a-z]/gi, `-`)
        .replace(/-+/g, `-`)
        .replace(/^-|-$/g, ``)
    : ``;
}
function c(e) {
  return s(e).replace(/-([a-z])/g, (e) => (e[1] ?? ``).toUpperCase());
}
function l(e) {
  let t = {};
  return (
    e.querySelectorAll(`:scope > div`).forEach((e) => {
      if (e.children) {
        let n = [...e.children];
        if (n[1]) {
          let r = n[1],
            i = s(n[0]?.textContent ?? ``),
            a = ``;
          if (r.querySelector(`a`)) {
            let e = [...r.querySelectorAll(`a`)];
            a = e.length === 1 ? e[0].href : e.map((e) => e.href);
          } else if (r.querySelector(`img`)) {
            let e = [...r.querySelectorAll(`img`)];
            a = e.length === 1 ? e[0].src : e.map((e) => e.src);
          } else if (r.querySelector(`p`)) {
            let e = [...r.querySelectorAll(`p`)];
            a = e.length === 1 ? e[0].textContent : e.map((e) => e.textContent);
          } else a = e.children[1]?.textContent;
          t[i] = a;
        }
      }
    }),
    t
  );
}
async function u(e) {
  return new Promise((t, n) => {
    if (document.querySelector(`head > link[href="${e}"]`)) t();
    else {
      let r = document.createElement(`link`);
      ((r.rel = `stylesheet`), (r.href = e), (r.onload = () => t()), (r.onerror = n), document.head.append(r));
    }
  });
}
async function d(e, t) {
  return new Promise((n, r) => {
    if (document.querySelector(`head > script[src="${e}"]`)) n();
    else {
      let i = document.createElement(`script`);
      ((i.src = e),
        t && Object.entries(t).forEach(([e, t]) => i.setAttribute(e, t)),
        (i.onload = () => n()),
        (i.onerror = r),
        document.head.append(i));
    }
  });
}
function f(e, t = document) {
  let n = e && e.includes(`:`) ? `property` : `name`;
  return [...t.head.querySelectorAll(`meta[${n}="${e}"]`)].map((e) => e.content).join(`, `) || ``;
}
function p(e, t = ``, n = !1, r = [{ media: `(min-width: 600px)`, width: `2000` }, { width: `750` }]) {
  let i = new URL(e, window.location.href),
    a = document.createElement(`picture`),
    { pathname: o } = i,
    s = o.substring(o.lastIndexOf(`.`) + 1);
  return (
    r.forEach((e) => {
      let t = document.createElement(`source`);
      (e.media && t.setAttribute(`media`, e.media),
        t.setAttribute(`type`, `image/webp`),
        t.setAttribute(`srcset`, `${o}?width=${e.width}&format=webply&optimize=medium`),
        a.appendChild(t));
    }),
    r.forEach((e, i) => {
      if (i < r.length - 1) {
        let t = document.createElement(`source`);
        (e.media && t.setAttribute(`media`, e.media),
          t.setAttribute(`srcset`, `${o}?width=${e.width}&format=${s}&optimize=medium`),
          a.appendChild(t));
      } else {
        let r = document.createElement(`img`);
        (r.setAttribute(`loading`, n ? `eager` : `lazy`),
          r.setAttribute(`alt`, t),
          a.appendChild(r),
          r.setAttribute(`src`, `${o}?width=${e.width}&format=${s}&optimize=medium`));
      }
    }),
    a
  );
}
function m() {
  let e = (e, t) => {
      t.split(`,`).forEach((t) => {
        e.classList.add(s(t.trim()));
      });
    },
    t = f(`template`);
  t && e(document.body, t);
  let n = f(`theme`);
  n && e(document.body, n);
}
function h(e) {
  let t = [`P`, `PRE`, `UL`, `OL`, `PICTURE`, `TABLE`, `H1`, `H2`, `H3`, `H4`, `H5`, `H6`, `HR`],
    n = (e) => {
      let t = document.createElement(`p`);
      (t.append(...e.childNodes),
        [...e.attributes]
          .filter(({ nodeName: e }) => e === `class` || e.startsWith(`data-aue`) || e.startsWith(`data-richtext`))
          .forEach(({ nodeName: n, nodeValue: r }) => {
            (t.setAttribute(n, r ?? ``), e.removeAttribute(n));
          }),
        e.append(t));
    };
  e.querySelectorAll(`:scope > div > div`).forEach((e) => {
    e.hasChildNodes() &&
      (e.firstElementChild && t.some((t) => e.firstElementChild?.tagName === t)
        ? e.firstElementChild?.tagName === `PICTURE` && (e.children.length > 1 || e.textContent?.trim()) && n(e)
        : n(e));
  });
}
function g(e) {
  e.querySelectorAll(`a`).forEach((e) => {
    if (((e.title = e.title || e.textContent || ``), e.href !== e.textContent)) {
      let t = e.parentElement,
        n = e.parentElement?.parentElement;
      t &&
        n &&
        !e.querySelector(`img`) &&
        (t.childNodes.length === 1 &&
          (t.tagName === `P` || t.tagName === `DIV`) &&
          ((e.className = `button`), t.classList.add(`button-container`)),
        t.childNodes.length === 1 &&
          t.tagName === `STRONG` &&
          n.childNodes.length === 1 &&
          n.tagName === `P` &&
          ((e.className = `button primary`), n.classList.add(`button-container`)),
        t.childNodes.length === 1 &&
          t.tagName === `EM` &&
          n.childNodes.length === 1 &&
          n.tagName === `P` &&
          ((e.className = `button secondary`), n.classList.add(`button-container`)));
    }
  });
}
function _(e, t = ``, n = ``) {
  let r = Array.from(e.classList)
      .find((e) => e.startsWith(`icon-`))
      ?.substring(5),
    i = document.createElement(`img`);
  ((i.dataset.iconName = r),
    (i.src = `${window.hlx.codeBasePath}${t}/icons/${r}.svg`),
    (i.alt = n),
    (i.loading = `lazy`),
    (i.width = 16),
    (i.height = 16),
    e.append(i));
}
function v(e, t = ``) {
  e.querySelectorAll(`span.icon`).forEach((e) => {
    _(e, t);
  });
}
function y(e) {
  e.querySelectorAll(`:scope > div:not([data-section-status])`).forEach((e) => {
    let t = [],
      n = !1;
    ([...e.children].forEach((e) => {
      if ((e.tagName === `DIV` && e.className) || !n) {
        let r = document.createElement(`div`);
        (t.push(r), (n = e.tagName !== `DIV` || !e.className), n && r.classList.add(`default-content-wrapper`));
      }
      t[t.length - 1]?.append(e);
    }),
      t.forEach((t) => e.append(t)),
      e.classList.add(`section`),
      (e.dataset.sectionStatus = `initialized`),
      (e.style.display = `none`));
    let r = e.querySelector(`div.section-metadata`);
    if (r) {
      let t = l(r);
      (Object.keys(t).forEach((n) => {
        n === `style`
          ? String(t.style)
              .split(`,`)
              .filter((e) => e)
              .map((e) => s(e.trim()))
              .forEach((t) => e.classList.add(t))
          : (e.dataset[c(n)] = String(t[n]));
      }),
        r.parentNode?.removeChild(r));
    }
  });
}
function b(e, t) {
  let n = Array.isArray(t) ? t : [[t]],
    r = document.createElement(`div`);
  return (
    r.classList.add(e),
    n.forEach((e) => {
      let t = document.createElement(`div`);
      (e.forEach((e) => {
        let n = document.createElement(`div`);
        ((e && typeof e == `object` && `elems` in e ? e.elems : [e]).forEach((e) => {
          e && (typeof e == `string` ? (n.innerHTML += e) : n.appendChild(e));
        }),
          t.appendChild(n));
      }),
        r.appendChild(t));
    }),
    r
  );
}
async function x(e) {
  let t = e.dataset.blockStatus;
  if (t !== `loading` && t !== `loaded`) {
    e.dataset.blockStatus = `loading`;
    let { blockName: t } = e.dataset;
    try {
      let n = u(`${window.hlx.codeBasePath}/blocks/${t}/${t}.css`),
        i = new Promise((n) => {
          (async () => {
            try {
              let n = await r(() => import(`${window.hlx.codeBasePath}/blocks/${t}/${t}.js`), []);
              n.default && (await n.default(e));
            } catch (e) {
              console.error(`failed to load module for ${t}`, e);
            }
            n();
          })();
        });
      await Promise.all([n, i]);
    } catch (e) {
      console.error(`failed to load block ${t}`, e);
    }
    e.dataset.blockStatus = `loaded`;
  }
  return e;
}
function S(e) {
  let t = e.classList[0];
  if (t && !e.dataset.blockStatus) {
    (e.classList.add(`block`),
      (e.dataset.blockName = t),
      (e.dataset.blockStatus = `initialized`),
      h(e),
      e.parentElement?.classList.add(`${t}-wrapper`));
    let n = e.closest(`.section`);
    (n && n.classList.add(`${t}-container`), g(e));
  }
}
function C(e) {
  e.querySelectorAll(`div.section > div > div`).forEach(S);
}
async function w(e) {
  let t = b(`header`, ``);
  return (e.append(t), S(t), x(t));
}
async function T(e) {
  let t = b(`footer`, ``);
  return (e.append(t), S(t), x(t));
}
async function E(e) {
  let t = e.querySelector(`img`);
  await new Promise((e) => {
    t && !t.complete
      ? (t.setAttribute(`loading`, `eager`),
        t.addEventListener(`load`, () => e()),
        t.addEventListener(`error`, () => e()))
      : e();
  });
}
async function D(e, t) {
  let n = e.dataset.sectionStatus;
  if (!n || n === `initialized`) {
    e.dataset.sectionStatus = `loading`;
    let n = [...e.querySelectorAll(`div.block`)];
    for (let e = 0; e < n.length; e += 1) await x(n[e]);
    (t && (await t(e)), (e.dataset.sectionStatus = `loaded`), (e.style.display = ``));
  }
}
async function O(e) {
  let t = [...e.querySelectorAll(`div.section`)];
  for (let e = 0; e < t.length; e += 1) (await D(t[e]), e === 0 && i.enhance && i.enhance());
}
o();
export {
  h as C,
  E as S,
  l as _,
  g as a,
  c as b,
  m as c,
  u as d,
  T as f,
  O as g,
  D as h,
  C as i,
  f as l,
  d as m,
  p as n,
  v as o,
  w as p,
  S as r,
  y as s,
  b as t,
  x as u,
  i as v,
  r as w,
  s as x,
  a as y,
};
