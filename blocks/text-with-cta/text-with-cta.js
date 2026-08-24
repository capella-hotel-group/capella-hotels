/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:35:53.938Z */
import { moveInstrumentation } from "../../scripts/scripts.js";
//#region src/blocks/text-with-cta/text-with-cta.ts
var THEMES = ["light-neutral", "soft-sand"];
var CTA_STYLES = ["underlined-text-link", "solid-button"];
var cellOf = (row) => row?.firstElementChild;
var textOf = (row) => cellOf(row)?.textContent?.trim() || "";
/**
* Opens the Salesforce mailing-list modal rendered by the newsletter-form block.
* Returns false when no newsletter form is present on the page.
*/
function openSubscriptionModal() {
	const trigger = document.querySelector(".newsletter-trigger");
	if (trigger) {
		trigger.click();
		return true;
	}
	const overlay = document.querySelector(".newsletter-overlay");
	if (!overlay) return false;
	overlay.classList.add("is-open");
	document.body.classList.add("newsletter-modal-open");
	overlay.querySelector(".newsletter-dialog-close")?.focus();
	return true;
}
function decorate(block) {
	const [titleRow, subtitleRow, themeRow, styleRow, labelRow, actionRow, urlRow, newTabRow] = [...block.children];
	const theme = textOf(themeRow);
	const ctaStyle = textOf(styleRow);
	const action = textOf(actionRow);
	const label = textOf(labelRow);
	const href = urlRow?.querySelector("a")?.getAttribute("href") || "#";
	const openInNewTab = textOf(newTabRow).toLowerCase() === "true";
	block.classList.add(`text-with-cta-theme-${THEMES.includes(theme) ? theme : THEMES[0]}`);
	const content = document.createElement("div");
	content.className = "text-with-cta-content";
	const titleCell = cellOf(titleRow);
	if (titleCell) {
		titleCell.classList.add("text-with-cta-title");
		content.append(titleCell);
	}
	const subtitleCell = cellOf(subtitleRow);
	if (subtitleCell) {
		subtitleCell.classList.add("text-with-cta-subtitle");
		content.append(subtitleCell);
	}
	const actions = document.createElement("div");
	actions.className = "text-with-cta-actions";
	const cta = document.createElement("a");
	cta.className = "text-with-cta-cta";
	cta.classList.add(`text-with-cta-cta-${CTA_STYLES.includes(ctaStyle) ? ctaStyle : CTA_STYLES[0]}`);
	cta.href = href;
	cta.textContent = label;
	const labelSource = labelRow?.querySelector("[data-aue-prop=\"ctaLabel\"]");
	if (labelSource) moveInstrumentation(labelSource, cta);
	if (action === "popup-form-modal") {
		cta.setAttribute("aria-haspopup", "dialog");
		cta.addEventListener("click", (event) => {
			if (openSubscriptionModal()) event.preventDefault();
		});
	} else if (openInNewTab) {
		cta.target = "_blank";
		cta.rel = "noopener noreferrer";
	}
	actions.append(cta);
	block.textContent = "";
	block.append(content, actions);
}
//#endregion
export { decorate as default };
