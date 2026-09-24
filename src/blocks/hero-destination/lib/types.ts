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

export type HeroDestinationItem = HeroDestinationImageItem | HeroDestinationVideoItem;
