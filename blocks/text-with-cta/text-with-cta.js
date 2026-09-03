/*! v0.1.0 | h8d952be0 */
import { moveInstrumentation } from "../../scripts/scripts.js";
import { loadFragment } from "../fragment/fragment.js";
const THEMES = ["light-neutral", "soft-sand"];
const CTA_STYLES = ["underlined-text-link", "solid-button"];
const cellOf = (row) => row?.firstElementChild;
const textOf = (row) => cellOf(row)?.textContent?.trim() || "";
const fieldOf = (block, name) => block.querySelector(`[data-aue-prop="${name}"]`);
const textFromField = (field) => field?.textContent?.trim() || "";
const fieldTextOf = (block, name) => fieldOf(block, name)?.textContent?.trim() || "";
// Fragments are fetched once per path and shared by every CTA on the page.
const fragmentCache = new Map();
/**
* Returns the nodes to show in the modal. When the authored fragment holds a block
* that already modal-ises itself, its dialog content is unwrapped so the block's own
* on-page trigger and duplicate close control are left behind.
*/
function extractModalContent(fragment) {
	const nestedDialog = fragment.querySelector("[role=\"dialog\"]");
	const source = nestedDialog?.firstElementChild || nestedDialog || fragment;
	source.querySelectorAll("[aria-label=\"Close\"]").forEach((node) => node.remove());
	return [...source.childNodes];
}
function loadModalContent(path) {
	if (!fragmentCache.has(path)) {
		fragmentCache.set(path, loadFragment(path).then((fragment) => fragment ? extractModalContent(fragment) : null));
	}
	return fragmentCache.get(path);
}
/** Builds an empty overlay dialog appended to <body>. */
function buildModal() {
	const overlay = document.createElement("div");
	overlay.className = "text-with-cta-modal";
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
	overlay.hidden = true;
	const panel = document.createElement("div");
	panel.className = "text-with-cta-modal-panel";
	const closeBtn = document.createElement("button");
	closeBtn.type = "button";
	closeBtn.className = "text-with-cta-modal-close";
	closeBtn.setAttribute("aria-label", "Close");
	closeBtn.innerHTML = "&times;";
	const body = document.createElement("div");
	body.className = "text-with-cta-modal-body";
	panel.append(closeBtn, body);
	overlay.append(panel);
	let lastFocused = null;
	const close = () => {
		overlay.hidden = true;
		document.body.classList.remove("text-with-cta-modal-open");
		lastFocused?.focus();
	};
	const open = () => {
		lastFocused = document.activeElement;
		overlay.hidden = false;
		document.body.classList.add("text-with-cta-modal-open");
		closeBtn.focus();
	};
	closeBtn.addEventListener("click", close);
	overlay.addEventListener("click", (event) => {
		if (event.target === overlay) close();
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !overlay.hidden) close();
	});
	document.body.append(overlay);
	return {
		body,
		open
	};
}
export default function decorate(block) {
	const rows = [...block.children];
	const titleField = fieldOf(block, "title");
	const subtitleField = fieldOf(block, "subtitle");
	const themeField = fieldOf(block, "backgroundTheme");
	const ctaStyleField = fieldOf(block, "ctaStyle");
	const labelField = fieldOf(block, "ctaLabel");
	const actionField = fieldOf(block, "ctaActionKind");
	const urlField = fieldOf(block, "ctaTargetUrl");
	const newTabField = fieldOf(block, "openInNewTab");
	const hasLegacyAnchorRow = !titleField && rows.length >= 9;
	const legacyRows = hasLegacyAnchorRow ? rows.slice(1) : rows;
	const [titleRow, subtitleRow, themeRow, styleRow, labelRow, actionRow, urlRow, newTabRow] = legacyRows;
	const themeValue = textFromField(themeField) || textOf(themeRow);
	const ctaStyleValue = textFromField(ctaStyleField) || textOf(styleRow);
	const theme = THEMES.includes(themeValue) ? themeValue : THEMES[0];
	const ctaStyle = CTA_STYLES.includes(ctaStyleValue) ? ctaStyleValue : CTA_STYLES[0];
	const action = textFromField(actionField) || textOf(actionRow);
	const label = textFromField(labelField) || textOf(labelRow);
	const href = urlField?.querySelector("a")?.getAttribute("href") || urlRow?.querySelector("a")?.getAttribute("href") || "#";
	const openInNewTab = (textFromField(newTabField) || textOf(newTabRow)).toLowerCase() === "true";
	const anchorId = fieldTextOf(block, "id") || (hasLegacyAnchorRow ? textOf(rows[0]) : "");
	if (anchorId) block.id = anchorId.replace(/^#/, "");
	block.classList.add(`text-with-cta-theme-${theme}`, `text-with-cta-style-${ctaStyle}`);
	const content = document.createElement("div");
	content.className = "text-with-cta-content";
	const titleCell = titleField || cellOf(titleRow);
	if (titleCell) {
		titleCell.classList.add("text-with-cta-title");
		content.append(titleCell);
	}
	const subtitleCell = subtitleField || cellOf(subtitleRow);
	if (subtitleCell) {
		subtitleCell.classList.add("text-with-cta-subtitle");
		content.append(subtitleCell);
	}
	const actions = document.createElement("div");
	actions.className = "text-with-cta-actions";
	const cta = document.createElement("a");
	cta.className = "text-with-cta-cta";
	cta.classList.add(`text-with-cta-cta-${ctaStyle}`);
	cta.href = href;
	cta.textContent = label;
	const labelSource = labelField || labelRow?.querySelector("[data-aue-prop=\"ctaLabel\"]");
	if (labelSource) moveInstrumentation(labelSource, cta);
	if (action === "popup-form-modal") {
		let modal = null;
		cta.setAttribute("aria-haspopup", "dialog");
		cta.addEventListener("click", async (event) => {
			event.preventDefault();
			if (!modal) modal = buildModal();
			modal.open();
			if (modal.body.hasChildNodes()) return;
			const nodes = await loadModalContent(href);
			if (nodes?.length) modal.body.append(...nodes);
		});
	} else if (openInNewTab) {
		cta.target = "_blank";
		cta.rel = "noopener noreferrer";
	}
	actions.append(cta);
	block.textContent = "";
	block.append(content, actions);
}
