/*! v1.3.0 | he4b045b9 */
//#region src/blocks/text-with-image/text-with-image.ts
function decorate(block) {
	const rows = [...block.children];
	const eyebrowText = rows[0]?.firstElementChild?.textContent?.trim() || "";
	const titleText = rows[1]?.firstElementChild?.textContent?.trim() || "";
	const descriptionEl = rows[2]?.firstElementChild;
	const pictureEl = rows[3]?.querySelector("picture");
	const desktopImg = pictureEl?.querySelector("img");
	const altText = desktopImg?.getAttribute("alt") || "";
	const mobilePictureEl = rows[4]?.querySelector("picture");
	const mobileImg = mobilePictureEl?.querySelector("img");
	const mobileSrc = (mobilePictureEl?.querySelector("source"))?.getAttribute("srcset") || mobileImg?.getAttribute("src");
	const responsiveAltText = mobileImg?.getAttribute("alt") || altText;
	const ctaGroup = rows[5]?.firstElementChild;
	const ctaHref = (ctaGroup?.querySelector("a"))?.getAttribute("href") || "";
	const ctaText = [...ctaGroup?.children || []].find((element) => !element.querySelector("a"))?.textContent?.trim() || "";
	const openInNewTab = ([...ctaGroup?.children || []].find((element) => /^(true|false)$/i.test(element.textContent?.trim() ?? ""))?.textContent?.trim().toLowerCase() || "") === "true";
	if (pictureEl) {
		const responsiveImageQuery = window.matchMedia("(max-width: 1024px)");
		const updateAltText = () => {
			if (desktopImg) desktopImg.alt = responsiveImageQuery.matches ? responsiveAltText : altText;
		};
		updateAltText();
		if (mobilePictureEl) {
			if (mobileSrc) {
				const source = document.createElement("source");
				source.media = "(max-width: 1024px)";
				source.srcset = mobileSrc;
				pictureEl.prepend(source);
			}
			responsiveImageQuery.addEventListener("change", updateAltText);
		}
	}
	const textCol = document.createElement("div");
	textCol.className = "text-col";
	if (eyebrowText) {
		const eyebrow = document.createElement("p");
		eyebrow.className = "eyebrow";
		eyebrow.textContent = eyebrowText;
		textCol.append(eyebrow);
	}
	if (titleText) {
		const h3 = document.createElement("h3");
		h3.textContent = titleText;
		textCol.append(h3);
	}
	const desc = document.createElement("div");
	desc.className = "description";
	if (descriptionEl) desc.innerHTML += descriptionEl.innerHTML;
	textCol.append(desc);
	if (ctaHref && ctaText) {
		const cta = document.createElement("a");
		cta.className = "cta-link";
		cta.href = ctaHref;
		cta.textContent = ctaText;
		if (openInNewTab) cta.target = "_blank";
		textCol.append(cta);
	}
	const imageCol = document.createElement("div");
	imageCol.className = "image-col";
	if (mobileSrc) imageCol.classList.add("has-mobile-image");
	if (pictureEl) imageCol.append(pictureEl);
	mobilePictureEl?.remove();
	block.innerHTML = "";
	block.append(textCol, imageCol);
}
//#endregion
export { decorate as default };
