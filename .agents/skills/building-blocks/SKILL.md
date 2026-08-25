---
name: building-blocks
description: "Use this when implementing code changes in AEM Edge Delivery Services (EDS, Franklin, Helix) for this project, whether new or modified blocks, core functionality (scripts.ts, styles, delayed.ts, etc.), or both. Adapted for this repo's src/ + Vite/TypeScript build pipeline: block source lives in src/blocks/, never in the generated blocks/ output. For the overall development process use content-driven-development."
license: Apache-2.0
metadata:
  version: '2.0.1-capella'
  adapted-from: 'adobe/skills building-blocks v2.0.1 — paths and examples adjusted for src/ + Vite/TypeScript pipeline'
---

# Building Blocks

This skill guides you through implementing AEM Edge Delivery blocks following established patterns and best practices, adapted for this project's TypeScript/Vite source pipeline. Blocks transform authored content into rich, interactive experiences through TypeScript decoration and CSS styling.

**IMPORTANT: This skill should ONLY be invoked from the content-driven-development skill during Step 5 (Implementation).**

If you are not already following the CDD process, STOP and invoke the **content-driven-development** skill first.

## Related Skills

- **content-driven-development**: MUST be invoked before using this skill to ensure content and content models are ready
- **block-collection-and-party**: Use to find similar blocks for patterns
- **testing-blocks**: Automatically invoked during Step 5 for comprehensive testing

## When to Use This Skill

This skill is invoked automatically by **content-driven-development** during Step 5 (Implementation). It handles:

**Block Development:**

- Creating new block files and structure
- Implementing JavaScript decoration
- Adding CSS styling

**Core Functionality:**

- `src/app/scripts.ts` modifications (decoration, utilities, auto-blocking) — compiles to `scripts/scripts.js`
- Global styles (`src/styles/styles.css`, `src/styles/lazy-styles.css`) — compile to `styles/`
- Delayed functionality (`src/app/delayed.ts`) — compiles to `scripts/delayed.js`
- Configuration changes (`src/configs/`)
- **Never hand-edit the generated `scripts/`, `styles/`, or `blocks/` output directly — always edit under `src/` and let the Vite/tsc build regenerate it.**

**Combined:**

- Blocks with supporting core changes (utilities, global styles, etc.)

Prerequisites (verified by CDD):

- ✅ Test content exists (in CMS or local drafts)
- ✅ Content model is defined/documented (if applicable)
- ✅ Test content URL is available
- ✅ Dev server is running

## Block Implementation Workflow

Track your progress:

- [ ] Step 1: Find similar blocks for patterns (if new block or major changes)
- [ ] Step 2: Create or modify block structure (files and directories)
- [ ] Step 3: Implement JavaScript decoration (skip if CSS-only)
- [ ] Step 4: Add CSS styling
- [ ] Step 5: Test implementation (invokes testing-blocks skill)

**Note:** If your changes require core modifications (utilities in scripts.js, global styles, etc.), make those changes first, test them, then return to this workflow. See "When Modifying Core Files" below.

## Step 1: Find Similar Blocks

**When to use:** Creating new blocks or making major structural modifications

**Skip this step when:** Making minor modifications to existing blocks (CSS tweaks, small decoration changes)

**Quick start:**

1. Search the codebase for similar blocks:

   ```bash
   ls src/blocks/
   ```

2. Use the **block-collection-and-party** skill to find reference implementations

3. Review patterns from similar blocks:
   - DOM manipulation strategies
   - CSS architecture
   - Variant handling
   - Performance optimizations

## Step 2: Create or Modify Block Structure

### For New Blocks:

1. Create the block source directory and files **under `src/blocks/`, never under `blocks/`**:

   ```bash
   mkdir -p src/blocks/{block-name}
   touch src/blocks/{block-name}/{block-name}.ts
   touch src/blocks/{block-name}/{block-name}.css
   touch src/blocks/{block-name}/_{block-name}.json
   ```

2. Basic TypeScript structure (strict mode, no implicit `any`):

   ```typescript
   export default function decorate(block: HTMLElement): void {
     // Your decoration logic here
   }
   ```

3. Basic CSS structure:

   ```css
   /* All selectors scoped to block */
   main .{block-name} {
     /* block styles */
   }
   ```

4. `_{block-name}.json` holds the distributed UE component config for this block (definitions/models/filters) — see the **ue-component-model** skill (adapted for this project) for its shape. After creating or editing it, run:
   ```bash
   npm run build:json
   ```
   to regenerate the aggregated root `component-definition.json` / `component-models.json` / `component-filters.json`. **Never hand-edit those root files directly.**

### For Existing Blocks:

