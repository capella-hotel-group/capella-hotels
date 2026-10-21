# Hero Video Authoring

The Hero Video is a full-width landing hero. It plays a background video for the selected destination and shows a list of destinations that visitors can choose from. It also includes a Destinations / Experiences mode toggle.

Add one **Hero Video** block, then add one **Hero Video Item** inside it for each destination.

## Block fields

- **Prefix**: Text shown before the destination list. Default: `See`.
- **Suffix**: Text shown after the destination list. Default: `with new eyes`.
- **Transition Style**: How the video changes when a destination is selected: `Crossfade` (default), `Slide`, or `Cut`.
- **Destination Label**: Left toggle label. Default: `Destinations`.
- **Destination Page**: Page opened by the left toggle.
- **Experience Label**: Right toggle label. Default: `Experiences`.
- **Experience Page**: Page opened by the right toggle.

The toggle highlights the side that matches the current page. Switching sides loads the other page without a full reload.

## Step-by-step in the Universal Editor

### 1. Prepare the two pages

Open the Destination page and the Experience page in the Universal Editor. Each page needs a Hero Video block. If a page does not have one, add a **Hero Video** component to the section where the hero should appear.

### 2. Name each section

Select the section that contains the Hero Video and set **Section Name** to `Destination` on the Destination page and `Experience` on the Experience page. This is the name shown in the Content Tree; it does not change the block's data.

The section's **Mode** is separate metadata. You may set it to `Destinations` or `Experiences` to match the page if your content setup uses it, but the Hero Video toggle does not use Mode to choose its active side.

### 3. Configure the Hero Video block on both pages

Select the **Hero Video** block to open its properties. Enter the shared toggle settings on both pages:

1. Set **Destination Label** and **Experience Label** to the text authors should see on the toggle.
2. Set **Destination Page** to the Destination page and **Experience Page** to the Experience page. Select the actual pages with the content picker. Use the same two page links on both blocks.
3. Set **Prefix**, **Suffix**, and **Transition Style** as needed.

The page whose URL matches **Experience Page** is treated as the Experience page. The other page is treated as the Destination page, so check the selected page links carefully.

### 4. Add the list items

Under the Hero Video block, use the add/insert-component control to add one **Hero Video Item** for each entry that should appear in that page's list. Select each item and fill its properties:

1. Enter the **Label** shown in the list.
2. Select the **Video** from the DAM.
3. Select a **Poster Image** from the DAM.
4. Optionally select a **Link** to open when the already-selected item is clicked.
5. Adjust **Focal Point (Desktop)** and **Focal Point (Mobile)** only if the subject is cropped poorly; otherwise leave both as `center`.

Use destination items on the Destination page and experience items on the Experience page. Drag the items into the order they should appear; the first item is selected when the page loads.

### 5. Save and check both pages

Save the edits and preview each page. Check that the correct toggle side is active, selecting the other side opens its paired page, and each page shows the expected list and video. Also check the mobile crop before publishing.

## Hero Video items

For each destination or experience shown in the list, add a **Hero Video Item** with:

- **Label**: Required destination or experience name shown in the list, for example `Kyoto`.
- **Video**: Required video file from the DAM (`.mp4` or `.webm`).
- **Poster Image**: Image shown while the video loads. Always add one.
- **Link**: Optional page opened when a visitor clicks the item that is already selected.
- **Focal Point (Desktop)**: Which part of the video stays visible when it is cropped on desktop. Default: `center`.
- **Focal Point (Mobile)**: Same, for mobile. Default: `center`.

## Tips

- Item order is the order shown in the list. The first item is selected when the page loads. Items can differ between the Experience and Destination pages.
- Add at least one item with a video, otherwise the block shows nothing.
- Fill in the Label and Video before publishing. A newly added empty item appears as `New destination` and has no video.
- Focal points accept CSS position values, such as `center`, `left top`, `right`, or `30% 60%`. Use them to keep the subject visible on narrow screens.
- Videos always play muted and loop. There is no sound control.
- The intro animation of the prefix and suffix is skipped inside the Universal Editor, so it only plays on the live site.
- Keep video files small and short, since they start loading as soon as the page opens.
