// src/blocks/experience-tiles/lib/types.ts

// each field's prefix must stop before the second underscore-separated segment (e.g.
// "leftMedia_image", not "left_media_image") — otherwise "Element Grouping" merges the media
// field's <picture> together with the sibling text fields into one cell, which then trips
// wrapTextNodes()'s picture-with-siblings special case and squashes everything into one <p>
export interface ExperienceTilesPanel {
  mediaCell?: HTMLElement;
  contentCell?: HTMLElement;
  ctaCell?: HTMLElement;
}

export interface ExperienceTilesSlide {
  left: ExperienceTilesPanel;
  right: ExperienceTilesPanel;
  /** Original row element for moveInstrumentation */
  sourceRow?: HTMLElement;
}
