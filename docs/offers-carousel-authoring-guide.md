# Offers Carousel

Set the primary eyebrow and title on the block, then add up to three offer cards.
Each card supports an image and alt text, eyebrow, title, description, and two optional CTAs.

## Dark Image Overlay

Use the **Dark Image Overlay** toggle, right below the card image and alt text, on each
Offers Carousel Item. On (default) keeps the existing 40% black shade behind the card text;
off removes only the image shade, not the text or CTAs. Existing cards without this field
stay enabled. Check text contrast against the selected image before turning the shade off.

The optional `darkOverlay` field is delivered as its own cell right after the media cell.
Items published while it followed the CTA cell, and older three-cell items, remain supported.
Regenerate component models after changing the source model.

## Arabic and RTL

The primary eyebrow and headline align to the reading direction and retain the standard
responsive grid inset. The desktop card column uses direction-aware padding.
The existing alternating title-line indentation remains in place.
