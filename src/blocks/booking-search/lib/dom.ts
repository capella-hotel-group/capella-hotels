let uid = 0;

/** Per-page counter so ids stay unique when several booking bars share a page. */
export const nextId = (): number => (uid += 1);

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
