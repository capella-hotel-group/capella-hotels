# Experience Events Grid Authoring

## Block Fields

| AEM field                     | Type                         | Required?                                   | What to author                                                                                                        |
| ----------------------------- | ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Block ID                      | Text                         | Optional                                    | Leave blank unless a page-specific ID is needed.                                                                      |
| Data Test ID                  | Text                         | Optional; default: `experience-events-grid` | Keep the default for QA automation.                                                                                   |
| Section Eyebrow               | Text                         | Optional                                    | Short text above the section title.                                                                                   |
| Section Title                 | Rich text                    | Required                                    | Section heading.                                                                                                      |
| Content Fragment Root Path    | Content Fragment path picker | Required                                    | Select the experiences folder, not an individual fragment.                                                            |
| Date Range Filter Placeholder | Text                         | Optional                                    | Prompt for the date picker. Default: `Select event dates`.                                                            |
| All Experiences Tab Label     | Text                         | Required                                    | Label for the tab that shows all matching experiences.                                                                |
| Category Tabs                 | Repeatable multifield        | Optional                                    | Add one row for each category tab. Order rows as they should appear.                                                  |
| Category Tag                  | Tag picker, single select    | Optional while drafting                     | Choose one Capella Hotels tag that matches the Content Fragment's Associated Filter Tags. Complete before publishing. |
| Category Tab Label            | Text                         | Optional while drafting                     | Visitor-facing label in the page language. Complete before publishing.                                                |
| Initial Display Count         | Number                       | Optional; default: `8`                      | Positive whole number of cards shown initially. Each Reveal More click adds 4.                                        |
| Reveal More Button Label      | Text                         | Optional; default: `REVEAL MORE`            | Label for the button that reveals more cards.                                                                         |

## Grid Card Content Fragment

1. Select **Create > Content Fragment**.
2. Choose the **Filter Grid Card details** model.
3. Enter a clear name for the experience, such as `Bangkok - The Soul`.
4. Open the fragment and complete the card fields below.
5. In Content Fragment Root Path, select the folder containing these card fragments. If Filters Grid uses the same folder path, both blocks use the same card fragments; no duplicate card fragments are needed.
6. For a popup card, complete the separate Modal Details Content Fragment below and select it in the card's **Modal Details** field.

| Grid card field                                                  | Type                       | Required?                       | What to author                                                                                        |
| ---------------------------------------------------------------- | -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Card Location Tag (`cardLocationTag`)                            | Tags, single select        | Yes                             | Select the experience destination.                                                                    |
| Card Headline (`cardHeadline`)                                   | Text                       | Yes                             | Short card title.                                                                                     |
| Card Background Photo (`cardBackgroundPhoto`)                    | Image reference            | Yes                             | Card image.                                                                                           |
| Card Background Photo Alt Text (`cardBackgroundPhotoAltText`)    | Text                       | Yes                             | Accessible description of the card image.                                                             |
| Dark Image Overlay (`CardBackgroundPhotoDarkImageOverlay`)       | Toggle                     | Optional                        | Turn on to darken the card image behind text.                                                         |
| Associated Filter Tags (`associatedFilterTags`)                  | Tags, multiple             | Yes                             | Add tags matching the page's Category Tabs.                                                           |
| Schedule/Frequency Label (`schedulefrequencyLabel`)              | Text                       | Yes                             | Card display text, e.g. `Daily, from 5pm`. Does not set the schedule.                                 |
| Duration / Type (`durationType`)                                 | Text                       | Optional                        | Duration or activity, e.g. `90 minutes` or `Evening ritual`.                                          |
| Pricing Type (`pricingType`)                                     | Dropdown                   | Yes                             | `complimentary` or `chargeable`.                                                                      |
| Push To Top (`pushToTop`)                                        | Toggle                     | Optional                        | Turn on to prioritize this card among matching results.                                               |
| Schedule Type (`scheduleType`)                                   | Dropdown                   | Yes                             | Choose one option from the Schedule Type table below.                                                 |
| Availability Start Date (`availabilityStartDate`)                | Date and time              | Conditional                     | Required except for By Arrangement.                                                                   |
| Availability End Date (`availabilityEndDate`)                    | Date and time              | Optional                        | Last available date/time. Must not precede the start.                                                 |
| Weekday(s) (`weekdays`)                                          | Checkboxes                 | Conditional                     | Required for Weekly; choose exactly one for Monthly Weekday.                                          |
| Week of Month (`weekOfMonth`)                                    | Dropdown                   | Conditional                     | Required for Monthly Weekday: `first`, `second`, `third`, `fourth`, or `last`.                        |
| Schedule Time Zone (`scheduleTimeZone`)                          | Dropdown                   | Yes                             | Choose the hotel's named zone, e.g. `Asia/Bangkok` or `Asia/Singapore`.                               |
| Card Click Action Behavior (`cardClickActionBehavior`)           | Dropdown                   | Yes                             | Navigates to a URL (`page`) or opens a popup (`popup`).                                               |
| Modal Details (`modalDetails`)                                   | Content Fragment reference | Required for popup              | Select the separate Modal Details fragment. Leave blank for a page card.                              |
| Direct Destination URL Type (`directDestinationUrlType`)         | Dropdown                   | Required for page card          | Choose Internal or External.                                                                          |
| Direct Destination URL (`directDestinationUrl`)                  | Page reference             | Required for internal page card | Select the internal destination page.                                                                 |
| Direct Destination External URL (`directDestinationExternalUrl`) | URL text                   | Required for external page card | Enter the external destination URL.                                                                   |
| Open In New Tab (`openInNewTab`)                                 | Toggle                     | Optional                        | Turn on to open the card's page destination in a new tab. Popup CTA behavior is set in Modal Details. |

