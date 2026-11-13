import { parseConfig } from './parse';

const row = (...cells: string[]): string => `<div>${cells.map((cell) => `<div><p>${cell}</p></div>`).join('')}</div>`;

describe('parseConfig', () => {
  it('skips locations authored without a Hotel ID', () => {
    const block = document.createElement('div');
    block.innerHTML = [
      ...Array.from({ length: 14 }, () => row('')),
      row('Singapore', '75985'),
      `<div><div><p>Kyoto</p></div><div></div></div>`,
    ].join('');

    expect(parseConfig(block).locations).toEqual([{ label: 'Singapore', code: '75985' }]);
  });

  it('reads the block-level Hotel ID from the row after Show Location', () => {
    const block = document.createElement('div');
    block.innerHTML = [...Array.from({ length: 15 }, () => row('')), row('77645')].join('');

    expect(parseConfig(block).hotelId).toBe('77645');
  });

  it('leaves the block-level Hotel ID empty for content authored before the field existed', () => {
    const block = document.createElement('div');
    block.innerHTML = Array.from({ length: 15 }, () => row('')).join('');

    expect(parseConfig(block).hotelId).toBe('');
  });
});
