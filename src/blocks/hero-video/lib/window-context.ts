export function isEmbeddedInIframe(win: Window = window): boolean {
  return win.self !== win.top;
}
