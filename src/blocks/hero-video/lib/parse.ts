import { resolveDAMUrl } from '@/utils/env';
import type { HeroVideoItem } from './types';

function hasField(cell: HTMLElement, name: string): boolean {
  const selector = `[data-aue-prop="${name}"]`;
  return cell.matches(selector) || Boolean(cell.querySelector(selector));
}

function isBooleanText(value: string): boolean {
  return /^(true|false|yes|no)$/i.test(value);
}

function isEnabled(value: string): boolean {
  return /^(true|yes)$/i.test(value);
}

export function parseItems(itemRows: HTMLElement[]): HeroVideoItem[] {
  const cellText = (cell?: Element | null): string => cell?.textContent?.trim() ?? '';
  const cellHref = (cell?: Element | null): string =>
    cell?.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')?.trim() ?? '';
  const cellUrl = (cell?: Element | null): string => {
    const href = cellHref(cell);
    if (href) return href;
    const text = cellText(cell);
    return /^https?:\/\//i.test(text) || text.startsWith('/') ? text : '';
  };
  const looksLikeVideoReference = (value: string): boolean =>
    /\.(mp4|m4v|mov|ogv|ogg|webm|m3u8)(?:[?#].*)?$/i.test(value);

  // Keep every authored item, including empty rows added in Universal Editor.
  return itemRows.map((row): HeroVideoItem => {
    const cells = [...row.children] as HTMLElement[];
    const label = cellText(cells[0]) || 'New destination';
    const otherCells = cells.slice(1);
    const posterCell = otherCells.find((cell) => cell.querySelector('picture'));
    const linkedCells = otherCells.filter((cell) => cell !== posterCell && cellUrl(cell));
    const videoCell = linkedCells.find((cell) => looksLikeVideoReference(cellUrl(cell)));
    const linkCell = linkedCells.find((cell) => cell !== videoCell);
    const openInNewTabCell =
      otherCells.find((cell) => hasField(cell, 'openInNewTab')) ??
      otherCells.find((cell) => isBooleanText(cellText(cell)));

    const rawVideo = videoCell ? cellUrl(videoCell) : '';
    const videoUrl = rawVideo ? resolveDAMUrl(rawVideo) : '';
    const posterUrl = posterCell?.querySelector<HTMLImageElement>('picture img')?.src ?? '';
    const linkHref = linkCell ? cellHref(linkCell) : '';
    const link = linkHref || null;
    const openInNewTab = isEnabled(cellText(openInNewTabCell));

    const focalCells = otherCells.filter(
      (cell) =>
        cell !== posterCell && cell !== videoCell && cell !== linkCell && cell !== openInNewTabCell && cellText(cell),
    );
    const focalDesktop = cellText(focalCells[0]) || 'center';
    const focalMobile = cellText(focalCells[1]) || 'center';

    return { label, videoUrl, posterUrl, link, openInNewTab, focalDesktop, focalMobile, sourceRow: row };
  });
}
