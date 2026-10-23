import { downloadCsv, toCsv } from './csv';

/** Karakterizáció (WP-A2): a pontosvesszős, magyar Excelhez igazított CSV mostani viselkedése. */
describe('toCsv', () => {
  it('pontosvesszővel tagol, CRLF-fel zár sort, a fejléc az első sor', () => {
    expect(toCsv(['a', 'b'], [['x', 'y'], ['z', 'w']])).toBe('a;b\r\nx;y\r\nz;w');
  });

  it('a null és az undefined üres mező', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 'x']])).toBe('a;b;c\r\n;;x');
  });

  it('a szám tizedesvesszőt kap, a negatív szám nem kap aposztrófot', () => {
    expect(toCsv(['n'], [[1234.5], [-5], [0]])).toBe('n\r\n1234,5\r\n-5\r\n0');
  });

  it('a képlettel kezdődő szöveg aposztrófot kap (CSV-injekció)', () => {
    expect(toCsv(['v'], [['=SUM(A1)'], ['+1'], ['-1'], ['@cmd'], ['\tx']]))
      .toBe("v\r\n'=SUM(A1)\r\n'+1\r\n'-1\r\n'@cmd\r\n'\tx");
  });

  it('a kocsivissza-kezdetű szöveg aposztrófot kap és idézőjelbe kerül', () => {
    expect(toCsv(['v'], [['\rx']])).toBe('v\r\n"\'\rx"');
  });

  it('a mező közepén álló képlet-karakter nem kap aposztrófot', () => {
    expect(toCsv(['v'], [['a=b'], ['x-y']])).toBe('v\r\na=b\r\nx-y');
  });

  it('a pontosvesszőt, idézőjelet vagy sortörést tartalmazó mező idézőjelbe kerül, a belső idézőjel duplázódik', () => {
    expect(toCsv(['v'], [['a;b'], ['say "hi"'], ['két\nsor'], ['x\r\ny']]))
      .toBe('v\r\n"a;b"\r\n"say ""hi"""\r\n"két\nsor"\r\n"x\r\ny"');
  });

  it('a képlet és a pontosvessző együtt: előbb aposztróf, aztán idézőjel', () => {
    expect(toCsv(['v'], [['=A1;B1']])).toBe('v\r\n"\'=A1;B1"');
  });

  it('a fejlécre ugyanazok a szabályok vonatkoznak', () => {
    expect(toCsv(['Név; teljes', '=x'], [])).toBe('"Név; teljes";\'=x');
  });
});

describe('downloadCsv', () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.restoreAllMocks();
  });

  it('UTF-8 BOM-os blobot tölt le a megadott néven, utána visszavonja az URL-t', async () => {
    let blob: Blob | undefined;
    const create = vi.fn((b: Blob) => { blob = b; return 'blob:teszt'; });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('riport.csv');
      expect(this.getAttribute('href')).toBe('blob:teszt');
    });

    downloadCsv('riport.csv', ['a', 'b'], [['é', 1.5]]);

    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:teszt');
    expect(blob!.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('a;b\r\né;1,5');
  });
});
