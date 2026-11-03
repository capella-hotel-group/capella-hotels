/** The first-section hero carries the page's h1, unless the authored content already has one. */
export function ownsPageHeading(block: HTMLElement): boolean {
  const section = block.closest('.section');
  return !!section && section === document.querySelector('main .section') && !document.querySelector('main h1');
}
