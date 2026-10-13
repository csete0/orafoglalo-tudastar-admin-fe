import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, take } from 'rxjs/operators';
import { AdminContestService } from './admin-contest.service';
import { ContestAdminProblem } from '../../models/contest-admin.model';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';

/** A „Verseny” lap állapota (AdminPracticeGradesStore mintája). */
@Injectable({ providedIn: 'root' })
export class AdminContestStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(AdminContestService);

  private readonly _problems = signal<ContestAdminProblem[] | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly problems = this._problems.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.service
      .getProblems()
      .pipe(take(1), finalize(() => this._loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (problems) => this._problems.set(problems),
        error: (err) => this._error.set(extractErrorMessage(err, 'A verseny-feladatok betöltése nem sikerült.')),
      });
  }
}
