# Destination Cards - Signature Variation Block

## Overview

The **Destination Cards - Signature Variation** block displays curated signature experience cards with a premium aesthetic. It features:

- Responsive layouts (2-column grid on desktop/tablet, horizontal carousel on mobile)
- Interactive destination selector modal for CTA-driven navigation
- Optional dark image overlays for visual emphasis
- Two background style variants for flexible placement
- Direct URL or modal-driven call-to-action options

---

## Block-Level Configuration

These fields configure the entire block's appearance and behavior. Set them once when creating the block.

### Component Anchor ID

**Field Type:** Text  
**Required:** No  
**Purpose:** Sets a unique ID for the block that can be used as an anchor link target  
**Example:** `capella-signature-experiences`  
**Best Practice:** Use lowercase, hyphens, and avoid special characters

---

### Test ID

**Field Type:** Text  
**Required:** No  
**Purpose:** Adds a `data-test-id` attribute for automated QA testing  
**Example:** `destination-cards-signature`  
**Best Practice:** Include in all blocks for test automation

---

### Section Eyebrow

**Field Type:** Text  
**Required:** No  
**Purpose:** Small label above the main title (typically all caps)  
**Example:** `CAPELLA SIGNATURE`  
**Best Practice:** Keep it short (2-4 words). Leave blank if not needed

---

### Main Section Title

**Field Type:** Rich Text  
**Required:** ✅ Yes  
**Purpose:** The primary heading for this section  
**Example:** `Discover Our Signature Experiences`  
**Best Practice:**

- Use heading hierarchy (typically H2 on most pages)
- Keep it concise and compelling
- Supports text formatting (bold, italic, links)

---

### Section Description

**Field Type:** Rich Text  
**Required:** No  
**Purpose:** Explanatory text below the title, above the card grid  
**Example:** `Explore hand-curated moments that define the Capella experience`  
**Best Practice:**

- 1-2 sentences maximum
- Use to set context for the cards below
- Supports text formatting if needed

---

### Background Style

**Field Type:** Dropdown  
**Required:** ✅ Yes  
**Options:**

- **Signature Warm Tint** (default) - Premium warm taupe/bronze background with white text. Use for hero sections or emphasized content
- **Default Light** - Standard page background with dark text. Use for normal content flow

**Best Practice:**

- Use "Signature Warm Tint" when this block is a featured section
- Use "Default Light" when integrating into content rhythm
- Only one variant needed per page (usually)

---

### Modal Heading

**Field Type:** Text  
**Required:** No  
**Default:** `Choose destination`  
**Purpose:** The title text that appears in the destination selection modal popup  
**Example:** `Select Your Destination`  
**Best Practice:** Keep it short (2-4 words)

---

### Modal Submit Label

**Field Type:** Text  
**Required:** No  
**Default:** `GO TO DESTINATION`  
**Purpose:** The button text in the modal footer that users click to navigate  
**Example:** `EXPLORE`  
**Best Practice:**

- Use action verbs (GO, EXPLORE, BOOK, etc.)
- Keep it 1-3 words
- All caps is standard

---

### Destination Mappings

**Field Type:** Container (Repeating)  
**Required:** ✅ Yes (at least 2 items for meaningful modal)  
**Purpose:** Defines the list of destinations shown in the modal popup

#### For Each Destination:

**Destination Tag**  
**Field Type:** Tag Picker  
**Required:** ✅ Yes  
**Purpose:** Selects a tag from AEM's tag taxonomy (e.g., locations, regions)  
**How to Use:**

1. Click the tag field
2. Browse the tag hierarchy
3. Select one tag per destination
4. The tag's title will automatically display in the modal

**Example Tags:** `locations:asia/bali`, `locations:middle-east/dubai`, `locations:asia/hanoi`

**Best Practice:**

- Use consistent tag namespace (e.g., all from "locations")
- Ensure tags have meaningful titles in AEM tag manager
- Order tags geographically or by priority

**Destination Page Link**  
**Field Type:** Content Picker  
**Required:** ✅ Yes  
**Purpose:** The page URL that users navigate to after selecting this destination  
**How to Use:**

1. Click the link field
2. Search for or browse to the destination page
3. The URL is automatically captured

**Example:** Link to `/en/destinations/bali`, `/en/destinations/dubai`, etc.

**Best Practice:**

- Ensure destination pages exist before adding mappings
- Use descriptive page paths
- Test links after publishing

---

## Card-Level Configuration

Add one card per signature experience you want to showcase.

### Card Image

**Field Type:** Asset Reference  
**Required:** ✅ Yes  
**Purpose:** The main hero image for the card  
**Recommended Size:**

