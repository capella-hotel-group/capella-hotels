## 1. Authoring model

- [ ] 1.1 Create `src/blocks/destination-introduction/_destination-introduction.json` with the `destination-introduction` definition using resource type `core/franklin/components/block/v1/block`, referencing both `model` and `filter` in its template
- [ ] 1.2 Add the `destination-introduction-image` definition using resource type `core/franklin/components/block/v1/block/item`, referencing only its `model` in the template
- [ ] 1.3 Add the `destination-introduction` model with fields in order: `eyebrow` (text), `title` (richtext), `body` (richtext), `footerCta` (richtext), all with `valueType` `string` and none marked `required`
- [ ] 1.4 Add the `destination-introduction-image` model with `image` (reference, `multi` false) and `imageAlt` (text), neither marked `required`
- [ ] 1.5 Add the `destination-introduction` filter listing `destination-introduction-image` as its only component
- [ ] 1.6 Add `destination-introduction` to the `section` filter component list in `src/models/_section.json`

## 2. Stub block implementation

- [ ] 2.1 Create `src/blocks/destination-introduction/destination-introduction.ts` exporting a default `decorate` function that reads copy fields at fixed indices 0 to 3 and treats `rows.slice(4)` as gallery items, with a short comment recording that the indices mirror the model field order
- [ ] 2.2 Ensure the stub preserves Universal Editor instrumentation via `moveInstrumentation` for any element it relocates, tolerates a missing trailing row, and handles every field being empty without throwing
- [ ] 2.3 Create `src/blocks/destination-introduction/destination-introduction.css` with block-scoped selectors only, establishing the class hook without implementing gallery layout

## 3. Build and generated output

- [ ] 3.1 Run `npm run build:json` and confirm `component-definition.json`, `component-models.json`, and `component-filters.json` each contain the new entries
- [ ] 3.2 Run `npm run build` and confirm `blocks/destination-introduction/destination-introduction.js` and `.css` are generated
- [ ] 3.3 Run `npm run lint` and resolve any xwalk model rule violations

## 4. Validation

- [ ] 4.1 Create a test HTML file under `drafts/` covering a fully populated block instance, matching the row contract in the spec
- [ ] 4.2 Add draft variants for the empty-copy and no-images cases and confirm the page renders without a JavaScript error
- [ ] 4.3 Start the dev server with `--html-folder drafts` and inspect the delivered markup with `curl` to verify the row contract: four copy rows followed by one single-cell row per gallery image
- [ ] 4.4 Verify in Universal Editor that the block is insertable into a section, that the Add action offers "Destination Introduction Image", and that individual gallery items remain selectable after decoration

## 5. Wrap-up

- [ ] 5.1 Confirm no shared script, style, or existing block was modified beyond the `_section.json` filter entry
- [ ] 5.2 Open a pull request including a preview URL for a page demonstrating the block
