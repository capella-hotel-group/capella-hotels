// src/blocks/hero-video/lib/analytics.ts

function emit(eventName: string, detail: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
}

export function emitHeroImpression(blockId: string, item: string): void {
  emit('hero-video:impression', { blockId, item });
}

export function emitItemSelect(
  previousItem: string,
  newItem: string,
  inputSource: 'pointer' | 'keyboard' | 'touch',
): void {
  emit('hero-video:item-select', { previousItem, newItem, inputSource });
}

export function emitMediaError(item: string, mediaUrl: string, errorType: string): void {
  emit('hero-video:media-error', { item, mediaUrl, errorType });
}