- Desktop: ~522px wide × 638px tall
- Tablet: ~349px wide × 427px tall
- Mobile: ~240px wide × 293px tall

**Best Practice:**

- Use high-quality images (JPG or PNG)
- Optimize file size before uploading
- Ensure consistent aspect ratio across all cards (approximately 4:5)
- Use images that work well with optional dark overlay

---

### Asset Alt Text

**Field Type:** Text  
**Required:** ✅ Yes  
**Purpose:** Alternative text for the image (accessibility, SEO)  
**Example:** `Luxury overwater villa with sunset view at Capella Bali`  
**Best Practice:**

- Describe what's in the image
- Include location/context when relevant
- Keep it 80-120 characters
- Avoid "image of" or "photo of"

---

### Dark Image Overlay

**Field Type:** Toggle (Yes/No)  
**Required:** No  
**Default:** Off (No)  
**Purpose:** Adds a semi-transparent dark overlay to dim the image  
**When to Use:**

- ✅ Enable when the image is bright/light and text needs contrast
- ✅ Enable for consistency if most cards use overlay
- ❌ Disable if image naturally provides contrast
- ❌ Disable if overlay obscures important details

**Best Practice:**

- Use consistently across cards for visual harmony
- Test on all devices to ensure text remains readable
- Dark overlay can be toggled per card for flexibility

---

### Card Title

**Field Type:** Rich Text  
**Required:** ✅ Yes  
**Purpose:** The experience or product name shown on the card  
**Example:** `Private Beach Escape`, `Wellness Retreat`, `Culinary Journey`  
**Best Practice:**

- Keep to 2-4 words
- Use compelling language
- Avoid generic terms
- All cards should be visually similar in title length

---

### Card Description

**Field Type:** Rich Text  
**Required:** No  
**Purpose:** Brief description of the experience (shows below title)  
**Example:** `Discover pristine sands and crystal waters in an exclusive setting`  
**Best Practice:**

- 1-2 sentences maximum
- Focus on the unique value proposition
- Use sensory language when appropriate
- Keep text length consistent across cards

---

### CTA Label

**Field Type:** Text  
**Required:** ✅ Yes  
**Default:** `EXPLORE NOW`  
**Purpose:** The text shown on the call-to-action button  
**Example:** `EXPLORE NOW`, `LEARN MORE`, `BOOK NOW`  
**Best Practice:**

- Use action verbs
- Keep to 1-3 words
- All caps is standard convention
- Same label across all cards for consistency

---

### CTA Action Mode

**Field Type:** Dropdown  
**Required:** ✅ Yes  
**Options:**

1. **Destination Modal** (default) - Opens a popup where users select from the "Destination Mappings" list, then navigate to the selected destination
2. **Direct URL Navigation** - Navigates directly to a URL (specified in the "CTA URL" field)

**When to Use:**

- **Destination Modal:**
  - When you want users to choose from multiple destinations
  - Multiple cards pointing to a selection of options
  - Typical use for signature experiences

- **Direct URL Navigation:**
  - When linking directly to a product/page
  - Single destination per card
  - Alternative to modal flow

---

### CTA URL

**Field Type:** Content Picker  
**Required:** Conditional  
**Visibility:** Only appears when "CTA Action Mode" = "Direct URL Navigation"  
**Purpose:** The URL to navigate to when CTA is clicked (direct link mode only)  
**How to Use:**

1. Change "CTA Action Mode" to "Direct URL Navigation"
2. The "CTA URL" field becomes available
3. Click the field and select the target page

**Best Practice:**

- Only used for Direct URL mode
- Leave blank for Destination Modal mode
- Ensure target page exists

---

### Open Link in New Tab

**Field Type:** Toggle (Yes/No)  
**Required:** No  
**Default:** Off (No)  
**Visibility:** Only appears when "CTA Action Mode" = "Direct URL Navigation"  
**Purpose:** Whether clicking the CTA opens the link in a new browser tab  
**When to Enable:**

- ✅ For external links
- ✅ When you want users to stay on current page
- ❌ For internal navigation (usually)
- ❌ When user expects page replacement

**Best Practice:**

- Only used for Direct URL mode
- Keep disabled for typical navigation
- Enable for external destinations

---

## Usage Examples

### Example 1: Signature Experiences with Destination Modal

**Block Configuration:**

- **Background Style:** Signature Warm Tint
- **Section Title:** `Discover Our Signature Experiences`
- **Modal Heading:** `Choose Your Destination`
- **Destination Mappings:**
  - Bali → `/en/destinations/bali`
  - Dubai → `/en/destinations/dubai`
  - Hanoi → `/en/destinations/hanoi`

