// Rendering intentionally disabled: renders the plain authored HTML as-is so FE
// can style/script the new block model from scratch. Previous implementation
// (targeted the legacy fixed-4-section model) is recoverable from git history.
export default function decorate(_block: HTMLElement): void {
  // no-op
}
