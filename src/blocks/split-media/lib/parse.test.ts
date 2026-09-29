// src/blocks/split-media/lib/parse.test.ts
import { isItemRow, parseCarouselConfig, parseSlides } from './parse';

function cell(text: string): HTMLElement {
  const div = document.createElement('div');
  div.textContent = text;
  return div;
}

function row(...cells: HTMLElement[]): HTMLElement {
  const div = document.createElement('div');
  div.append(...cells);
  return div;
}

describe('parseCarouselConfig', () => {
  it('parses autoplay true/yes and false/no', () => {
    expect(parseCarouselConfig([row(cell('true')), row(cell('6'))]).autoplay).toBe(true);
    expect(parseCarouselConfig([row(cell('yes')), row(cell('6'))]).autoplay).toBe(true);
    expect(parseCarouselConfig([row(cell('false')), row(cell('6'))]).autoplay).toBe(false);
    expect(parseCarouselConfig([row(cell('no')), row(cell('6'))]).autoplay).toBe(false);
  });

  it('falls back to false autoplay when the cell is missing or unrecognized', () => {
    expect(parseCarouselConfig([]).autoplay).toBe(false);
    expect(parseCarouselConfig([row(cell('maybe')), row(cell('6'))]).autoplay).toBe(false);
  });

  it('parses a positive numeric interval', () => {
    expect(parseCarouselConfig([row(cell('true')), row(cell('4'))]).intervalSeconds).toBe(4);
  });

  it('falls back to the default interval when missing, non-numeric, or non-positive', () => {
    expect(parseCarouselConfig([]).intervalSeconds).toBe(6);
    expect(parseCarouselConfig([row(cell('true')), row(cell('abc'))]).intervalSeconds).toBe(6);
    expect(parseCarouselConfig([row(cell('true')), row(cell('0'))]).intervalSeconds).toBe(6);
    expect(parseCarouselConfig([row(cell('true')), row(cell('-2'))]).intervalSeconds).toBe(6);
  });
});

describe('isItemRow', () => {
  it('trusts the authored aue model when present', () => {
    const withModel = row();
    withModel.dataset.aueModel = 'split-media-item';
    expect(isItemRow(withModel)).toBe(true);

    const withOtherModel = row();
    withOtherModel.dataset.aueModel = 'something-else';
    expect(isItemRow(withOtherModel)).toBe(false);
  });

  it('falls back to a media check outside the editor', () => {
    const withPicture = document.createElement('div');
    withPicture.innerHTML = '<picture><img src="a.jpg"></picture>';
    expect(isItemRow(withPicture)).toBe(true);

    expect(isItemRow(row(cell('no media here')))).toBe(false);
  });
});

describe('parseSlides', () => {
  function panelRow(hasPicture: boolean): HTMLElement {
    const div = document.createElement('div');
    if (hasPicture) div.innerHTML = '<picture><img src="a.jpg"></picture>';
    return div;
  }

  it('pairs rows sequentially two-at-a-time into slides', () => {
    const rows = [panelRow(true), panelRow(true), panelRow(true), panelRow(true)];
    const slides = parseSlides(rows);
    expect(slides).toHaveLength(2);
    expect(slides[0].left.sourceRow).toBe(rows[0]);
    expect(slides[0].right.sourceRow).toBe(rows[1]);
    expect(slides[1].left.sourceRow).toBe(rows[2]);
    expect(slides[1].right.sourceRow).toBe(rows[3]);
  });

  it('keeps a still-odd trailing panel with an empty placeholder partner', () => {
    const rows = [panelRow(true), panelRow(true), panelRow(true)];
    const slides = parseSlides(rows);
    expect(slides).toHaveLength(2);
    expect(slides[1].left.sourceRow).toBe(rows[2]);
    expect(slides[1].right).toEqual({});
  });

  it('returns no slides for an empty item list', () => {
    expect(parseSlides([])).toEqual([]);
  });
});
