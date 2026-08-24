/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:08:21.319Z */
import { S as waitForFirstImage, a as decorateButtons, c as decorateTemplateAndTheme, d as loadCSS, f as loadFooter, g as loadSections, h as loadSection, i as decorateBlocks, o as decorateIcons, p as loadHeader, s as decorateSections, w as __vitePreload } from "./vendor/aem-CLhvdm5x.js";
//#region src/app/scripts.ts
/**
* Moves all the attributes from a given elmenet to another given element.
* @param {Element} from the element to copy attributes from
* @param {Element} to the element to copy attributes to
*/
function moveAttributes(from, to, attributes) {
	(attributes ?? [...from.attributes].map(({ nodeName }) => nodeName)).forEach((attr) => {
		const value = from.getAttribute(attr);
		if (value) {
			to?.setAttribute(attr, value);
			from.removeAttribute(attr);
		}
	});
}
/**
* Move instrumentation attributes from a given element to another given element.
* @param {Element} from the element to copy attributes from
* @param {Element} to the element to copy attributes to
*/
function moveInstrumentation(from, to) {
	moveAttributes(from, to, [...from.attributes].map(({ nodeName }) => nodeName).filter((attr) => attr.startsWith("data-aue-") || attr.startsWith("data-richtext-")));
}
var RTL_LANGS = [
	"ar",
	"he",
	"fa",
	"ur"
];
var SUPPORTED_SITES = [
	"global",
	"bangkok",
	"sanya",
	"test-pages"
];
var LANG_MAP = {
	"zh-cn": "zh-CN",
	jp: "ja"
};
var VALID_LANG_PRIMARIES = /* @__PURE__ */ new Set([
	"ar",
	"en",
	"fr",
	"de",
	"ja",
	"ko",
	"zh",
	"he",
	"fa",
	"ur",
	"it",
	"es",
	"pt",
	"ru",
	"nl",
	"tr",
	"hi",
	"vi",
	"th",
	"id",
	"ms"
]);
/** * Detects the page language from the URL path and normalizes it to a BCP 47 tag.
* Checks LANG_MAP aliases first, then validates primary against VALID_LANG_PRIMARIES.
* Skips market/country codes (qa, sa, ae) that are not valid language primaries.
* Falls back to "en".
* @returns {string} BCP 47 language tag
*/
function getPageLang() {
	const match = window.location.pathname.split("/").filter(Boolean).find((s) => {
		const lower = s.toLowerCase();
		return LANG_MAP[lower] || VALID_LANG_PRIMARIES.has(lower.split("-")[0] ?? "");
	});
	if (!match) return "en";
	const lower = match.toLowerCase();
	if (LANG_MAP[lower]) return LANG_MAP[lower];
	const parts = lower.split("-");
	return parts.length > 1 ? `${parts[0]}-${(parts[1] ?? "").toUpperCase()}` : parts[0] ?? "en";
}
/**
* Sets dir="rtl" and body.is-rtl for RTL languages.
* Must run before any block decoration.
* @param {string} lang BCP 47 language tag
*/
function applyDirection(lang) {
	const primary = lang.split("-")[0] ?? "";
	if (RTL_LANGS.includes(primary)) {
		document.documentElement.setAttribute("dir", "rtl");
		document.body.classList.add("is-rtl");
	}
}
/**
* load fonts.css and set a session storage flag
*/
async function loadFonts() {
	await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
	try {
		if (!window.location.hostname.includes("localhost")) sessionStorage.setItem("fonts-loaded", "true");
	} catch (e) {}
}
/**
* Decorates the main element.
* @param {Element} main The main element
*/
function decorateMain(main) {
	decorateButtons(main);
	decorateIcons(main);
	decorateSections(main);
	decorateBlocks(main);
}
/**
* Loads everything needed to get to LCP.
* @param {Element} doc The container element
*/
async function loadEager(doc) {
	const lang = getPageLang();
	document.documentElement.lang = lang;
	applyDirection(lang);
	decorateTemplateAndTheme();
	const main = doc.querySelector("main");
	if (main) {
		decorateMain(main);
		document.body.classList.add("appear");
		const firstSection = main.querySelector(".section");
		if (firstSection) await loadSection(firstSection, waitForFirstImage);
	}
	try {
		if (window.innerWidth >= 900 || sessionStorage.getItem("fonts-loaded")) loadFonts();
	} catch (e) {}
}
/**
* Loads everything that doesn't need to be delayed.
* @param {Element} doc The container element
*/
async function loadLazy(doc) {
	const header = doc.querySelector("header");
	if (header) loadHeader(header);
	const main = doc.querySelector("main");
	if (main) await loadSections(main);
	const { hash } = window.location;
	const element = hash ? doc.getElementById(hash.substring(1)) : false;
	if (hash && element) element.scrollIntoView();
	const footer = doc.querySelector("footer");
	if (footer) loadFooter(footer);
	loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
	loadFonts();
}
/**
* Loads everything that happens a lot later,
* without impacting the user experience.
*/
function loadDelayed() {
	window.setTimeout(() => __vitePreload(() => import("./delayed.js"), []), 3e3);
}
async function loadPage() {
	await loadEager(document);
	await loadLazy(document);
	loadDelayed();
}
loadPage();
//#endregion
export { LANG_MAP, SUPPORTED_SITES, VALID_LANG_PRIMARIES, decorateMain, getPageLang, moveAttributes, moveInstrumentation };
