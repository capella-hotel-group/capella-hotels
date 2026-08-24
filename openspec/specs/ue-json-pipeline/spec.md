## Purpose

Merges per-model Universal Editor JSON fragments authored under the source tree into the three root-level JSON files (`component-definition.json`, `component-models.json`, `component-filters.json`) that Universal Editor reads, keeping fragment authoring decoupled from the consolidated files UE requires.

## Requirements

### Requirement: JSON fragment merge to root outputs
The system SHALL provide an `npm run build:json` command that merges the `_component-definition.json`, `_component-models.json`, and `_component-filters.json` fragment sources into `component-definition.json`, `component-models.json`, and `component-filters.json` at the repository root.

#### Scenario: Running build:json produces all three root files
- **WHEN** `npm run build:json` is executed
- **THEN** `component-definition.json`, `component-models.json`, and `component-filters.json` SHALL exist at the repository root and SHALL each reflect the current content of their respective fragment sources

### Requirement: Fragment source relocation
The fragment sources consumed by the merge pipeline SHALL live under the project's `src/models/` directory rather than the legacy root-level `models/` directory, without changing the shape of the merged output.

#### Scenario: Fragments under src/models are merged
- **WHEN** a fragment file under `src/models/` is edited and `npm run build:json` is run
- **THEN** the corresponding root JSON output file SHALL contain the edited content

### Requirement: Merge failure surfaces errors
The merge pipeline SHALL fail with a non-zero exit code and a descriptive error when a fragment file contains invalid JSON, rather than silently producing an incomplete or malformed root file.

#### Scenario: Invalid fragment JSON blocks the merge
- **WHEN** a fragment file under `src/models/` contains invalid JSON and `npm run build:json` is executed
- **THEN** the command SHALL exit with a non-zero status and SHALL NOT overwrite the previously valid root JSON output file

### Requirement: Shared and per-block fragment inclusion
The root fragment files SHALL continue to include the shared field-model fragments (`_button.json`, `_image.json`, `_page.json`, `_section.json`, `_text.json`, `_title.json`) and each block's own `_<name>.json` model fragment via their existing relative include paths, without requiring those paths to be rewritten after the source layout moves under `src/`.

#### Scenario: Shared field fragment change is reflected in merged output
- **WHEN** a shared field fragment such as `src/models/_button.json` is edited and `npm run build:json` is executed
- **THEN** the change SHALL be reflected in the merged root JSON file(s) that include it

#### Scenario: New block's model fragment is picked up automatically
- **WHEN** a new block is added with its own `src/blocks/<new-block>/_<new-block>.json` model fragment, and no root fragment file is edited
- **THEN** running `npm run build:json` SHALL include that block's fragment content in the merged root JSON output
