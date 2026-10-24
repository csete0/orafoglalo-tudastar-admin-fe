import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subscription, catchError, filter, map, repeat, switchMap, take, tap, timer } from 'rxjs';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { QuizMaintenanceEstimateDto, QuizMaintenanceRunDto } from '../../../models/ai-spending.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';

/** UI-TT-235: a futás-figyelő legfeljebb ~3 percig (20 × 8 mp) fut. */
const POLL_INTERVAL_MS = 8000;
const POLL_ATTEMPTS = 20;

/**
 * A Kvíz-karbantartás fül állapota (form, becslés, indítás, előzmények, futás-figyelő). A pult `providers`-ében él, így
 * fülváltáskor a form és a becslés megmarad, és az indított futás figyelése más fülön is folytatódik; a pult megszűnésekor
 * a figyelés leáll. Lusta: az előzmények az első `start()`-kor töltődnek.
 */
@Injectable()
export class AiKoltesMaintenanceState {
  private readonly svc = inject(AdminAiSpendingService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  form: { rangeStartId: number | null; rangeEndId: number | null; model: string; dryRun: boolean } = {
    rangeStartId: null,
    rangeEndId: null,
    model: 'openai/gpt-4o-mini',
    dryRun: true,
  };
  readonly estimate = signal<QuizMaintenanceEstimateDto | null>(null);
  readonly estimating = signal(false);
  readonly running = signal(false);
  readonly runs = signal<QuizMaintenanceRunDto[]>([]);
  readonly runsLoading = signal(false);

  private started = false;
  private poll: Subscription | null = null;

  /** Az előzmények első betöltése (idempotens). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.loadRuns();
  }

  loadEstimate(): void {
    this.estimating.set(true);
    const { rangeStartId, rangeEndId, model } = this.form;
    this.svc.estimateMaintenanceRun({ rangeStartId, rangeEndId, model }).subscribe({
      next: (est) => {
        this.estimate.set(est);
        this.estimating.set(false);
      },
      error: (err) => {
        this.estimating.set(false);
        this.toast.danger(extractErrorMessage(err, 'A becslés lekérése sikertelen.'));
      },
    });
  }

  async runMaintenance(): Promise<void> {
    const { rangeStartId, rangeEndId, model, dryRun } = this.form;
    const ok = await this.confirmService.ask({
      message: dryRun
        ? 'Elindítod a próbafuttatást? Az eredmény csak megjelenik, az adatbázisba semmi nem íródik.'
        : 'Elindítod az ÉLES kvíz-karbantartó futtatást? Ez valódi módosításokat végez a kérdésbankban.',
      danger: !dryRun,
      confirmLabel: 'Futtatás indítása',
    });
    if (!ok) return;

    // UI-TT-235: a backend a tényleges (percekig tartó) AI-átvizsgálást háttérfeladatba teszi - ez a hívás csak a
    // futás-sort hozza létre és AZONNAL visszatér. Az eredményt rövid, korlátozott ideig tartó pollozással frissítjük,
    // hogy az adminnak ne kelljen kézzel újratöltenie az oldalt.
    this.running.set(true);
    this.poll?.unsubscribe();
    this.svc.runMaintenance({ rangeStartId, rangeEndId, model, dryRun }).subscribe({
      next: (result) => {
        this.running.set(false);
        this.toast.success('Futtatás elindítva a háttérben - az eredmény a Futtatási előzményekben jelenik meg.');
        this.loadRuns();
        this.watchRun(result.runId);
      },
      error: (err) => {
        this.running.set(false);
        this.toast.danger(extractErrorMessage(err, 'A futtatás indítása sikertelen.'));
      },
    });
  }

  /**
   * UI-TT-235: 8 mp-enként (legfeljebb 20-szor; a hibás válasz is egy próbálkozás) újratölti az előzményeket, amíg a
   * futás be nem fejeződik (completedAt), és záró toast-tal jelzi. Ha a türelmi idő lejár, csendben leáll - a futás a
   * szerveren tovább fut, a listában „folyamatban…” marad.
   */
  private watchRun(runId: string): void {
    this.poll = timer(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.svc.getMaintenanceRuns(1, 20).pipe(catchError(() => EMPTY))),
        repeat(POLL_ATTEMPTS),
        tap((page) => this.runs.set(page.items)),
        map((page) => page.items.find((r) => r.id === runId)),
        filter((run): run is QuizMaintenanceRunDto => !!run?.completedAt),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((run) => this.toast.success(`Futtatás kész: ${run.candidatesReviewed} kérdés átnézve.`));
  }

  private loadRuns(): void {
    this.runsLoading.set(true);
    this.svc.getMaintenanceRuns(1, 20).subscribe({
      next: (page) => {
        this.runs.set(page.items);
        this.runsLoading.set(false);
      },
      error: () => this.runsLoading.set(false),
    });
  }
}
