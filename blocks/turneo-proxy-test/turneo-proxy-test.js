const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["scripts/vendor/dompurify.min-Ds1y7ZtT.js","scripts/vendor/rolldown-runtime-JaVRA9dJ.js"])))=>i.map(i=>d[i]);
/*! v1.3.0 | hef84c9e4 */
import { n as __toESM } from "../../scripts/vendor/rolldown-runtime-JaVRA9dJ.js";
import { w as __vitePreload } from "../../scripts/vendor/aem-core-TetbwNGB.js";
//#region src/blocks/turneo-proxy-test/turneo-appbuilder-api.ts
/**
* Turneo App Builder API service module.
* Calls the Adobe App Builder runtime which proxies the Turneo API server-side.
* No API key required on the frontend — authentication is handled internally.
*
* Base URL: https://3599957-turneoapp-stage.adobeioruntime.net/api/v1/web/turneo-app/get-experience-data.json
*/
var APP_BUILDER_URL = "https://3599957-turneoapp-stage.adobeioruntime.net/api/v1/web/turneo-app/get-experience-data.json";
/**
* Fetch experiences from the App Builder runtime.
* All params are optional and can be combined freely.
*/
async function fetchExperiencesViaAppBuilder(params) {
	const url = new URL(APP_BUILDER_URL);
	if (params) Object.entries(params).forEach(([key, value]) => {
		if (value) url.searchParams.set(key, value);
	});
	const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
	if (!response.ok) throw new Error(`App Builder API error: ${response.status} ${response.statusText}`);
	return (await response.json()).body?.results ?? [];
}
//#endregion
//#region src/blocks/turneo-proxy-test/turneo-proxy-test.ts
/** Lazy-load DOMPurify (UMD sets window.DOMPurify as a side-effect). */
async function loadDOMPurify() {
	if (!window.DOMPurify) await __vitePreload(() => import("../../scripts/vendor/dompurify.min-Ds1y7ZtT.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)), __vite__mapDeps([0,1]));
	return window.DOMPurify ?? null;
}
function buildError(error) {
	const box = document.createElement("div");
	box.className = "turneo-proxy-test-error";
	const msg = document.createElement("p");
	msg.textContent = "Could not load experiences from the App Builder API.";
	const detail = document.createElement("pre");
	detail.className = "turneo-proxy-test-error-detail";
	detail.textContent = error instanceof Error ? error.message : String(error);
	box.append(msg, detail);
	return box;
}
function buildCard(exp, purify) {
	const card = document.createElement("article");
	card.className = "turneo-proxy-test-card";
	const thumbnail = document.createElement("div");
	thumbnail.className = "turneo-proxy-test-card-thumbnail";
	if (exp.image) {
		const img = document.createElement("img");
		img.src = exp.image;
		img.alt = exp.title;
		img.loading = "lazy";
		img.onerror = () => {
			img.onerror = null;
			thumbnail.removeChild(img);
		};
		thumbnail.append(img);
	}
	const body = document.createElement("div");
	body.className = "turneo-proxy-test-card-body";
	const titleEl = document.createElement("h3");
	titleEl.className = "turneo-proxy-test-card-title";
	titleEl.textContent = exp.title;
	const desc = document.createElement("p");
	desc.className = "turneo-proxy-test-card-desc";
	const rawHtml = exp.highlight || exp.description || "";
	desc.innerHTML = purify ? purify.sanitize(rawHtml) : "";
	const footer = document.createElement("div");
	footer.className = "turneo-proxy-test-card-footer";
	if (exp.minPrice) {
		const price = document.createElement("span");
		price.className = "turneo-proxy-test-card-price";
		price.textContent = `From ${exp.minPrice.currency} ${exp.minPrice.amount} / ${exp.minPrice.unit}`;
		footer.append(price);
	}
	body.append(titleEl, desc, footer);
	card.append(thumbnail, body);
	return card;
}
function buildGridChildren(experiences, purify) {
	if (!experiences.length) {
		const empty = document.createElement("p");
		empty.className = "turneo-proxy-test-empty";
		empty.textContent = "No experiences returned.";
		return [empty];
	}
	return experiences.map((exp) => buildCard(exp, purify));
}
function setGridLoading(gridEl) {
	gridEl.innerHTML = "";
	for (let i = 0; i < 8; i += 1) {
		const skeleton = document.createElement("div");
		skeleton.className = "turneo-proxy-test-skeleton";
		gridEl.append(skeleton);
	}
}
function buildDateField(id, label) {
	const group = document.createElement("div");
	group.className = "turneo-proxy-test-filter-field";
	const lbl = document.createElement("label");
	lbl.className = "turneo-proxy-test-filter-label";
	lbl.htmlFor = `tpt-${id}`;
	lbl.textContent = label;
	const inputWrap = document.createElement("div");
	inputWrap.className = "turneo-proxy-test-filter-input-wrap";
	const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	icon.setAttribute("viewBox", "0 0 20 20");
	icon.setAttribute("fill", "none");
	icon.setAttribute("aria-hidden", "true");
	icon.innerHTML = "<rect x=\"2\" y=\"4\" width=\"16\" height=\"14\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M2 8h16\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M6 2v4M14 2v4\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/>";
	const input = document.createElement("input");
	input.type = "date";
	input.id = `tpt-${id}`;
	input.className = "turneo-proxy-test-filter-input";
	const today = /* @__PURE__ */ new Date();
	input.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
	inputWrap.append(icon, input);
	group.append(lbl, inputWrap);
	return group;
}
function buildFilter(onSearch) {
	const bar = document.createElement("div");
	bar.className = "turneo-proxy-test-filter";
	const fromGroup = buildDateField("from", "Check-in");
	const toGroup = buildDateField("to", "Check-out");
	const fromInput = fromGroup.querySelector("input");
	const toInput = toGroup.querySelector("input");
	fromInput.addEventListener("change", () => {
		if (fromInput.value) toInput.min = fromInput.value;
	});
	toInput.addEventListener("change", () => {
		if (toInput.value) fromInput.max = toInput.value;
	});
	const btn = document.createElement("button");
	btn.className = "turneo-proxy-test-filter-btn";
	btn.type = "button";
	btn.textContent = "Search";
	btn.addEventListener("click", async () => {
		btn.disabled = true;
		btn.textContent = "Searching…";
		try {
			await onSearch(fromInput.value, toInput.value);
		} finally {
			btn.disabled = false;
			btn.textContent = "Search";
		}
	});
	bar.append(fromGroup, toGroup, btn);
	return bar;
}
async function decorate(block) {
	const [purifyResult, experiencesResult] = await Promise.allSettled([loadDOMPurify(), fetchExperiencesViaAppBuilder()]);
	const purify = purifyResult.status === "fulfilled" ? purifyResult.value : null;
	const wrapper = document.createElement("div");
	wrapper.className = "turneo-proxy-test-wrapper";
	const gridEl = document.createElement("div");
	gridEl.className = "turneo-proxy-test-grid";
	const filterBar = buildFilter(async (from, to) => {
		setGridLoading(gridEl);
		try {
			const experiences = await fetchExperiencesViaAppBuilder(from || to ? {
				from: from || void 0,
				until: to || void 0
			} : void 0);
			gridEl.replaceChildren(...buildGridChildren(experiences, purify));
		} catch (err) {
			gridEl.replaceChildren(buildError(err));
		}
	});
	if (experiencesResult.status === "fulfilled") gridEl.replaceChildren(...buildGridChildren(experiencesResult.value, purify));
	else gridEl.replaceChildren(buildError(experiencesResult.reason));
	wrapper.append(filterBar, gridEl);
	block.replaceChildren(wrapper);
}
//#endregion
export { decorate as default };
