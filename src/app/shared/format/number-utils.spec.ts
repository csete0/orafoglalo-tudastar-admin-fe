import { formatBytes, formatMb, formatUsd, percentOf, ratio } from './number-utils';

describe('number-utils', () => {
  it('formatUsd: 1 alatt 3, efölött 2 tizedes (az AI-költés pult formája)', () => {
    expect([0, 0.0123, 0.2, 0.999, 1, 1.256, 12].map(formatUsd)).toEqual(['$0.000', '$0.012', '$0.200', '$0.999', '$1.00', '$1.26', '$12.00']);
  });

  it('ratio: arány 0–1, nulla nevezőnél vagy hiányzó számlálónál null', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(0, 4)).toBe(0);
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(null, 4)).toBeNull();
  });

  it('percentOf: százalék 0–100, nulla nevezőnél 0', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(3, 3)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
  });

  it('formatBytes: B / KB / MB, egy tizedessel', () => {
    expect([0, 1023, 1024, 1536, 1048575, 1048576, 5 * 1048576 + 104858].map(formatBytes))
      .toEqual(['0 B', '1023 B', '1.0 KB', '1.5 KB', '1024.0 KB', '1.0 MB', '5.1 MB']);
  });

  it('formatMb: MB egy tizedessel, mértékegység nélkül', () => {
    expect([0, 524288, 1048576, 12.34 * 1048576].map(formatMb)).toEqual(['0.0', '0.5', '1.0', '12.3']);
  });
});
