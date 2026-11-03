// src/blocks/hero-destination/lib/types.ts

interface HeroDestinationItemBase {
  heading: string;
  showOverlay: boolean;
  /** Original row element for moveInstrumentation */
  sourceRow: HTMLElement;
}

export interface HeroDestinationImageItem extends HeroDestinationItemBase {
  mediaType: 'image';
  desktopPicture: Element;
  mobilePicture: Element | null;
  imageAlt: string;
}

export interface HeroDestinationVideoItem extends HeroDestinationItemBase {
  mediaType: 'video';
  desktopVideoUrl: string;
  mobileVideoUrl: string;
}

/** A freshly added (or still-being-filled) item with no resolvable media yet. */
export interface HeroDestinationEmptyItem extends HeroDestinationItemBase {
  mediaType: 'empty';
}

export type HeroDestinationItem = HeroDestinationImageItem | HeroDestinationVideoItem | HeroDestinationEmptyItem;

export interface HeroDestinationVideoConfig {
  introPicture: HTMLPictureElement | null;
  introPictureCell: HTMLElement | null;
  introImageAltCell: HTMLElement | null;
  introPictureMobile: HTMLPictureElement | null;
  introPictureMobileCell: HTMLElement | null;
  desktopVideoUrl: string;
  desktopVideoCell: HTMLElement | null;
  /** Falls back to desktopVideoUrl when no mobile video is authored. */
  mobileVideoUrl: string;
  mobileVideoCell: HTMLElement | null;
  posterPicture: HTMLPictureElement | null;
  posterCell: HTMLElement | null;
  loop: boolean;
  loopCell: HTMLElement | null;
  showOverlay: boolean;
  showOverlayCell: HTMLElement | null;
  heading: string;
  headingCell: HTMLElement | null;
  headingDelayMs: number;
  headingDelayCell: HTMLElement | null;
}
