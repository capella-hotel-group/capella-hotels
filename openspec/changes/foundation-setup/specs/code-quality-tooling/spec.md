## Purpose

Enforces consistent code style and commit hygiene across the TypeScript codebase by gating commits on linting, formatting, and Conventional Commits, so quality checks run automatically instead of relying on manual review.

## ADDED Requirements

### Requirement: TypeScript-aware linting

The system SHALL lint `.ts` sources using `typescript-eslint` combined with `eslint-plugin-xwalk`, and SHALL report a non-zero exit code when lint errors are present.

#### Scenario: Lint passes on clean sources

- **WHEN** `npm run lint` is executed against sources with no lint violations
- **THEN** the command SHALL exit with a zero status

#### Scenario: Lint fails on violation

- **WHEN** a `.ts` source file violates a configured ESLint rule and `npm run lint` is executed
- **THEN** the command SHALL exit with a non-zero status and SHALL report the violating file and rule

### Requirement: Formatting enforcement

The system SHALL provide a `npm run format:check` command, backed by Prettier configuration, that verifies all source files conform to the configured formatting rules and fails when they do not.

#### Scenario: Format check fails on unformatted file

- **WHEN** a source file is not formatted according to the Prettier configuration and `npm run format:check` is executed
- **THEN** the command SHALL exit with a non-zero status

### Requirement: Pre-commit enforcement

The system SHALL run `lint-staged` via a Husky pre-commit hook so that staged files are linted and format-checked before a commit is created, blocking the commit when checks fail.

#### Scenario: Commit is blocked by failing pre-commit checks

- **WHEN** a staged file fails lint or format checks and the user attempts to commit
- **THEN** the Husky pre-commit hook SHALL abort the commit before it is created

#### Scenario: Commit proceeds when checks pass

- **WHEN** all staged files pass lint and format checks and the user attempts to commit
- **THEN** the Husky pre-commit hook SHALL allow the commit to complete

### Requirement: Conventional Commits guidance

The project SHALL document the Conventional Commits format as the required commit message convention for contributors.

#### Scenario: Contributor consults commit message convention

- **WHEN** a contributor looks up the project's commit message requirements
- **THEN** documentation SHALL specify the Conventional Commits format as required