### Schedule Type Options

| Dropdown option | Stored value     | Other required fields                                                                                  |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| Fixed dates     | `fixedDates`     | Schedule Time Zone, Availability Start Date. End Date is optional; without it, this is one occurrence. |
| Daily           | `daily`          | Schedule Time Zone, Availability Start Date. End Date is optional.                                     |
| Weekly          | `weekly`         | Schedule Time Zone, Availability Start Date, one or more Weekday(s). End Date is optional.             |
| Monthly Weekday | `monthlyWeekday` | Schedule Time Zone, Availability Start Date, exactly one Weekday, Week of Month. End Date is optional. |
| By Arrangement  | `byArrangement`  | Schedule Time Zone. Availability dates are optional.                                                   |

Use a real date and time with a timezone offset, e.g. `2026-11-24T17:00:00+07:00`. Without a schedule, a card can show when no date range is selected, but will not match a selected date range. Older stored values `fixed-date`, `monthly-weekday`, and `by-arrangement` remain supported.

## Modal Details Content Fragment

Create this separate fragment only for cards whose Card Click Action Behavior is popup.

1. Select **Create > Content Fragment**.
2. Choose the **Modal Details** model.
3. Enter a clear name that identifies the experience, such as `Bangkok - The Soul - Modal Details`.
4. Open the fragment and complete its popup fields below.
5. Publish the Modal Details fragment and its images. Return to the Grid Card Content Fragment and select it in **Modal Details**.

| Modal Details field                                                          | Type                        | Required?                 | What to author                                                                                       |
| ---------------------------------------------------------------------------- | --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Modal Description (`modalDescription`)                                       | Rich text                   | Optional                  | Popup description.                                                                                   |
| Modal Image Aspect Ratio Variant (`modalImageAspectRatioVariant`)            | Dropdown                    | Yes                       | `square` for Split Image or `wide` for Landscape.                                                    |
| Modal Feature Image Asset (`modalFeatureImageAsset`)                         | Image reference             | Yes                       | Feature image. Use square art for Split Image and 16:9 art for Landscape.                            |
| Modal Feature Image Asset Alt Text (`modalFeatureImageAssetAltText`)         | Text                        | Yes                       | Accessible description of the feature image.                                                         |
| Modal Feature Image Dark Image Overlay (`modalFeatureImageDarkImageOverlay`) | Toggle                      | Optional                  | Controls the popup image overlay independently of the card overlay.                                  |
| Carousel Images (`carouselImages`)                                           | Repeatable image references | Optional                  | Add images in display order. Split Image keeps the feature image separate; Landscape starts with it. |
| Carousel Images Alt Text (`carouselImagesAltText`)                           | Repeatable text             | Optional                  | Provide alt text corresponding to each carousel image.                                               |
| Modal CTA Label (`modalCtaLabel`)                                            | Text                        | Optional                  | Leave blank to hide the CTA.                                                                         |
| Modal CTA URL Type (`modalCtaUrlType`)                                       | Dropdown                    | Required for CTA          | Choose Internal or External when using a CTA.                                                        |
| Modal CTA URL Internal (`modalCtaUrlInternal`)                               | Page reference              | Required for internal CTA | Select the internal destination page.                                                                |
| Modal CTA URL External (`modalCtaUrlExternal`)                               | URL text                    | Required for external CTA | Enter the external destination URL.                                                                  |
| Open In New Tab (`openInNewTab`)                                             | Toggle                      | Optional                  | Turn on to open the popup CTA in a new tab.                                                          |

## Before Publishing

- Category Tab tags match the fragments' Associated Filter Tags.
- Every scheduled fragment has a Schedule Type, time zone, and all required schedule fields.
- Publish the page, Content Fragments, and referenced images; preview category/date filters and a popup.
- If `Some experiences could not be displayed. Check their schedule configuration.` appears, check the browser console for the invalid fragment path and reason. Common causes: missing time zone, invalid date range, or incomplete Weekly/Monthly Weekday fields.
