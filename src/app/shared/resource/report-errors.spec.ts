import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { reportErrors } from './report-errors';

describe('reportErrors', () => {
  it('induláskor törli a hibasort, sikernél nem ír bele', () => {
    const error = signal<string | null>('régi hiba');
    const values: number[] = [];
    reportErrors(of(1), error, () => 'hiba').subscribe((v) => values.push(v));
    expect(error()).toBeNull();
    expect(values).toEqual([1]);
  });

  it('hibánál a saját üzenetét írja (a hibából is számolhat), és a hibát továbbadja', () => {
    const error = signal<string | null>(null);
    const source = new Subject<number>();
    const failure = { status: 500 };
    let received: unknown;
    reportErrors(source, error, (err) => `kód: ${(err as { status: number }).status}`).subscribe({ error: (err: unknown) => (received = err) });
    source.error(failure);
    expect(error()).toBe('kód: 500');
    expect(received).toBe(failure);
  });
});
