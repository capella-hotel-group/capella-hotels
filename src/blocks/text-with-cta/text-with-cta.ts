import { moveInstrumentation } from '@/app/scripts.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';
import { isUniversalEditor } from '@/utils/env.js';

const BLOCK = 'text-with-cta';
const ITEM_MODEL = 'text-with-cta-signup-form';
const MOTION_MS = 320;

/** Field index inside a sign-up form item row — one cell per model field. */
const FIELD = {
  triggerLabel: 0,
  salutationLabel: 1,
  salutationOptions: 2,
  firstNameLabel: 3,
  lastNameLabel: 4,
  countryLabel: 5,
  emailLabel: 6,
  consentLabel: 7,
  submitLabel: 8,
  successMessage: 9,
} as const;

let uid = 0;

const textOf = (cell?: Element | null): string => cell?.textContent?.trim() || '';

/** Cells are always divs; a richtext field can emit bare paragraphs onto its row. */
const cellsOf = (row: HTMLElement): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(':scope > div')];

/** The row's single content cell, or the row itself when the field emitted bare nodes. */
const contentOf = (row?: HTMLElement): Element | undefined => (row ? cellsOf(row)[0] || row : undefined);

/**
 * Every block-level field emits exactly one cell, so only item rows hold several.
 * Item rows also carry their model in the editor, which wins when present.
 */
function findItemRows(rows: HTMLElement[]): HTMLElement[] {
  if (rows.some((row) => row.dataset.aueModel)) {
    return rows.filter((row) => row.dataset.aueModel === ITEM_MODEL);
  }
  return rows.filter((row) => cellsOf(row).length > 1);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

interface TextField {
  name: string;
  label: string;
  type: 'text' | 'email';
  autocomplete: AutoFill;
}

/**
 * Renders one underlined field. The design shows the label inside the field, so the
 * visible text is the placeholder and the real <label> is kept for screen readers.
 */
function buildTextField(field: TextField, formId: string): HTMLElement {
  const wrapper = el('div', `${BLOCK}-field`);
  const id = `${formId}-${field.name}`;

  const label = el('label', `${BLOCK}-field-label`, field.label);
  label.htmlFor = id;

  const input = el('input', `${BLOCK}-field-control`);
  input.id = id;
  input.name = field.name;
  input.type = field.type;
  input.placeholder = field.label;
  input.autocomplete = field.autocomplete;
  input.required = true;

  wrapper.append(label, input);
  return wrapper;
}

function buildSelectField(label: string, options: string[], formId: string): HTMLElement {
  const wrapper = el('div', `${BLOCK}-field ${BLOCK}-field-select`);
  const id = `${formId}-salutation`;

  const fieldLabel = el('label', `${BLOCK}-field-label`, label);
  fieldLabel.htmlFor = id;

  const select = el('select', `${BLOCK}-field-control`);
  select.id = id;
  select.name = 'salutation';
  select.required = true;

  const placeholder = el('option', undefined, label);
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  options.forEach((option) => {
    const item = el('option', undefined, option);
    item.value = option;
    select.append(item);
  });

  wrapper.append(fieldLabel, select);
  return wrapper;
}

/** Consent row: the authored rich text is moved in as-is so its links survive. */
function buildConsent(source: Element | undefined, formId: string): HTMLElement {
  const wrapper = el('div', `${BLOCK}-consent`);
  const id = `${formId}-consent`;

  const input = el('input', `${BLOCK}-consent-control`);
  input.id = id;
  input.type = 'checkbox';
  input.name = 'consent';
  input.required = true;

  const label = el('label', `${BLOCK}-consent-label`);
  label.htmlFor = id;
  if (source) label.append(...source.childNodes);

  wrapper.append(input, label);
  return wrapper;
}

function buildRow(modifier: string, fields: HTMLElement[]): HTMLElement {
  const row = el('div', `${BLOCK}-form-row ${BLOCK}-form-row-${modifier}`);
  row.append(...fields);
  return row;
}

function wireDisclosure(trigger: HTMLButtonElement, form: HTMLFormElement, panel: HTMLElement): void {
  let running: Animation | null = null;

  /**
   * Swaps the state first, then animates the panel between the height it had and
   * the height it ends up with, so the surrounding layout is never resized in one
   * step and the collapsed/expanded heights stay whatever the content needs.
   */
  const setExpanded = (expanded: boolean, animate: boolean): void => {
    const from = panel.getBoundingClientRect().height;

    trigger.setAttribute('aria-expanded', String(expanded));
    panel.classList.toggle('is-expanded', expanded);
    form.hidden = !expanded;

    running?.cancel();
    running = null;
    if (!animate) return;

    const to = panel.getBoundingClientRect().height;
    if (from === to) return;

    panel.style.overflow = 'hidden';
    running = panel.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: MOTION_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    form.animate({ opacity: expanded ? [0, 1] : [1, 0] }, { duration: MOTION_MS, easing: 'ease' });

    running.finished
      .then(() => {
        panel.style.overflow = '';
        running = null;
      })
      .catch(() => {});
  };

  const animates = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  trigger.addEventListener('click', () => {
    setExpanded(trigger.getAttribute('aria-expanded') !== 'true', animates());
    if (!form.hidden) form.querySelector<HTMLElement>('select, input')?.focus({ preventScroll: true });
  });

  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setExpanded(false, animates());
    trigger.focus();
  });

  // The authoring iframe has no way to click through to the expanded state.
  setExpanded(isUniversalEditor(), false);
}