**Cards (3 cards):**

1. Private Villa Experience
   - Image: luxury villa sunset
   - Dark Overlay: Yes
   - Title: `Private Villa Escape`
   - Description: `Wake to ocean views from your personal sanctuary`
   - CTA Mode: Destination Modal
   - CTA Label: `EXPLORE NOW`

2. Wellness Journey
   - Image: spa treatment
   - Dark Overlay: No
   - Title: `Holistic Wellness`
   - CTA Mode: Destination Modal

3. Culinary Experience
   - Image: fine dining
   - Dark Overlay: Yes
   - Title: `Taste Extraordinary`
   - CTA Mode: Destination Modal

**Result:** Users click "EXPLORE NOW" on any card → Modal opens → Select destination → Navigate to destination page

---

### Example 2: Single Experience with Direct Link

**Block Configuration:**

- **Background Style:** Default Light
- **Section Title:** `Exclusive Wellness Retreat`
- **Destination Mappings:** (Not needed for this example)

**Single Card:**

1. 30-Day Wellness Program
   - Title: `Transform Your Life`
   - CTA Mode: Direct URL Navigation
   - CTA URL: `/en/programs/wellness-30day`
   - Open in New Tab: No

**Result:** Users click CTA → Navigates directly to program page (no modal)

---

## Best Practices

### Content Guidelines

- ✅ Keep titles and descriptions concise
- ✅ Use consistent image aspect ratios
- ✅ Pair dark overlays consistently (either use on all or most cards)
- ✅ Test all destination links before publishing
- ✅ Use tag taxonomy consistently for destinations
- ✅ Include meaningful alt text for accessibility

### Visual Guidelines

- ✅ Use images that are 4:5 aspect ratio (landscape is better)
- ✅ Avoid very dark images on signature warm background
- ✅ Ensure text contrast (especially with dark overlay)
- ✅ Keep card count between 2-6 for optimal UX
- ✅ Single card should be centered (automatic)

### Modal Guidelines

- ✅ Map destinations to real pages that exist
- ✅ Order destinations logically (geography, popularity, etc.)
- ✅ Use meaningful destination tags with proper titles
- ✅ Test modal on mobile - ensure destinations are scrollable
- ✅ Keep destination list under 8-10 items for better UX

### Performance

- ✅ Optimize images before upload (aim for <500KB per image)
- ✅ Use modern formats (WebP, JPEG)
- ✅ Avoid very large text descriptions
- ✅ Test on slow connections

---

## Responsive Behavior

### Desktop (≥1200px)

- 2-column grid layout
- Cards: ~522px wide × 638px tall
- Carousel arrows visible on sides
- Full modal width

### Tablet (768px - 1199px)

- 2-column grid layout
- Cards: ~349px wide × 427px tall
- Carousel arrows visible on sides
- Responsive modal

### Mobile (<768px)

- Horizontal carousel (scrollable)
- Cards: ~240px wide × 293px tall
- Center card visible + peek of next card
- Full-width modal (stacked on small screens)
- Touch-friendly carousel

---

## Troubleshooting

### Destinations don't appear in modal

- ✅ Ensure at least 2 destinations are mapped
- ✅ Verify destination tags are valid in AEM tag manager
- ✅ Check that destination page links are valid
- ✅ Publish block changes

### Images look cut off or distorted

- ✅ Ensure images are proper aspect ratio (4:5)
- ✅ Check if dark overlay is enabled (might hide details)
- ✅ Test on different viewports
- ✅ Use image optimization tools before uploading

### Modal doesn't open

- ✅ Verify "CTA Action Mode" is set to "Destination Modal"
- ✅ Ensure destinations are configured
- ✅ Check browser console for errors
- ✅ Clear browser cache and test again

### Text is hard to read

- ✅ Enable dark overlay to improve contrast
- ✅ Adjust image or text color
- ✅ Test on actual devices
- ✅ Verify text meets WCAG contrast ratios

### Navigation doesn't work after selecting destination

- ✅ Verify destination page links are correct
- ✅ Test links in isolation first
- ✅ Check for URL encoding issues
- ✅ Ensure pages are published

---

## Accessibility

- ✅ All images have required alt text
- ✅ Modal has proper focus management
- ✅ Keyboard navigation supported (Tab, Enter, Escape)
- ✅ Color contrast meets WCAG AA standards
- ✅ Screen readers announce modal content
- ✅ Dark overlay doesn't prevent image description via alt text

---

## Support & Questions

For technical issues or feature requests, contact the development team. For authoring questions, refer to this guide or contact your content manager.
