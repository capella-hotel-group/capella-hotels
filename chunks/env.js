var e = [
    {
      env: `prod`,
      publishUrl: `https://publish-p000000-e0000000.adobeaemcloud.com`,
      hostnames: [],
      hcaptchaSiteKey: ``,
    },
    {
      env: `stage`,
      publishUrl: `https://publish-p000000-e0000000.adobeaemcloud.com`,
      hostnames: [],
      hcaptchaSiteKey: ``,
    },
    {
      env: `dev`,
      publishUrl: `https://publish-p152536-e1620746.adobeaemcloud.com`,
      hostnames: [
        `localhost`,
        `author-p152536-e1620746.adobeaemcloud.com`,
        `main--capella-hotels--capella-hotel-group.aem.page`,
        `main--capella-hotels--capella-hotel-group.aem.live`,
      ],
      hcaptchaSiteKey: `740c6c8a-6f1e-4a52-9ce0-069ce33451fc`,
    },
    {
      env: `dev`,
      publishUrl: `https://publish-p152536-e1620746.adobeaemcloud.com`,
      hostnames: [],
      hcaptchaSiteKey: `740c6c8a-6f1e-4a52-9ce0-069ce33451fc`,
    },
  ],
  t;
function n() {
  if (t) return t;
  let n = typeof window < `u` ? window.location.hostname : ``;
  return ((t = (e.find((e) => e.hostnames.length && e.hostnames.includes(n)) ?? e[e.length - 1]).publishUrl), t);
}
function r() {
  return n();
}
function i() {
  let t = typeof window < `u` ? window.location.hostname : ``;
  return (e.find((e) => e.hostnames.length && e.hostnames.includes(t)) ?? e[e.length - 1]).hcaptchaSiteKey ?? ``;
}
function a(e) {
  let t = n();
  try {
    let n = new URL(e);
    return `${new URL(t).origin}${n.pathname}${n.search}`;
  } catch {
    return `${t}${e}`;
  }
}
export { a as i, i as n, n as r, r as t };
