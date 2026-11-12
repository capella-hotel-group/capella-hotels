export interface ExperienceReference {
  _path?: string | null;
  _publishUrl?: string | null;
}

export interface ExperienceModalDetails {
  modalDescription?: { html?: string | null } | null;
  modalImageAspectRatioVariant?: string | null;
  modalFeatureImageAsset?: ExperienceReference | null;
  modalFeatureImageAssetAltText?: string | null;
  modalFeatureImageDarkImageOverlay?: boolean | null;
  carouselImages?: Array<ExperienceReference | null> | null;
  carouselImagesAltText?: Array<string | null> | null;
  modalCtaUrlType?: string | null;
  modalCtaLabel?: string | null;
  modalCtaUrlInternal?: ExperienceReference | null;
  modalCtaUrlExternal?: string | null;
  openInNewTab?: boolean | null;
}

export interface ExperienceCard {
  _path?: string;
  cardLocationTag?: string[] | null;
  cardHeadline?: string | null;
  cardBackgroundPhoto?: ExperienceReference | null;
  cardBackgroundPhotoAltText?: string | null;
  CardBackgroundPhotoDarkImageOverlay?: boolean | null;
  associatedFilterTags?: string[] | null;
  cardClickActionBehavior?: string | null;
  directDestinationUrlType?: string | null;
  directDestinationUrl?: ExperienceReference | null;
  directDestinationExternalUrl?: string | null;
  openInNewTab?: boolean | null;
  modalDetails?: ExperienceModalDetails | null;
}
