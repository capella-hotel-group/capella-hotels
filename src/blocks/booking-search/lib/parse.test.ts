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
});
