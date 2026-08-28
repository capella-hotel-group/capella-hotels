function isEditorBlock(block: HTMLElement): boolean {
  return block.hasAttribute('data-aue-resource') || Boolean(block.closest('[data-aue-resource]'));
}

function getContentCell(block: HTMLElement): HTMLElement | null {
  const row = block.querySelector(':scope > div');
  return (row?.querySelector(':scope > div') as HTMLElement | null) || (row as HTMLElement | null);
}

function copyScriptAttributes(source: HTMLScriptElement, target: HTMLScriptElement): void {
  [...source.attributes].forEach(({ name, value }) => target.setAttribute(name, value));
}

async function replaceScript(script: HTMLScriptElement): Promise<void> {
  const replacement = document.createElement('script');
  copyScriptAttributes(script, replacement);
  replacement.textContent = script.textContent;

  if (script.src) {
    const loaded = new Promise<void>((resolve, reject) => {
      replacement.onload = () => resolve();
      replacement.onerror = () => reject(new Error(`Failed to load ${script.src}`));
    });
    script.replaceWith(replacement);
    await loaded;
    return;
  }

  script.replaceWith(replacement);
}

async function renderCodeBlock(code: HTMLElement): Promise<void> {
  const rawHtml = code.textContent?.trim() || '';
  if (!rawHtml.startsWith('<')) return;

  const parsed = new DOMParser().parseFromString(rawHtml, 'text/html');
  const content = document.createElement('div');
  content.className = 'rte-html-content';
  content.append(...parsed.body.childNodes);

  const scripts = [...content.querySelectorAll('script')];
  code.parentElement?.replaceWith(content);
  for (const script of scripts) await replaceScript(script);
}

export default async function decorate(block: HTMLElement): Promise<void> {
  if (isEditorBlock(block)) return;

  const contentCell = getContentCell(block);
  if (!contentCell) return;

  const codeBlocks = [...contentCell.querySelectorAll(':scope pre > code')];
  for (const code of codeBlocks) await renderCodeBlock(code as HTMLElement);
}
