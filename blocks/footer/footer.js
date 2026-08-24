/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:21:40.878Z */
import { l as getMetadata } from "../../scripts/vendor/aem-CeI3ZFrV.js";
import { LANG_MAP, SUPPORTED_SITES, VALID_LANG_PRIMARIES, moveInstrumentation } from "../../scripts/scripts.js";
import { loadFragment } from "../fragment/fragment.js";
//#region src/blocks/footer/footer.ts
function getFragmentBasePath() {
	const segments = window.location.pathname.split("/").filter(Boolean);
	const siteIdx = segments.findIndex((s) => SUPPORTED_SITES.includes(s));
	const site = siteIdx !== -1 ? segments[siteIdx] : "global";
	const rawLang = (siteIdx !== -1 ? segments.slice(siteIdx + 1) : segments)[0]?.toLowerCase() ?? "";
	const parts = [site, rawLang && (LANG_MAP[rawLang] || VALID_LANG_PRIMARIES.has(rawLang.split("-")[0] ?? "")) ? rawLang : ""].filter(Boolean);
	return parts.length ? `/${parts.join("/")}` : "";
}
/**
* loads and decorates the footer
* @param {Element} block The footer block element
*/
async function decorate(block) {
	const footerMeta = getMetadata("footer");
	const footerPath = footerMeta ? new URL(footerMeta, window.location.href).pathname : null;
	let fragment = footerPath ? await loadFragment(footerPath) : null;
	if (!fragment) fragment = await loadFragment(`${getFragmentBasePath()}/footer`);
	if (!fragment) return;
	const lists = [...fragment.querySelectorAll("ul")];
	const inner = document.createElement("div");
	inner.className = "footer-inner";
	lists.forEach((srcList) => {
		moveInstrumentation(srcList, inner);
		[...srcList.querySelectorAll("li")].forEach((srcItem) => {
			const srcA = srcItem.querySelector("a");
			const item = document.createElement("p");
			item.className = "footer-item";
			moveInstrumentation(srcItem, item);
			if (srcA) {
				const a = document.createElement("a");
				a.href = srcA.href;
				if (srcA.target) a.target = srcA.target;
				a.rel = "noopener noreferrer";
				a.textContent = srcA.textContent?.trim() ?? "";
				moveInstrumentation(srcA, a);
				item.append(a);
			} else item.textContent = srcItem.textContent?.trim() ?? "";
			inner.append(item);
		});
	});
	block.replaceChildren(inner);
}
//#endregion
export { decorate as default };
