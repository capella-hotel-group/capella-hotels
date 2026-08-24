/*! v1.3.0 | hfb41f4a2 */
//#region scripts/env.js
/**
* Environment detection and AEM asset URL resolution.
* Update ENV_CONFIG when new environments are provisioned.
*/
var ENV_CONFIG = [
	{
		env: "prod",
		publishUrl: "https://publish-p000000-e0000000.adobeaemcloud.com",
		hostnames: [],
		hcaptchaSiteKey: ""
	},
	{
		env: "stage",
		publishUrl: "https://publish-p000000-e0000000.adobeaemcloud.com",
		hostnames: [],
		hcaptchaSiteKey: ""
	},
	{
		env: "dev",
		publishUrl: "https://publish-p152536-e1620746.adobeaemcloud.com",
		hostnames: [
			"localhost",
			"author-p152536-e1620746.adobeaemcloud.com",
			"main--capella-hotels--capella-hotel-group.aem.page",
			"main--capella-hotels--capella-hotel-group.aem.live"
		],
		hcaptchaSiteKey: "740c6c8a-6f1e-4a52-9ce0-069ce33451fc"
	},
	{
		env: "dev",
		publishUrl: "https://publish-p152536-e1620746.adobeaemcloud.com",
		hostnames: [],
		hcaptchaSiteKey: "740c6c8a-6f1e-4a52-9ce0-069ce33451fc"
	}
];
var publishBaseUrlCache;
function getPublishBaseUrl() {
	if (publishBaseUrlCache) return publishBaseUrlCache;
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	publishBaseUrlCache = (ENV_CONFIG.find((e) => e.hostnames.length && e.hostnames.includes(hostname)) ?? ENV_CONFIG[ENV_CONFIG.length - 1]).publishUrl;
	return publishBaseUrlCache;
}
/**
* Returns the base path/origin for server-side API calls (e.g. AEM `/bin`
* servlets), selected based on the current environment. No trailing slash.
* @returns {string} Base URL, e.g. `https://publish-p152536-e1620746.adobeaemcloud.com`
*/
function getBasePathBasedOnEnv() {
	return getPublishBaseUrl();
}
/**
* Returns the PUBLIC hCaptcha site key for the current environment, resolved by
* hostname (falls back to the last ENV_CONFIG entry). Empty string when the
* environment has no key configured, in which case callers may fall back to the
* `hcaptcha-site-key` <meta> tag.
* @returns {string}
*/
function getHCaptchaSiteKey() {
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	return (ENV_CONFIG.find((e) => e.hostnames.length && e.hostnames.includes(hostname)) ?? ENV_CONFIG[ENV_CONFIG.length - 1]).hcaptchaSiteKey ?? "";
}
function resolveDAMUrl(src) {
	const base = getPublishBaseUrl();
	try {
		const url = new URL(src);
		return `${new URL(base).origin}${url.pathname}${url.search}`;
	} catch {
		return `${base}${src}`;
	}
}
//#endregion
export { resolveDAMUrl as i, getHCaptchaSiteKey as n, getPublishBaseUrl as r, getBasePathBasedOnEnv as t };