1. Locate the block **source** directory: `src/blocks/{block-name}/` (NOT `blocks/{block-name}/` — that's generated output)
2. Review current implementation:
   ```bash
   # View the initial HTML structure from the server
   curl http://localhost:3000/{test-content-path}
   ```
3. Understand existing decoration logic and styles by reading the `.ts`/`.css` files in `src/blocks/{block-name}/`

## Step 3: Implement JavaScript Decoration

**Essential pattern - re-use existing DOM elements:**

```typescript
import { createOptimizedPicture } from '@/app/aem.js';

export default function decorate(block: HTMLElement): void {
  // Platform delivers images as <picture> elements with <source> tags
  const picture = block.querySelector('picture');
  const heading = block.querySelector('h2');

  // Create new structure, re-using existing elements
  const figure = document.createElement('figure');
  if (picture) figure.append(picture); // Re-uses picture element

  const wrapper = document.createElement('div');
  wrapper.className = 'content-wrapper';
  if (heading) wrapper.append(heading);
  wrapper.append(figure);

  block.replaceChildren(wrapper);

  // Only check variants when they affect decoration logic
  // CSS-only variants like 'dark', 'wide' don't need TS
  if (block.classList.contains('carousel')) {
    // Carousel variant needs different DOM structure/behavior
    setupCarousel(block);
  }
}
```

Use the `@/*` path alias (maps to `src/*`) for cross-module imports, per this project's conventions (see AGENTS.md). Reuse existing helpers from `src/app/aem.js` / `src/app/scripts.js` (e.g. `createOptimizedPicture`, `moveInstrumentation`) instead of re-implementing them — check other blocks under `src/blocks/` first.

**For complete JavaScript guidelines including:**

- Advanced DOM manipulation patterns
- Fetching data and loading modules
- Performance optimization techniques
- Helper functions from aem.js
- Code style and linting rules

**Read [references/js-guidelines.md](references/js-guidelines.md)**

## Step 4: Add CSS Styling

**Essential patterns - scoped, responsive, using custom properties:**

```css
/* All selectors MUST be scoped to block */
main .my-block {
  /* Use CSS custom properties for consistency */
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--body-font-family);
  max-width: var(--max-content-width);

  /* Mobile-first styles (default) */
  padding: 1rem;
  flex-direction: column;
}

main .my-block h2 {
  font-family: var(--heading-font-family);
  font-size: var(--heading-font-size-m);
}

main .my-block .item {
  display: flex;
  gap: 1rem;
}

/* Tablet and up (768px - see --breakpoint-tablet-min in src/styles/tokens.css) */
@media (width >= 768px) {
  main .my-block {
    padding: 2rem;
  }
}

/* Desktop and up (1200px - see --breakpoint-desktop-min in src/styles/tokens.css) */
@media (width >= 1200px) {
  main .my-block {
    flex-direction: row;
    padding: 4rem;
  }
}

/* Variants - most are CSS-only */
main .my-block.dark {
  background-color: var(--dark-color);
  color: var(--clr-white);
}
```

**For complete CSS guidelines including:**

- All available CSS custom properties
- Modern CSS features (grid, logical properties, etc.)
- Performance optimization
- Naming conventions
- Common patterns and anti-patterns

**Read [references/css-guidelines.md](references/css-guidelines.md)**

**Note on iterative validation:** While building, you can test changes in your browser as you go (load test content URL, check console, verify layout and functionality). Remember that `src/blocks/**/*.ts` and `src/blocks/**/*.css` changes only take effect after the Vite watch build recompiles them into `blocks/` — check that `npm start` (or a running `tsc --watch`/Vite watch process) has picked up the change before testing. For comprehensive testing guidance including browser testing techniques, responsive testing, and validation approaches, see the testing-blocks skill invoked in Step 5.

## Step 5: Test Implementation

**After implementation is complete, invoke the testing-blocks skill.**

The testing-blocks skill will guide you through:

- Browser testing (functionality, responsive behavior across viewports)
- Linting and fixing issues
- Writing unit tests for logic-heavy utilities (if needed)
- Screenshot capture for validation
- Performance validation

**Provide the testing-blocks skill with:**

- Block name being tested
- Test content URL(s) (from step 4 of CDD process)
- Any variants that need testing
- Screenshots of existing implementation/design/mockup to verify against
- Acceptance criteria to verify (from step 2 of CDD process)

**After testing is complete, return to CDD workflow.**

---

## When Modifying Core Files

If your changes require modifying core files (`src/app/scripts.ts`, `src/styles/styles.css`, `src/app/delayed.ts`), follow these principles:

**Common core files (all under `src/`, never edit the generated `scripts/`/`styles/` output):**

- **src/app/scripts.ts** - Decoration utilities, auto-blocking logic, page loading
- **src/styles/styles.css** - Global styles (eager), CSS custom properties (see `src/styles/tokens.css` for design tokens)
- **src/styles/lazy-styles.css** - Global styles (lazy loaded)
- **src/app/delayed.ts** - Marketing, analytics, third-party integrations

**Key principles:**

1. **Make core changes first** (before block changes that depend on them)
2. **Test core changes independently** with existing content before using in blocks
3. **Consider impact** - core changes can affect multiple blocks/pages
4. **Test thoroughly** - verify no regressions in existing functionality
5. **Keep it minimal** - only add what's necessary
6. **Document with code comments** - most core changes don't need separate docs

**Testing core changes:**

- Test with existing content URLs that use affected functionality
- For auto-blocking: test pages that should/shouldn't trigger it
- For global styles: test across multiple blocks and pages
- Check console for errors
- Verify responsive behavior

**For detailed patterns:**

- JavaScript: See [references/js-guidelines.md](references/js-guidelines.md)
- CSS: See [references/css-guidelines.md](references/css-guidelines.md)

---

## Reference Materials

- [references/js-guidelines.md](references/js-guidelines.md) - Complete JavaScript patterns and best practices
- [references/css-guidelines.md](references/css-guidelines.md) - Complete CSS patterns and best practices
