# Capella Hotels

Website for Capella Hotels & Resorts, built on Adobe Edge Delivery Services (EDS) with AEM Sites as a Cloud Service and the Universal Editor (xwalk) authoring experience.

## Environments

- Preview: https://main--capella-hotels--capella-hotel-group.aem.page/
- Live: https://main--capella-hotels--capella-hotel-group.aem.live/
- Feature branch preview: https://{branch}--capella-hotels--capella-hotel-group.aem.page/

## Prerequisites

- Node.js 18.3.x or newer
- AEM Cloud Service release 2024.8 or newer (>= `17465`)

## Getting started

```sh
npm install
npm start
```

`npm start` type-checks and builds `src/` on watch, and starts the AEM CLI dev server at `http://localhost:3000`.

## Common scripts

- `npm run build` – type-check and build the runtime + editor bundles from `src/` into `scripts/`, `styles/`, `blocks/*`
- `npm run build:json` – regenerate `component-definition.json`, `component-models.json`, `component-filters.json` from `src/models/`
- `npm run lint` / `npm run lint:fix` – ESLint (flat config, includes xwalk component-model rules)
- `npm run format:check` / `npm run format:fix` – Prettier

## Documentation

- [AGENTS.md](./AGENTS.md) – project structure, conventions, and workflow for contributors and AI agents
- [docs/](./docs) – topic guides (RTL/Arabic CSS, header/footer fragment resolution, header nav authoring)
- Edge Delivery Services docs: https://www.aem.live/docs/
