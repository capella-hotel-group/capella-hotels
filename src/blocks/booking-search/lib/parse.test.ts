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

  it('reads the Locations Content Fragment path from the link in the row after Hotel ID', () => {
    const block = document.createElement('div');
    block.innerHTML = [
      ...Array.from({ length: 16 }, () => row('')),
      `<div><div><a href="/content/dam/capella-hotels/booking-locations/list">list</a></div></div>`,
    ].join('');

    expect(parseConfig(block).locationsPath).toBe('/content/dam/capella-hotels/booking-locations/list');
  });

  it('leaves the Locations path empty for content authored before the field existed', () => {
    const block = document.createElement('div');
    block.innerHTML = Array.from({ length: 16 }, () => row('')).join('');

    expect(parseConfig(block).locationsPath).toBe('');
  });

  it('leaves the block-level Hotel ID empty for content authored before the field existed', () => {
    const block = document.createElement('div');
    block.innerHTML = Array.from({ length: 15 }, () => row('')).join('');

    expect(parseConfig(block).hotelId).toBe('');
  });
});
