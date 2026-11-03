# Offers Carousel

Set the primary eyebrow and title on the block, then add up to three offer cards.
Each card supports an image and alt text, eyebrow, title, description, and two optional CTAs.

## Dark Image Overlay

Select **Dark Image Overlay → Enabled** or **Disabled** on each Offers Carousel Item.
Enabled keeps the existing 40% black shade behind the card text; Disabled removes only
the image shade, not the text or CTAs. Existing cards without this field stay enabled.
Check text contrast against the selected image before disabling the shade.

The optional `darkOverlay` field follows the media, content, and CTA cells in delivered
markup. Older three-cell items remain supported. Regenerate component models after
changing the source model.

## Arabic and RTL

The primary eyebrow and headline align to the reading direction and retain the standard
responsive grid inset. The desktop card column uses direction-aware padding.
The existing alternating title-line indentation remains in place.
