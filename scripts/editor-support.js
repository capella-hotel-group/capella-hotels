import {
  decorateBlock as e,
  decorateBlocks as t,
  decorateButtons as n,
  decorateIcons as r,
  decorateSections as i,
  loadBlock as a,
  loadScript as o,
  loadSections as s,
} from '/scripts/aem.js';
import { decorateMain as c } from '/scripts/scripts.js';
function l(e = document) {
  function t(e) {
    (delete e.dataset.richtextResource,
      delete e.dataset.richtextProp,
      delete e.dataset.richtextFilter,
      delete e.dataset.richtextLabel);
  }
  let n;
  for (; (n = e.querySelector(`[data-richtext-prop]:not(div)`));) {
    let { richtextResource: e, richtextProp: r, richtextFilter: i, richtextLabel: a } = n.dataset;
    t(n);
    let o = [],
      s = n;
    for (; (s = s.nextElementSibling);) {
      let n = s;
      if (n.dataset.richtextResource === e && n.dataset.richtextProp === r) (t(n), o.push(n));
      else break;
    }
    let c;
    if (e && r) c = document.querySelectorAll(`[data-richtext-id="${e}"][data-richtext-prop="${r}"]`);
    else {
      let e = n.closest(`[data-aue-resource]`);
      if (e) c = e.querySelectorAll(`:scope > :not([data-aue-resource]) [data-richtext-prop="${r}"]`);
      else {
        console.warn(`Editable parent not found or richtext property ${r}`);
        return;
      }
    }
    if (c.length)
      (console.warn(
        `Found orphan elements of a richtext, that were not consecutive siblings of the first paragraph`,
        c,
      ),
        c.forEach((e) => t(e)));
    else {
      let t = document.createElement(`div`);
      (e && ((t.dataset.aueResource = e), (t.dataset.aueBehavior = `component`)),
        r && (t.dataset.aueProp = r),
        a && (t.dataset.aueLabel = a),
        i && (t.dataset.aueFilter = i),
        (t.dataset.aueType = `richtext`),
        n.replaceWith(t),
        t.append(n, ...o));
    }
  }
}
var u = Promise.resolve(!1);
async function d(d) {
  await u;
  let { detail: p } = d,
    m = p?.request?.target?.resource || p?.request?.target?.container?.resource || p?.request?.to?.container?.resource;
  if (!m) return !1;
  let h = p?.response?.updates;
  if (!h?.length) return !1;
  let g = h[0]?.content;
  if (!g) return !1;
  await o(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
  let _ = window.DOMPurify?.sanitize(g, { USE_PROFILES: { html: !0 } }) ?? ``,
    v = new DOMParser().parseFromString(_, `text/html`),
    y = document.querySelector(`[data-aue-resource="${m}"]`);
  if (y) {
    if (y.matches(`main`)) {
      let e = v.querySelector(`[data-aue-resource="${m}"]`);
      return e
        ? ((e.style.display = `none`),
          y.insertAdjacentElement(`afterend`, e),
          c(e),
          l(e),
          await s(e),
          y.remove(),
          (e.style.display = ``),
          f(e),
          !0)
        : !1;
    }
    let o = y.parentElement?.closest(`.block[data-aue-resource]`) || y.closest(`.block[data-aue-resource]`);
    if (o) {
      let t = o.getAttribute(`data-aue-resource`),
        i = v.querySelector(`[data-aue-resource="${t}"]`);
      if (i)
        return (
          (i.style.display = `none`),
          o.insertAdjacentElement(`afterend`, i),
          n(i),
          r(i),
          e(i),
          l(i),
          await a(i),
          o.remove(),
          (i.style.display = ``),
          !0
        );
    } else {
      let e = v.querySelectorAll(`[data-aue-resource="${m}"],[data-richtext-resource="${m}"]`);
      if (e.length) {
        let { parentElement: a } = y,
          [o] = e;
        return (
          y.matches(`.section`) && a && o
            ? ((o.style.display = `none`),
              y.insertAdjacentElement(`afterend`, o),
              n(o),
              r(o),
              l(o),
              i(a),
              t(a),
              await s(a),
              y.remove(),
              (o.style.display = ``))
            : a && (y.replaceWith(...e), n(a), r(a), l(a)),
          !0
        );
      }
    }
  }
  return !1;
}
function f(e) {
  [
    `aue:content-patch`,
    `aue:content-update`,
    `aue:content-add`,
    `aue:content-move`,
    `aue:content-remove`,
    `aue:content-copy`,
  ].forEach((t) =>
    e?.addEventListener(t, async (e) => {
      (e.stopPropagation(), (u = d(e)), (await u) || window.location.reload());
    }),
  );
}
(f(document.querySelector(`main`)),
  l(),
  new MutationObserver(() => l()).observe(document, { attributeFilter: [`data-richtext-prop`], subtree: !0 }));
