import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AdminPracticeGradesService } from './admin-practice-grades.service';
import { PracticeGradeOverview } from '../../models/practice-grades.model';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';

/**
 * A „Gyakorló értékelések” lap állapota (AdminSchoolStore mintája).
 * Root store: az állapota oldalváltáskor szándékosan megmarad (owner-döntés, 2026-10-23).
 */
@Injectable({ providedIn: 'root' })
export class AdminPracticeGradesStore {
  private readonly service = inject(AdminPracticeGradesService);

  private readonly _overview = signal<PracticeGradeOverview | null>(null);
  private readonly _days = signal(30);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly overview = this._overview.asReadonly();
  readonly days = this._days.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** A Failed értékelések aránya az ablakban (0–1); null, ha nem volt értékelés. */
  readonly failedRate = computed(() => {
    const o = this._overview();
    return o && o.totalCount > 0 ? o.failedCount / o.totalCount : null;
  });

  load(days = this._days()): void {
    this._days.set(days);
    this._loading.set(true);
    this._error.set(null);

    this.service
      .getOverview(days)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (overview) => this._overview.set(overview),
        error: (err) => this._error.set(extractErrorMessage(err, 'A gyakorló értékelések betöltése nem sikerült.')),
      });
  }
}