function buildSignupForm(row: Element): HTMLElement {
  const cells = [...row.children];
  const formId = `${BLOCK}-form-${(uid += 1)}`;
  const label = (index: number, fallback: string): string => textOf(cells[index]) || fallback;

  const panel = el('div', `${BLOCK}-signup`);
  moveInstrumentation(row, panel);

  const trigger = el('button', `${BLOCK}-trigger`, label(FIELD.triggerLabel, 'Join now'));
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', formId);

  const form = el('form', `${BLOCK}-form`);
  form.id = formId;
  form.noValidate = false;

  const fields = el('div', `${BLOCK}-form-fields`);
  const salutationOptions = label(FIELD.salutationOptions, '')
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);

  fields.append(
    buildRow('three', [
      buildSelectField(label(FIELD.salutationLabel, 'Title'), salutationOptions, formId),
      buildTextField(
        {
          name: 'firstName',
          label: label(FIELD.firstNameLabel, 'First name'),
          type: 'text',
          autocomplete: 'given-name',
        },
        formId,
      ),
      buildTextField(
        { name: 'lastName', label: label(FIELD.lastNameLabel, 'Last name'), type: 'text', autocomplete: 'family-name' },
        formId,
      ),
    ]),
    buildRow('two', [
      buildTextField(
        { name: 'country', label: label(FIELD.countryLabel, 'Country'), type: 'text', autocomplete: 'country-name' },
        formId,
      ),
      buildTextField(
        { name: 'email', label: label(FIELD.emailLabel, 'Email'), type: 'email', autocomplete: 'email' },
        formId,
      ),
    ]),
    buildConsent(cells[FIELD.consentLabel], formId),
  );

  const submit = el('button', `${BLOCK}-submit`, label(FIELD.submitLabel, 'Sign up'));
  submit.type = 'submit';

  const status = el('p', `${BLOCK}-status`);
  status.setAttribute('role', 'status');

  form.append(fields, submit, status);
  panel.append(trigger, form);

  const successMessage = label(FIELD.successMessage, '');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = successMessage;
    form.reset();
  });

  wireDisclosure(trigger, form, panel);
  return panel;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const itemRows = findItemRows(rows);
  const [titleRow, descriptionRow] = applyBlockIdentity(
    block,
    rows.filter((row) => !itemRows.includes(row)),
    { contentRows: 2 },
  );

  const text = el('div', `${BLOCK}-text`);

  const titleCell = contentOf(titleRow);
  if (titleCell) {
    titleCell.classList.add(`${BLOCK}-title`);
    text.append(titleCell);
  }

  const descriptionCell = contentOf(descriptionRow);
  if (descriptionCell) {
    descriptionCell.classList.add(`${BLOCK}-description`);
    text.append(descriptionCell);
  }

  const aside = el('div', `${BLOCK}-aside`);
  itemRows.forEach((row) => aside.append(buildSignupForm(row)));

  block.textContent = '';
  block.append(text, aside);
}
