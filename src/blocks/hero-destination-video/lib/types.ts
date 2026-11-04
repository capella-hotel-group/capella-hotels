// src/blocks/hero-destination-video/lib/types.ts

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
