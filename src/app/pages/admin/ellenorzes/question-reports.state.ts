import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminQuestionReportService } from '../../../services/admin/admin-question-report.service';
import { QuizQuestionReportDto } from '../../../models/question-report.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { latestValue } from '../../../shared/resource/latest-value';

/** A lista szűrője és oldala; minden szűrő- és oldalváltás új objektum, így ugyanarra a szűrőre kattintva is újratölt. */
export interface OpenListQuery {
  readonly onlyOpen: boolean;
  readonly page: number;
}

/**
 * A Kérdés-jelentések fül állapota. Az oldal `providers`-ében él, így fülváltáskor a szűrő, az oldal és a lista megmarad
 * (és nem töltődik újra). Az első betöltés a fül első megjelenésekor indul (ez az alapértelmezett fül).
 */
@Injectable()
export class QuestionReportsState {
  private readonly svc = inject(AdminQuestionReportService);
  private readonly toast = inject(ToastService);

  readonly pageSize = 20;
  readonly query = signal<OpenListQuery>({ onlyOpen: true, page: 1 });

  private readonly resource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.svc.getReports(params.onlyOpen, params.page, this.pageSize),
  });
  /** Betöltés közben és hiba után a korábbi lista marad; a műveletek helyben frissítik. */
  private readonly list = latestValue(this.resource);

  readonly reports = computed(() => this.list()?.items ?? []);
  readonly totalCount = computed(() => this.list()?.totalCount ?? 0);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => (this.resource.error() ? 'A jelentések betöltése sikertelen.' : null));
  readonly pending = signal(false);

  setOnlyOpen(onlyOpen: boolean): void {
    this.query.set({ onlyOpen, page: 1 });
  }

  setPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  resolve(report: QuizQuestionReportDto): void {
    this.pending.set(true);
    this.svc.resolve(report.id).subscribe({
      next: () => {
        this.pending.set(false);
        this.list.update((list) => list && (this.query().onlyOpen
          ? { items: list.items.filter((r) => r.id !== report.id), totalCount: list.totalCount - 1 }
          : { ...list, items: list.items.map((r) => (r.id === report.id ? { ...r, isReviewed: true } : r)) }));
        this.toast.success('Elintézve jelölve.');
      },
      error: () => { this.pending.set(false); this.toast.danger('Hiba történt.'); },
    });
  }

  approveQuestion(report: QuizQuestionReportDto): void {
    this.pending.set(true);
    this.svc.approveQuestion(report.questionId).subscribe({
      next: () => {
        this.pending.set(false);
        this.list.update((list) => list && {
          ...list,
          items: list.items.map((r) => (r.questionId === report.questionId ? { ...r, questionIsApproved: true } : r)),
        });
        this.toast.success('Kérdés visszaengedélyezve.');
      },
      error: () => { this.pending.set(false); this.toast.danger('Hiba történt.'); },
    });
  }
}
