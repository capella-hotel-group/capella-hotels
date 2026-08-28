/*! v0.1.0 | h4facee77 */
export default function decorate(block) {
	const rows = [...block.children];
	const fieldOf = (name) => block.querySelector(`[data-aue-prop="${name}"]`);
	const anchorId = fieldOf("id")?.textContent?.trim();
	if (anchorId) block.id = anchorId.replace(/^#/, "");
	const titleField = fieldOf("title");
	const bodyField = fieldOf("body");
	const headingText = titleField?.textContent?.trim() || rows[0]?.querySelector("div")?.textContent?.trim() || "";
	const h2 = document.createElement("h2");
	h2.className = "section-intro-title";
	h2.textContent = headingText;
	const narrative = bodyField || rows[1]?.querySelector("div");
	const textWrapper = document.createElement("div");
	textWrapper.className = "section-intro-text";
	if (narrative) textWrapper.append(narrative);
	block.replaceChildren(h2, textWrapper);
}
