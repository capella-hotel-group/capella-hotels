// src/blocks/split-media/lib/parse.test.ts
import { isItemRow, parseBlockConfig, parseCarouselConfig, parseSlides } from './parse';

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

  it('falls back to true autoplay when the cell is missing or unrecognized', () => {
    expect(parseCarouselConfig([]).autoplay).toBe(true);
    expect(parseCarouselConfig([row(cell('maybe')), row(cell('6'))]).autoplay).toBe(true);
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
    withModel.dataset.aueModel = 'split-media-slide';
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
  function slideRow(): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML =
      '<div><picture><img src="left.jpg"></picture></div>' +
      '<div><p>Eyebrow</p><p>Headline</p></div>' +
      '<div><picture><img src="right.jpg"></picture></div>' +
      '<div><p>Headline</p></div>' +
      '<div></div>';
    return div;
  }

  it('maps each row directly to one slide with 5 fixed-position cells', () => {
    const rows = [slideRow(), slideRow()];
    const slides = parseSlides(rows);

    expect(slides).toHaveLength(2);
    expect(slides[0].sourceRow).toBe(rows[0]);
    expect(slides[0].left.mediaCell).toBe(rows[0].children[0]);
    expect(slides[0].left.contentCell).toBe(rows[0].children[1]);
    expect(slides[0].right.mediaCell).toBe(rows[0].children[2]);
    expect(slides[0].right.contentCell).toBe(rows[0].children[3]);
    expect(slides[0].right.ctaCell).toBe(rows[0].children[4]);
    expect(slides[1].sourceRow).toBe(rows[1]);
  });

  it('returns no slides for an empty item list', () => {
    expect(parseSlides([])).toEqual([]);
  });
});

describe('parseBlockConfig compatibility', () => {
  const config = (...values: string[]) => parseBlockConfig(values.map((value) => row(cell(value))));
  it('defaults existing slide-only CMS content to autoplay with both navigation groups', () => {
    expect(config()).toEqual({
      id: '',
      dataTestId: '',
      autoplay: true,
      intervalSeconds: 6,
      showDots: true,
      showControls: true,
    });
  });
  it.each([
    [['hero', 'qa', 'false'], false, 6, true, true],
    [['hero', 'qa', 'false', '9'], false, 9, true, true],
    [['hero', 'qa', 'true', '4', 'false', 'true'], true, 4, false, true],
    [['hero', 'qa', 'false', 'false', 'false'], false, 6, false, false],
    [['hero', 'qa', 'true', '6seconds', 'true', 'false'], true, 6, true, false],
    [['hero', 'qa', 'true', 'false', 'true', 'false'], true, 6, true, false],
  ])('keeps identity and settings aligned for %j', (values, autoplay, intervalSeconds, showDots, showControls) => {
    expect(config(...values)).toEqual({
      id: 'hero',
      dataTestId: 'qa',
      autoplay,
      intervalSeconds,
      showDots,
      showControls,
    });
  });
  it('reads instrumented fields by name even when reordered or omitted', () => {
    const controls = row(cell('false'));
    controls.firstElementChild!.setAttribute('data-aue-prop', 'showControls');
    const identity = row(cell('hero'));
    identity.setAttribute('data-aue-prop', 'id');
    expect(parseBlockConfig([controls, identity])).toEqual({
      id: 'hero',
      dataTestId: '',
      autoplay: true,
      intervalSeconds: 6,
      showDots: true,
      showControls: false,
    });
  });
});
