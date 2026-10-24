import { Injectable, signal, inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AdminSchoolService } from './admin-school.service';
import { SchoolAdminDto, SchoolMergeResultDto } from '../../models/teacher-moderation.model';

// Root store: az állapota oldalváltáskor szándékosan megmarad (owner-döntés, 2026-10-23).
@Injectable({ providedIn: 'root' })
export class AdminSchoolStore {
  private readonly service = inject(AdminSchoolService);

  private readonly _schools = signal<SchoolAdminDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _lastMergeResult = signal<SchoolMergeResultDto | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly schools = this._schools.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly lastMergeResult = this._lastMergeResult.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    // UI-TT-65: korábban egy sima next-only callbackkel subscribe-olt - hiba
    // esetén a store error()-je sosem állt be (a admin némán "üres listát" látott
    // volna), ÉS egy kezeletlen RxJS-kivétel is landolt (a "ERROR HttpErrorResponse"
    // konzol-tünet).
    this.service
      .getSchools()
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (schools) => this._schools.set(schools),
        error: (err) => this._error.set(err.error?.errorMessage ?? 'Az intézmények betöltése sikertelen.'),
      });
  }

  /**
   * Siker esetén a lista teljes újratöltéssel frissül — egyszerűbb, mint
   * optimista update, mert egy egyesítés két sort is módosít egyszerre
   * (a forrás eltűnik, a cél számai nőnek). Sikertelen egyesítésnél (pl.
   * a backend OrafoglaloException-t dob, mert a forrás időközben törölve
   * lett) a korábbi, immár félrevezető sikeres eredményt is töröljük, hogy
   * ne maradjon egy ellentmondó "Egyesítés sikeres." panel a képernyőn.
   */
  merge(sourceSchoolId: number, targetSchoolId: number): void {
    if (this._loading()) return;

    this._loading.set(true);
    this._error.set(null);

    // Nincs finalize() itt: siker esetén load() maga felel a loading
    // ki/be kapcsolásáért (a listát is újratölti), így a gomb a teljes
    // egyesítés+újratöltés alatt letiltva marad. Hiba esetén viszont
    // load() sosem fut le, ezért azt a loading-jelet itt kapcsoljuk ki.
    this.service
      .merge(sourceSchoolId, targetSchoolId)
      .subscribe({
        next: (result) => {
          this._lastMergeResult.set(result);
          this.load();
        },
        error: (err) => {
          this._lastMergeResult.set(null);
          this._error.set(err.error?.errorMessage ?? 'Az egyesítés sikertelen.');
          this._loading.set(false);
        },
      });
  }

  /** Próbaérettségi-nyilvánosság jóváhagyása / visszavonása; sikerre a lista újratöltődik (merge() mintája). */
  setPublicApproval(schoolId: number, approved: boolean): void {
    if (this._loading()) return;

    this._loading.set(true);
    this._error.set(null);

    this.service
      .setPublicApproval(schoolId, approved)
      .subscribe({
        next: () => this.load(),
        error: (err) => {
          this._error.set(err.error?.errorMessage ?? 'A nyilvánosság módosítása sikertelen.');
          this._loading.set(false);
        },
      });
  }

  clearError(): void {
    this._error.set(null);
  }
}
