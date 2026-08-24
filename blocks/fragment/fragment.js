/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:29:57.867Z */
import { loadSections } from "../../scripts/aem.js";
import { decorateMain } from "../../scripts/scripts.js";
//#region src/blocks/fragment/fragment.ts
/**
* Loads a fragment.
* @param {string} path The path to the fragment
* @returns {HTMLElement} The root element of the fragment
*/
async function loadFragment(path) {
	let fragmentPath = path;
	if (fragmentPath && fragmentPath.startsWith("/")) {
		fragmentPath = fragmentPath.replace(/(\.plain)?\.html/, "");
		const resp = await fetch(`${fragmentPath}.plain.html`);
		if (resp.ok) {
			const main = document.createElement("main");
			main.innerHTML = await resp.text();
			const resetAttributeBase = (tag, attr) => {
				main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
					const value = elem.getAttribute(attr);
					if (value) elem[attr] = new URL(value, new URL(fragmentPath, window.location.href)).href;
				});
			};
			resetAttributeBase("img", "src");
			resetAttributeBase("source", "srcset");
			decorateMain(main);
			await loadSections(main);
			return main;
		}
	}
	return null;
}
async function decorate(block) {
	const link = block.querySelector("a");
	const fragment = await loadFragment(link ? link.getAttribute("href") : block.textContent?.trim() ?? null);
	if (fragment) {
		const fragmentSection = fragment.querySelector(":scope .section");
		if (fragmentSection) {
			block.classList.add(...fragmentSection.classList);
			block.classList.remove("section");
			block.replaceChildren(...fragmentSection.childNodes);
		}
	}
}
//#endregion
export { decorate as default, loadFragment };
