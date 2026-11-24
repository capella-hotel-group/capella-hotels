// src/blocks/experience-tiles/lib/parse.test.ts
import { isItemRow, parseBlockConfig, parseSlides, toElementId } from './parse';

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

describe('toElementId', () => {
  it('keeps a clean id, drops a leading hash and trims', () => {
    expect(toElementId('homepage-experiences')).toBe('homepage-experiences');
    expect(toElementId('  #experiences ')).toBe('experiences');
  });
  it('replaces whitespace and strips characters that need selector escaping', () => {
    expect(toElementId('our experiences')).toBe('our-experiences');
    expect(toElementId('a.b#c[d]"e\'f')).toBe('abcdef');
    expect(toElementId('trải nghiệm')).toBe('trải-nghiệm');
  });
  it('returns an empty string when nothing usable is left', () => {
    expect(toElementId('')).toBe('');
    expect(toElementId('  ###  ')).toBe('');
    expect(toElementId('!!!')).toBe('');
  });
});

describe('isItemRow', () => {
  it('trusts the authored aue model when present', () => {
    const withModel = row();
    withModel.dataset.aueModel = 'experience-tiles-slide';
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

  describe('rows with dropped cells', () => {
    const LEFT = '<div><picture><img src="left.jpg"></picture></div>';
    const RIGHT = '<div><picture><img src="right.jpg"></picture></div>';
    const LEFT_TEXT = '<div><p>Eyebrow</p><p>Headline</p></div>';
    const RIGHT_TEXT = '<div><p>Headline</p><p>Read <a href="/more">more</a> here</p></div>';
    const CTAS =
      '<div><p class="button-container"><a href="/a">A</a></p><p>true</p><p><a href="/b">B</a></p><p>false</p></div>';
    const build = (html: string): HTMLElement => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div;
    };
    const parse = (html: string) => parseSlides([build(html)])[0]!;

    it('finds the CTA cell by its links when the left content cell is gone', () => {
      const slide = parse(LEFT + RIGHT + RIGHT_TEXT + CTAS);
      expect(slide.left.contentCell).toBeUndefined();
      expect(slide.right.mediaCell?.querySelector('img')?.getAttribute('src')).toBe('right.jpg');
      expect(slide.right.contentCell?.textContent).toContain('Headline');
      expect(slide.right.ctaCell?.querySelectorAll('a')).toHaveLength(2);
    });

    it('finds the right content when the CTA cell is gone', () => {
      const slide = parse(LEFT + LEFT_TEXT + RIGHT + RIGHT_TEXT);
      expect(slide.left.contentCell?.textContent).toContain('Eyebrow');
      expect(slide.right.contentCell?.textContent).toContain('Headline');
      expect(slide.right.ctaCell).toBeUndefined();
    });

    it('does not mistake a description that holds a link for the CTA cell', () => {
      const slide = parse(LEFT + LEFT_TEXT + RIGHT + RIGHT_TEXT);
      expect(slide.right.ctaCell).toBeUndefined();
      expect(slide.right.contentCell?.querySelector('a')).not.toBeNull();
    });

    it('keeps a lone CTA cell out of the right content', () => {
      const slide = parse(LEFT + LEFT_TEXT + RIGHT + CTAS);
      expect(slide.right.contentCell).toBeUndefined();
      expect(slide.right.ctaCell?.querySelectorAll('a')).toHaveLength(2);
    });

    it('handles a row that has only the two media cells', () => {
      const slide = parse(LEFT + RIGHT);
      expect(slide.left.mediaCell).toBeDefined();
      expect(slide.right.mediaCell).toBeDefined();
      expect(slide.left.contentCell).toBeUndefined();
      expect(slide.right.contentCell).toBeUndefined();
      expect(slide.right.ctaCell).toBeUndefined();
    });

    it('falls back to positions when fewer than two media cells exist', () => {
      const slide = parse('<div>a</div><div>b</div><div>c</div>');
      expect(slide.left.mediaCell?.textContent).toBe('a');
      expect(slide.left.contentCell?.textContent).toBe('b');
      expect(slide.right.mediaCell?.textContent).toBe('c');
      expect(slide.right.contentCell).toBeUndefined();
    });

    it('never reads a full five-cell row by content', () => {
      const slide = parse(LEFT + LEFT_TEXT + RIGHT + CTAS + CTAS);
      expect(slide.right.contentCell?.querySelectorAll('a')).toHaveLength(2);
    });
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
