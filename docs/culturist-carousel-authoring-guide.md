# Culturist Carousel Authoring

The Culturist Carousel groups culturist profiles by destination. Add the block title fields, then create one item for each destination.

## Block fields

- **Section Title Prefix**: Required text before the destination selector.
- **Section Title Suffix**: Optional text after the destination selector.
- **Block ID**: Optional anchor ID.

## Destination items

For each destination, add a **Culturist Carousel Item** with:

- **Tab Name**: Required destination label shown in the selector.
- **Content Fragment**: Required Culturist Content Fragment for that destination.

With multiple items, visitors can choose a destination from the selector.

## Content Fragment notes

For each destination/language, create the Content Fragments in this order:

1. Create each experience carousel card fragment with the **Card Details** model. Add its image, title, alt text, and optional link or popup behavior.
2. Create the destination's main profile fragment with the **Culturist Tab Details** model. Add the culturist profile fields and reference the experience card fragments in **Card Details Tab**.

- Add the culturist name, quote, description, avatar and alt text, signature and alt text, and CTA label/link as needed.
- Use blockquote formatting in the quote rich text to show generated quotation marks. Plain paragraph quotes are displayed without generated marks.
- The main profile fragment must reference at least three experience-card fragments. The experience gallery scrolls horizontally; its previous/next controls move through the cards.
- The profile CTA appears when both its label and destination are provided.
