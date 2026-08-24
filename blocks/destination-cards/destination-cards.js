/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:24:10.299Z */
import { moveInstrumentation } from "../../scripts/scripts.js";
//#region src/blocks/destination-cards/destination-cards.ts
function textFromCell(cell) {
	if (!cell) return "";
	const textNodes = [...cell.children].map((child) => child.textContent?.trim() ?? "").filter(Boolean);
	return textNodes.length > 1 ? textNodes.join("\n") : cell.textContent?.trim() ?? "";
}
function textFromPart(cell, index) {
	return textFromCell([...cell?.children || []][index] || cell);
}
function isEnabled(value, fallback = false) {
	const text = typeof value === "string" ? value : textFromCell(value);
	if (!text) return fallback;
	return [
		"true",
		"yes",
		"enabled"
	].includes(text.trim().toLowerCase());
}
function setLinkAttributes(link, href, openInNewTab = false) {
	link.href = href;
	if (openInNewTab) {
		link.target = "_blank";
		link.rel = "noopener noreferrer";
	}
}
function getLinkFromCell(cell) {
	const authoredLink = cell?.querySelector("a");
	return {
		href: authoredLink?.getAttribute("href") || textFromCell(cell),
		label: authoredLink?.textContent?.trim() || textFromCell(cell)
	};
}
function isCardRow(row) {
	return row.children.length > 1;
}
function getCardFields(row) {
	const cells = [...row.children];
	if (cells.length <= 4 && !!cells[1]?.querySelector("picture, img")) {
		const [contentCell, mediaCell, ctaCell, settingsCell] = cells;
		const cta = getLinkFromCell(ctaCell);
		const settingsParts = [...settingsCell?.children || []];
		return {
			location: textFromPart(contentCell, 0),
			title: textFromPart(contentCell, 1),
			image: mediaCell?.querySelector("picture, img"),
			imageAlt: mediaCell?.querySelector("img")?.getAttribute("alt") || textFromPart(mediaCell, 1),
			href: cta.href,
			ctaLabel: cta.label,
			darkOverlay: isEnabled(settingsParts[0] || settingsCell, true),
			openInNewTab: isEnabled(settingsParts[1], false)
		};
	}
	const linkIndex = cells.findIndex((cell, index) => index > 2 && !!cell.querySelector("a"));
	const hasLegacyAltField = linkIndex >= 5;
	const ctaLabelCell = linkIndex >= 0 ? cells[linkIndex + 1] : null;
	const cta = getLinkFromCell(cells[linkIndex]);
	return {
		location: textFromCell(cells[0]),
		title: textFromCell(cells[1]),
		image: cells[2]?.querySelector("picture, img"),
		imageAlt: hasLegacyAltField ? textFromCell(cells[3]) : null,
		href: cta.href,
		ctaLabel: textFromCell(ctaLabelCell) || cta.label,
		darkOverlay: isEnabled(cells[linkIndex + 2], true),
		openInNewTab: isEnabled(cells[linkIndex + 3], false)
	};
}
function buildIntro(rows) {
	const [anchorRow, titleRow, subtitleRow] = rows.length > 2 ? rows : [null, ...rows];
	const intro = document.createElement("div");
	intro.className = "destination-cards-intro";
	const anchorId = textFromCell(anchorRow?.firstElementChild || anchorRow);
	if (anchorId) intro.dataset.anchorId = anchorId.replace(/^#/, "");
	const title = textFromCell(titleRow?.firstElementChild || titleRow);
	if (title) {
		const heading = document.createElement("h2");
		heading.className = "destination-cards-title";
		heading.textContent = title;
		intro.append(heading);
	}
	const subtitleCell = subtitleRow?.firstElementChild || subtitleRow;
	if (subtitleCell && textFromCell(subtitleCell)) {
		const subtitle = document.createElement("div");
		subtitle.className = "destination-cards-subtitle";
		while (subtitleCell.firstChild) subtitle.append(subtitleCell.firstChild);
		intro.append(subtitle);
	}
	return intro;
}
function buildCta(label, href, openInNewTab) {
	if (!label && !href) return null;
	const cta = document.createElement("a");
	cta.className = "destination-cards-cta";
	cta.textContent = label || "Explore";
	setLinkAttributes(cta, href || "#", openInNewTab);
	return cta;
}
function buildCard(row) {
	const fields = getCardFields(row);
	const cta = buildCta(fields.ctaLabel, fields.href, fields.openInNewTab);
	const item = document.createElement("li");
	item.className = "destination-cards-item";
	moveInstrumentation(row, item);
	const article = document.createElement("article");
	article.className = "destination-cards-card";
	const media = document.createElement("figure");
	media.className = "destination-cards-media";
	if (!fields.darkOverlay) media.classList.add("destination-cards-media-no-overlay");
	const mediaContent = fields.href ? document.createElement("a") : document.createElement("div");
	mediaContent.className = "destination-cards-media-link";
	if (fields.href && mediaContent instanceof HTMLAnchorElement) {
		setLinkAttributes(mediaContent, fields.href, fields.openInNewTab);
		mediaContent.setAttribute("aria-label", `${fields.title || fields.location || "Destination"}: ${fields.ctaLabel || "Explore"}`);
	}
	if (fields.image) {
		const mediaNode = fields.image.tagName.toLowerCase() === "picture" ? fields.image : fields.image.closest("picture") || fields.image;
		const imageElement = mediaNode.querySelector("img") || (mediaNode.tagName === "IMG" ? mediaNode : null);
		if (imageElement && fields.imageAlt !== null) imageElement.alt = fields.imageAlt;
		mediaContent.append(mediaNode);
	} else media.classList.add("destination-cards-media-no-image");
	const overlay = document.createElement("figcaption");
	overlay.className = "destination-cards-overlay";
	if (fields.location) {
		const location = document.createElement("p");
		location.className = "destination-cards-location";
		location.textContent = fields.location;
		overlay.append(location);
	}
	if (fields.title) {
		const title = document.createElement("h1");
		title.className = "destination-cards-card-title";
		title.textContent = fields.title;
		overlay.append(title);
	}
	mediaContent.append(overlay);
	media.append(mediaContent);
	article.append(media);
	if (cta) {
		const footer = document.createElement("div");
		footer.className = "destination-cards-footer";
		footer.append(cta);
		article.append(footer);
	}
	item.append(article);
	return item;
}
function decorate(block) {
	const rows = [...block.children];
	const firstCardIndex = rows.findIndex(isCardRow);
	if (firstCardIndex < 0) return block;
	const introRows = rows.slice(0, firstCardIndex);
	const cardRows = rows.slice(firstCardIndex);
	const intro = buildIntro(introRows);
	const { anchorId } = intro.dataset;
	if (anchorId) block.id = anchorId;
	delete intro.dataset.anchorId;
	const list = document.createElement("ul");
	list.className = "destination-cards-list";
	cardRows.forEach((row) => list.append(buildCard(row)));
	block.replaceChildren(intro, list);
	return block;
}
//#endregion
export { decorate as default };
