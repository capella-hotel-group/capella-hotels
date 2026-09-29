// src/blocks/split-media/lib/types.ts

// all fields optional: a freshly added, still-empty panel row has no picture/content cells yet
export interface SplitMediaPanel {
  mediaCell?: HTMLElement;
  contentCell?: HTMLElement;
  ctaCell?: HTMLElement;
  /** Original row element for moveInstrumentation */
  sourceRow?: HTMLElement;
}

export interface SplitMediaSlide {
  left: SplitMediaPanel;
  right: SplitMediaPanel;
}
