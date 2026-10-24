import { BytesPipe } from './bytes.pipe';
import { PercentOfPipe } from './percent-of.pipe';
import { UsdPipe } from './usd.pipe';

describe('formázó pipe-ok', () => {
  it('usd', () => {
    const pipe = new UsdPipe();
    expect(pipe.transform(0.042)).toBe('$0.042');
    expect(pipe.transform(3.456)).toBe('$3.46');
    expect([0.00012, 0.05, 0, 3.456].map((v) => pipe.transform(v, 'fine'))).toEqual(['$0.0001', '$0.050', '$0.00', '$3.46']);
  });

  it('bytes: alapból mértékegységgel, „MB” paraméterrel csak a szám', () => {
    const pipe = new BytesPipe();
    expect(pipe.transform(512)).toBe('512 B');
    expect(pipe.transform(2048)).toBe('2.0 KB');
    expect(pipe.transform(3 * 1048576)).toBe('3.0 MB');
    expect(pipe.transform(3 * 1048576, 'MB')).toBe('3.0');
  });

  it('percentOf', () => {
    const pipe = new PercentOfPipe();
    expect(pipe.transform(1, 8)).toBe(12.5);
    expect(pipe.transform(1, 0)).toBe(0);
  });
});
