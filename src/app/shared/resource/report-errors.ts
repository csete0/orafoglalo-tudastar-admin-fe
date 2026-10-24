import { WritableSignal } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Közös hibasor egy resource-betöltéshez: a betöltés indulásakor törli, hibánál a `message` szövegét írja bele, a hibát
 * továbbadja (a resource így `error` állapotba kerül, a `latestValue` a korábbi értéket tartja). Akkor kell, ha egy oldalon
 * egyetlen hibasor van, amelyet a betöltések és a műveletek is írnak („a legutóbbi művelet hibája látszik”).
 */
export function reportErrors<T>(
  source: Observable<T>,
  error: WritableSignal<string | null>,
  message: (err: unknown) => string,
): Observable<T> {
  error.set(null);
  return source.pipe(
    catchError((err: unknown) => {
      error.set(message(err));
      return throwError(() => err);
    }),
  );
}
