/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:51:15.167Z */
//#region src/blocks/section-intro/section-intro.ts
function decorate(block) {
	const rows = [...block.children];
	const headingText = rows[0]?.querySelector("div")?.textContent?.trim();
	const h2 = document.createElement("h2");
	h2.textContent = headingText ?? "";
	rows[0]?.replaceWith(h2);
	const textWrapper = document.createElement("div");
	textWrapper.classList.add("section-intro-text");
	const classNames = ["subtext", "desc"];
	rows.slice(1).forEach((row, i) => {
		const cell = row.querySelector("div");
		if (cell) {
			const className = classNames[i];
			if (className) cell.classList.add(className);
			textWrapper.appendChild(cell);
		}
		row.remove();
	});
	block.appendChild(textWrapper);
}
//#endregion
export { decorate as default };
