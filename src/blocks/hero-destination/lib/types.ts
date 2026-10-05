// src/blocks/hero-destination/lib/types.ts

interface HeroDestinationItemBase {
  heading: string;
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
