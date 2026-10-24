import { UtcPipe } from './utc.pipe';

/** Karakterizáció (WP-A2): a zóna nélküli admin-API időpontot UTC-ként olvassa. */
describe('UtcPipe', () => {
  const pipe = new UtcPipe();

  it('üres értékre null', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform('')).toBeNull();
  });

  it('a zóna nélküli időpontot UTC-nek veszi', () => {
    expect(pipe.transform('2026-10-01T10:00:00')!.toISOString()).toBe('2026-10-01T10:00:00.000Z');
  });

  it('a törtmásodperces, zóna nélküli időpontot is UTC-nek veszi', () => {
    expect(pipe.transform('2026-10-01T10:00:00.123')!.toISOString()).toBe('2026-10-01T10:00:00.123Z');
  });

  it('a megadott zónát (Z, z, ±hh:mm) tiszteletben tartja', () => {
    expect(pipe.transform('2026-10-01T10:00:00Z')!.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(pipe.transform('2026-10-01T10:00:00z')!.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(pipe.transform('2026-10-01T12:00:00+02:00')!.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(pipe.transform('2026-10-01T05:00:00-05:00')!.toISOString()).toBe('2026-10-01T10:00:00.000Z');
  });
});
