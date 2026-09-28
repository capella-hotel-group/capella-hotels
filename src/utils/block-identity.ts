interface BlockIdentityOptions {
  /** number of rows the model emits after the identity rows, items excluded */
  contentRows: number;
  /** block-scoped class that hides the consumed rows; omit when the block rebuilds its DOM */
  hiddenClass?: string;
}

const IDENTITY_ROW_COUNT = 2;

/**
 * Applies the two identity fields every block model starts with: `id` (row 0) and
 * `dataTestId` (row 1). The split is measured from the tail, so content authored before
 * a model gained one of these fields — and therefore emits fewer leading rows — still
 * lines up. Both rows are hidden instead of removed so the Universal Editor keeps them
 * selectable in the content tree.
 * @returns the remaining rows, i.e. the block's actual content rows
 */
export function applyBlockIdentity(
  block: HTMLElement,
  rows: HTMLElement[],
  { contentRows, hiddenClass }: BlockIdentityOptions,
): HTMLElement[] {
  const identityCount = Math.min(Math.max(rows.length - contentRows, 0), IDENTITY_ROW_COUNT);
  const identityRows = rows.slice(0, identityCount);
  const [idRow, testIdRow] = identityRows;

  const blockId = idRow?.textContent?.trim().replace(/^#/, '');
  if (blockId) block.id = blockId;

  const testId = testIdRow?.textContent?.trim();
  if (testId) block.dataset.testId = testId;

  if (hiddenClass) identityRows.forEach((row) => row.classList.add(hiddenClass));

  return rows.slice(identityCount);
}
