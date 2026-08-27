# Development Guide

Start here if you're a developer (human or AI agent) about to work in this repo. This is a summary and index — for the full details it links out to [README.md](./README.md) (environments, scripts) and [AGENTS.md](./AGENTS.md) (project structure, coding conventions, block anatomy, publishing process).

## Prerequisites

- Node.js 24.x and npm 11.x (pinned in `.nvmrc` and `package.json#engines`; run `nvm use` if you have nvm)
- `@adobe/aem-cli` installed globally (`npm install -g @adobe/aem-cli`) — it's not a project dependency, but `npm start` and the `aem:up` script call the `aem` binary directly, so it must be resolvable on your `PATH`
- [GitHub CLI](https://cli.github.com/) (`gh`) — used to check PR/CI status before requesting review

## First-time setup

```sh
npm install
npm start
```

`npm start` runs three things in parallel: `tsc --watch` (type-check only), a Vite watch build of `src/` into `scripts/`, `styles/`, `blocks/*`, and the AEM CLI dev server. Open `http://localhost:3000` — it auto-reloads as you edit files under `src/`.

See [README.md](./README.md#common-scripts) for the full list of npm scripts (`build`, `build:json`, `lint`, `format:check`, etc.).

## Day-to-day workflow (git & PRs)

- Branch off `main`. There's no enforced branch naming convention yet.
- No commit-msg hook is configured, so there's no enforced commit message format.
- There's no `.github/pull_request_template.md` yet, but per [AGENTS.md § Publishing Process](./AGENTS.md#publishing-process) every PR description must link to the `.aem.page` feature preview URL for a page that demonstrates your change — PRs without it will be rejected.
- Before requesting review, run `gh pr checks` to confirm CI is green — CI (`.github/workflows/main.yaml`) runs `npm ci && npm run lint` on every push.

See [AGENTS.md § Deployment](./AGENTS.md#deployment) for the full publishing process (feature preview → PageSpeed check → PR → merge).

## Working with blocks & content locally

The dev server serves your local (even uncommitted) code, but content comes from pages previewed by authors in AEM. To test without authored content, create static HTML files:

```sh
mkdir drafts
# add drafts/my-page.html following AEM markup conventions (see AGENTS.md § Content)
npx @adobe/aem-cli up --no-open --html-folder drafts
```

Inspect any page's markup and structure with:

```sh
curl http://localhost:3000/path/to/page             # rendered HTML
curl http://localhost:3000/path/to/page.md          # markdown view
curl http://localhost:3000/path/to/page.plain.html  # source markup EDS parses into blocks/sections
```

See [AGENTS.md § Content](./AGENTS.md#content) and [§ Blocks](./AGENTS.md#blocks) for markup structure and block anatomy.

## Coding conventions (summary)

- **TypeScript**: source lives under `src/` (strict mode), compiled by Vite into the plain-JS runtime — never hand-edit generated files. Use the `@/*` path alias for cross-module imports.
- **CSS**: mobile-first, `min-width` media queries at the `--breakpoint-*` tokens (`src/styles/tokens.css`); scope every selector to the block (`.{blockname} .item`, not `.item`); avoid `{blockname}-container`/`{blockname}-wrapper` class names.
- **HTML**: semantic HTML5, proper heading hierarchy, ARIA labels.

Full rules: [AGENTS.md § Code Style Guidelines](./AGENTS.md#code-style-guidelines).

## Quality gates before pushing

- `npm run lint` / `npm run lint:fix` — ESLint (flat config, includes xwalk component-model rules)
- `npm run format:check` / `npm run format:fix` — Prettier
- `npm run build` — type-checks and builds the runtime + editor bundles; catches `tsc` errors that watch mode might not surface clearly
- Husky's pre-commit hook (`.husky/pre-commit`, via lint-staged) already runs ESLint + Prettier on staged files — don't bypass it with `--no-verify`
- CI runs `npm ci && npm run lint` on every push ([.github/workflows/main.yaml](./.github/workflows/main.yaml))

## Troubleshooting

- **`npm install` fails resolving `eslint-plugin-xwalk`**: it's a git dependency (`github:adobe-rnd/eslint-plugin-xwalk`). If git/SSH fetches are blocked (corporate proxy, firewall, or a restricted sandbox), the install fails even for unrelated packages. You need working git access to install dependencies.
- **Edits to `scripts/`, `styles/`, `blocks/*.js`/`*.css`, or `component-*.json` disappear**: those are generated output. Always edit under `src/` — for the JSON models, edit `src/models/_*.json` (or the block's `src/blocks/{blockname}/_{blockname}.json`) and run `npm run build:json`.
- **Vite prints a warning about `outDir: '.'`**: expected and harmless — writing build output to the repo root is an intentional design choice.

## Where to get help

- [AGENTS.md § Getting Help](./AGENTS.md#getting-help) — Edge Delivery Services docs, developer tutorial, David's Model
- Search the full aem.live docs index: `curl -s https://www.aem.live/docpages-index.json | jq -r '.data[] | select(.content | test("KEYWORD"; "i")) | "\(.path): \(.title)"'`
