/*! v1.3.0 | h6f8ccf9f */
import { n as createOptimizedPicture } from "../../scripts/vendor/aem-core-TetbwNGB.js";
import { moveInstrumentation } from "../../scripts/scripts.js";
//#region src/blocks/cards/cards.ts
function decorate(block) {
	const ul = document.createElement("ul");
	[...block.children].forEach((row) => {
		const li = document.createElement("li");
		moveInstrumentation(row, li);
		while (row.firstElementChild) li.append(row.firstElementChild);
		[...li.children].forEach((div) => {
			if (div.children.length === 1 && div.querySelector("picture")) div.className = "cards-card-image";
			else div.className = "cards-card-body";
		});
		ul.append(li);
	});
	ul.querySelectorAll("picture > img").forEach((img) => {
		const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: "750" }]);
		moveInstrumentation(img, optimizedPic.querySelector("img"));
		img.closest("picture")?.replaceWith(optimizedPic);
	});
	block.replaceChildren(ul);
}
//#endregion
export { decorate as default };
