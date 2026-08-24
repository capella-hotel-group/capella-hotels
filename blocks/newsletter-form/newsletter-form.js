/*! @adobe/aem-boilerplate v1.3.0 - built 2026-08-24T09:31:20.733Z */
import { getPageLang } from "../../scripts/scripts.js";
import { n as getHCaptchaSiteKey$1, t as getBasePathBasedOnEnv } from "../../scripts/vendor/env-D4gXytvl.js";
//#region src/blocks/newsletter-form/newsletter-form.ts
var API_ENDPOINT = `${getBasePathBasedOnEnv()}/content/servlet.newslettersubscription.json`;
var OPTIONS_GRAPHQL_QUERY = "/graphql/execute.json/capella-hotels/ListCF";
var HCAPTCHA_API_SRC = "https://js.hcaptcha.com/1/api.js?render=explicit";
var REQUIRED_FIELDS = [
	"salutation",
	"firstName",
	"lastName",
	"email",
	"country"
];
var FORM_SOURCE = "Newsletter";
var GROUP_PROPERTY_CODE = "CHG";
var NON_HOTEL_PROPERTY_CODE = "CHR";
var ROW = {
	TITLE: 0,
	SALUTATION_LABEL: 1,
	SALUTATION_OPTIONS: 2,
	FIRST_NAME: 3,
	LAST_NAME: 4,
	EMAIL: 5,
	COUNTRY_LABEL: 6,
	COUNTRY_OPTIONS: 7,
	CONSENT: 8,
	SUBMIT: 9,
	PROPERTY_OPTIONS: 10,
	TRIGGER_LABEL: 11
};
/** Reads the trimmed text of an authored row's value cell. */
function rowText(rows, index) {
	return rows[index]?.querySelector(":scope > div")?.textContent?.trim() ?? "";
}
/** Reads the inner HTML of an authored row's value cell (for richtext). */
function rowHTML(rows, index) {
	return rows[index]?.querySelector(":scope > div")?.innerHTML?.trim() ?? "";
}
/**
* Reads a Content Fragment path from an `aem-content` row. The picker renders
* the selected path as a link; fall back to the cell's text if it is stored as
* plain text.
*/
function rowLink(rows, index) {
	const cell = rows[index]?.querySelector(":scope > div");
	if (!cell) return "";
	return (cell.querySelector("a")?.getAttribute("href") || cell.textContent || "").trim();
}
/**
* Normalises a single raw Content Fragment entry into a { value, label } pair.
* Accepts either a `Label|VALUE` string (e.g. `Singapore|SG` — the visible label
* first, the submitted value/code last; value optional) or an object using any
* of the common key names (value/code/key/id and label/name/title/text).
*/
function normalizeOption(item) {
	if (typeof item === "string") {
		const line = item.trim();
		if (!line) return null;
		const parts = line.split("|");
		const value = parts.pop()?.trim() ?? "";
		return {
			value,
			label: parts.length ? parts.join("|").trim() : value
		};
	}
	if (item && typeof item === "object") {
		const obj = item;
		const value = obj.value ?? obj.code ?? obj.key ?? obj.id ?? obj.label ?? obj.name ?? obj.title;
		if (value == null) return null;
		const label = obj.label ?? obj.name ?? obj.title ?? obj.text ?? value;
		return {
			value: String(value).trim(),
			label: String(label).trim()
		};
	}
	return null;
}
var OPTION_KEYS = [
	"options",
	"items",
	"elements",
	"values",
	"list",
	"salutations",
	"countries"
];
/**
* Extracts the raw list of option entries from the query response, tolerating
* the shapes AEM commonly returns: the GraphQL persisted-query envelope
* (`{ data: { <model>List: { items: [{ listItems: [...] }] } } }`), a bare
* array, a model field that is an array, a single multiline text field (one
* option per line), or the nested JCR export (`jcr:content/data/master`).
*/
function collectRawItems(data) {
	if (Array.isArray(data)) return data;
	if (!data || typeof data !== "object") return [];
	const obj = data;
	if (obj.data && typeof obj.data === "object") {
		const node = Object.values(obj.data).find((v) => v && typeof v === "object");
		const items = Array.isArray(node?.items) ? node.items : Object.values(obj.data).find((v) => Array.isArray(v));
		if (Array.isArray(items)) return items.flatMap((item) => {
			if (item && typeof item === "object") {
				const nested = Object.values(item).find((v) => Array.isArray(v));
				if (nested) return nested;
			}
			return item;
		});
	}
	const master = obj["jcr:content"]?.data?.master ?? obj.data?.master ?? obj;
	const arrayKey = OPTION_KEYS.find((key) => Array.isArray(master[key]));
	if (arrayKey) return master[arrayKey];
	const multiline = Object.values(master).find((v) => typeof v === "string" && v.includes("\n"));
	if (multiline) return multiline.split("\n");
	return Object.values(master).find((v) => Array.isArray(v)) ?? [];
}
/**
* Runs the `ListCF` persisted GraphQL query for a Content Fragment path and
* returns its raw list entries. Empty array when no path is authored or the
* query cannot be loaded/parsed.
*/
async function fetchRawList(path) {
	if (!path) return [];
	try {
		const cfPath = path.replace(/\.json$/, "");
		const url = `${getBasePathBasedOnEnv()}${OPTIONS_GRAPHQL_QUERY};path=${cfPath}`;
		const response = await fetch(url, { headers: { Accept: "application/json" } });
		if (!response.ok) return [];
		return collectRawItems(await response.json());
	} catch (error) {
		console.error("Newsletter list fetch error:", path, error);
		return [];
	}
}
/**
* Fetches dropdown options from a Content Fragment as { value, label } pairs.
*/
async function fetchOptions(path) {
	return (await fetchRawList(path)).map(normalizeOption).filter((opt) => !!opt && !!opt.value);
}
/**
* Normalises a raw property-mapping entry into { keys, name, code }. Accepts a
* pipe string in either the 2-part `KEYS|CODE` form or the legacy 3-part
* `KEYS|NAME|CODE` form — NAME is optional, only aids authoring readability, and
* is NOT submitted (only `code` is). KEYS may list several comma/space separated
* location keywords (e.g. `macau,macao|CPMAC`). Objects using
* keys/key/location + code/source (+ optional name) style fields also work.
*/
function normalizeProperty(item) {
	let keysRaw;
	let name = "";
	let code;
	if (typeof item === "string") {
		const parts = item.split("|").map((part) => part.trim());
		if (parts.length >= 3) [keysRaw, name, code] = [
			parts[0],
			parts[1] ?? "",
			parts[2]
		];
		else [keysRaw, code] = parts;
	} else if (item && typeof item === "object") {
		const obj = item;
		keysRaw = obj.keys ?? obj.key ?? obj.location ?? obj.slug;
		name = String(obj.name ?? obj.property ?? obj.title ?? obj.label ?? "");
		code = obj.code ?? obj.source ?? obj.value;
	}
	if (!code) return null;
	const keys = (Array.isArray(keysRaw) ? keysRaw.join(" ") : String(keysRaw ?? name)).toLowerCase().split(/[,\s/_-]+/).filter(Boolean);
	if (!keys.length) return null;
	return {
		keys,
		name: String(name).trim(),
		code: String(code).trim()
	};
}
/**
* Fetches the location → Property/Source mapping from a Content Fragment.
*/
async function fetchProperties(path) {
	return (await fetchRawList(path)).map(normalizeProperty).filter((p) => !!p);
}
/**
* Derives the Capella property from the current page URL by matching a known
* location keyword in the path against the authored mapping. The path is
* tokenised on slashes, hyphens and underscores, so a location matches whether
* it stands alone (`/bangkok`) or is part of a larger slug (`/capella-bangkok/`).
*/
function resolveProperty(properties) {
	if (!properties?.length) return null;
	const tokens = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase().split(/[/_-]+/).filter(Boolean);
	return properties.find(({ keys }) => keys.some((key) => tokens.includes(key))) ?? null;
}
/**
* Fallback `property` code for non-hotel pages (no specific hotel matched from
* the URL), evaluated in order:
*   1. A Residence(s) page without a country/hotel in the path → `CHR`
*      (Residences belong to Capella Hotels & Resorts), regardless of domain.
*   2. The Capella Hotel Group site (`capellahotelgroup.com`) → `CHG`.
*   3. Any other domain (e.g. `capellahotels.com`) → `CHR`.
*/
function resolveFallbackCode() {
	const tokens = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase().split(/[/_-]+/).filter(Boolean);
	if (tokens.includes("residences") || tokens.includes("residence")) return NON_HOTEL_PROPERTY_CODE;
	return (typeof window !== "undefined" ? window.location.hostname : "").toLowerCase().includes("capellahotelgroup") ? GROUP_PROPERTY_CODE : NON_HOTEL_PROPERTY_CODE;
}
/**
* Resolves the public hCaptcha site key. Prefers the per-environment value from
* `env.js` (the "environment variable" equivalent in EDS); falls back to the
* `hcaptcha-site-key` <meta> tag when no environment key is configured.
*/
function getHCaptchaSiteKey() {
	return getHCaptchaSiteKey$1() || document.head.querySelector("meta[name=\"hcaptcha-site-key\"]")?.content?.trim() || "";
}
var hcaptchaApiPromise;
/**
* Loads the hCaptcha JS API on demand and resolves with `window.hcaptcha`.
* Rejects if the script fails to load.
*/
function loadHCaptcha() {
	if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
	if (hcaptchaApiPromise) return hcaptchaApiPromise;
	hcaptchaApiPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = HCAPTCHA_API_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => window.hcaptcha ? resolve(window.hcaptcha) : reject(/* @__PURE__ */ new Error("hCaptcha API unavailable"));
		script.onerror = () => reject(/* @__PURE__ */ new Error("Failed to load hCaptcha API"));
		document.head.append(script);
	});
	return hcaptchaApiPromise;
}
/**
* Renders an hCaptcha widget into `container` and wires it to enable/disable the
* submit button. Returns a getter for the current token (empty when unsolved).
* On any failure the submit button is left enabled so the form still works —
* server-side verification remains the source of truth.
*/
async function setupCaptcha(container, siteKey, submitBtn) {
	let token = "";
	let widgetId;
	try {
		widgetId = (await loadHCaptcha()).render(container, {
			sitekey: siteKey,
			callback: (response) => {
				token = response;
				submitBtn.disabled = false;
			},
			"expired-callback": () => {
				token = "";
				submitBtn.disabled = true;
			},
			"error-callback": () => {
				token = "";
				submitBtn.disabled = true;
			}
		});
	} catch (error) {
		console.error("Newsletter captcha error:", error);
		submitBtn.disabled = false;
		return {
			getToken: () => "",
			reset: () => {}
		};
	}
	return {
		getToken: () => token,
		reset: () => {
			token = "";
			submitBtn.disabled = true;
			if (window.hcaptcha && widgetId !== void 0) window.hcaptcha.reset(widgetId);
		}
	};
}
/** Creates a labelled field wrapper containing the given input/select. */
function buildField(id, labelText, control, { required = true } = {}) {
	const wrapper = document.createElement("div");
	wrapper.className = "newsletter-field";
	const label = document.createElement("label");
	label.setAttribute("for", id);
	label.textContent = required ? `${labelText}*` : labelText;
	control.id = id;
	if (required) control.required = true;
	wrapper.append(label, control);
	return wrapper;
}
/** Builds a <select> from a list of { value, label } (or plain string) options. */
function buildSelect(name, placeholder, options) {
	const select = document.createElement("select");
	select.name = name;
	const blank = document.createElement("option");
	blank.value = "";
	blank.disabled = true;
	blank.selected = true;
	blank.textContent = placeholder;
	select.append(blank);
	options.forEach((opt) => {
		const value = typeof opt === "string" ? opt : opt.value;
		const text = typeof opt === "string" ? opt : opt.label;
		const option = document.createElement("option");
		option.value = value;
		option.textContent = text;
		select.append(option);
	});
	return select;
}
/** Builds a text/email input. */
function buildInput(name, type, placeholder) {
	const input = document.createElement("input");
	input.type = type;
	input.name = name;
	if (placeholder) input.placeholder = placeholder;
	return input;
}
/**
* Wraps the form in an overlay modal and returns the overlay plus its trigger
* button. A native <dialog>.showModal() is deliberately NOT used: a modal
* dialog renders in the browser "top layer", which paints above every
* normal-flow element regardless of z-index — including the hCaptcha challenge
* iframe hCaptcha appends to <body>. That made the captcha appear *behind* the
* form. A plain overlay keeps normal stacking so the challenge (max z-index)
* shows above the form. Closing is wired to: the ✕ button, a backdrop click,
* and the Escape key.
*/
function buildModal(form, triggerLabel, title) {
	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.className = "newsletter-trigger";
	trigger.textContent = triggerLabel;
	const overlay = document.createElement("div");
	overlay.className = "newsletter-overlay";
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
	overlay.setAttribute("aria-label", title);
	const panel = document.createElement("div");
	panel.className = "newsletter-dialog-panel";
	const closeBtn = document.createElement("button");
	closeBtn.type = "button";
	closeBtn.className = "newsletter-dialog-close";
	closeBtn.setAttribute("aria-label", "Close");
	closeBtn.innerHTML = "&times;";
	panel.append(closeBtn, form);
	overlay.append(panel);
	const open = () => {
		overlay.classList.add("is-open");
		document.body.classList.add("newsletter-modal-open");
		closeBtn.focus();
	};
	const close = () => {
		overlay.classList.remove("is-open");
		document.body.classList.remove("newsletter-modal-open");
		trigger.focus();
	};
	trigger.addEventListener("click", open);
	closeBtn.addEventListener("click", close);
	overlay.addEventListener("click", (event) => {
		if (event.target === overlay) close();
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
	});
	return {
		overlay,
		trigger
	};
}
/**
* Collects every form entry plus auto-mapped metadata and POSTs it as
* application/x-www-form-urlencoded (so the Sling servlet's getParameter()
* can read each field).
*/
async function submitForm(form, config, message, submitBtn) {
	const payload = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
	if (REQUIRED_FIELDS.filter((field) => !payload[field]).length) {
		message.textContent = "Please fill in all required fields.";
		message.className = "newsletter-message is-error";
		form.reportValidity();
		return;
	}
	const captchaToken = config.captcha ? config.captcha.getToken() : "";
	if (config.captcha && !captchaToken) {
		message.textContent = "Please complete the captcha.";
		message.className = "newsletter-message is-error";
		return;
	}
	if (captchaToken) payload.captchaValue = captchaToken;
	payload.language = ((document.documentElement.lang || getPageLang()).split("-")[0] ?? "").toLowerCase();
	const { property } = config;
	payload.property = property ? property.code : resolveFallbackCode();
	payload.source = FORM_SOURCE;
	message.textContent = "";
	message.className = "newsletter-message";
	submitBtn.disabled = true;
	try {
		const response = await fetch(config.endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				Accept: "application/json"
			},
			body: new URLSearchParams(payload).toString()
		});
		if (!response.ok) throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
		form.reset();
		message.textContent = "Thank you for subscribing!";
		message.classList.add("is-success");
		if (config.captcha) config.captcha.reset();
		else submitBtn.disabled = false;
	} catch (error) {
		message.textContent = "Sorry, something went wrong. Please try again.";
		message.classList.add("is-error");
		console.error("Newsletter submission error:", error);
		if (config.captcha) config.captcha.reset();
		else submitBtn.disabled = false;
	}
}
async function decorate(block) {
	const rows = [...block.children];
	const cfg = {
		title: rowText(rows, ROW.TITLE) || "Subscribe to our newsletter",
		salutationLabel: rowText(rows, ROW.SALUTATION_LABEL) || "Salutation",
		salutationPath: rowLink(rows, ROW.SALUTATION_OPTIONS),
		firstNameLabel: rowText(rows, ROW.FIRST_NAME) || "First Name",
		lastNameLabel: rowText(rows, ROW.LAST_NAME) || "Last Name",
		emailLabel: rowText(rows, ROW.EMAIL) || "Email Address",
		countryLabel: rowText(rows, ROW.COUNTRY_LABEL) || "Country",
		countryPath: rowLink(rows, ROW.COUNTRY_OPTIONS),
		consentHTML: rowHTML(rows, ROW.CONSENT),
		submitLabel: rowText(rows, ROW.SUBMIT) || "Continue",
		propertyPath: rowLink(rows, ROW.PROPERTY_OPTIONS),
		triggerLabel: rowText(rows, ROW.TRIGGER_LABEL) || "Subscribe"
	};
	const [salutationOptions, countryOptions, properties] = await Promise.all([
		fetchOptions(cfg.salutationPath),
		fetchOptions(cfg.countryPath),
		fetchProperties(cfg.propertyPath)
	]);
	const property = resolveProperty(properties);
	const form = document.createElement("form");
	form.className = "newsletter-form-element";
	form.noValidate = true;
	const title = document.createElement("h2");
	title.className = "newsletter-title";
	title.textContent = cfg.title;
	const salutation = buildField("newsletter-salutation", cfg.salutationLabel, buildSelect("salutation", "Select", salutationOptions));
	const firstName = buildField("newsletter-first-name", cfg.firstNameLabel, buildInput("firstName", "text", cfg.firstNameLabel));
	const lastName = buildField("newsletter-last-name", cfg.lastNameLabel, buildInput("lastName", "text", cfg.lastNameLabel));
	const nameRow = document.createElement("div");
	nameRow.className = "newsletter-name-row";
	nameRow.append(firstName, lastName);
	const email = buildField("newsletter-email", cfg.emailLabel, buildInput("email", "email", cfg.emailLabel));
	const country = buildField("newsletter-country", cfg.countryLabel, buildSelect("country", "Select", countryOptions));
	const consentWrapper = document.createElement("div");
	consentWrapper.className = "newsletter-consent";
	consentWrapper.innerHTML = cfg.consentHTML || "I would like to receive updates and offers from Capella Hotel Group via email or other electronic channels. <a href=\"/privacy\">View our Privacy Policy</a>.";
	const siteKey = getHCaptchaSiteKey();
	const captchaWrapper = document.createElement("div");
	captchaWrapper.className = "newsletter-captcha";
	const submitBtn = document.createElement("button");
	submitBtn.type = "submit";
	submitBtn.className = "newsletter-submit";
	submitBtn.textContent = cfg.submitLabel;
	if (siteKey) submitBtn.disabled = true;
	const message = document.createElement("div");
	message.className = "newsletter-message";
	message.setAttribute("aria-live", "polite");
	form.append(title, salutation, nameRow, email, country, consentWrapper, captchaWrapper, submitBtn, message);
	const captcha = siteKey ? await setupCaptcha(captchaWrapper, siteKey, submitBtn) : null;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}
		submitForm(form, {
			endpoint: API_ENDPOINT,
			property,
			captcha
		}, message, submitBtn);
	});
	const { overlay, trigger } = buildModal(form, cfg.triggerLabel, cfg.title);
	block.textContent = "";
	block.append(trigger, overlay);
}
//#endregion
export { decorate as default };
