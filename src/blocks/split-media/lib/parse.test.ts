// src/blocks/split-media/lib/parse.test.ts
import { isItemRow, parseBlockConfig, parseSlides } from './parse';

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
  it('reads only identity from new and legacy rows', () => {
    expect(config()).toEqual({ id: '', dataTestId: '' });
    expect(config('hero', 'qa')).toEqual({ id: 'hero', dataTestId: 'qa' });
    expect(config('hero', 'qa', 'true', '6', 'true', 'true')).toEqual({ id: 'hero', dataTestId: 'qa' });
    expect(config('false', '6', 'true', 'false')).toEqual({ id: '', dataTestId: '' });
  });
  it('uses instrumentation for reordered and omitted fields including legacy fields', () => {
    const old = row(cell('true'));
    old.dataset.aueProp = 'autoplay';
    const identity = row(cell('hero'));
    identity.dataset.aueProp = 'id';
    expect(parseBlockConfig([old, identity])).toEqual({ id: 'hero', dataTestId: '' });
    expect(parseBlockConfig([old])).toEqual({ id: '', dataTestId: '' });
  });
});
