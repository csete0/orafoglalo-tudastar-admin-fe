import { Injectable, computed, inject, signal } from '@angular/core';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { QuizMaintenanceDecisionDto } from '../../../models/ai-spending.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';

/**
 * Az Eredmények kezelése fül állapota: a kiválasztott futás döntései, az akció-szűrő, az összevonásra kijelölt (legfeljebb
 * 2) kérdés és az összevonás-modal. A pult `providers`-ében él, így fülváltáskor megmarad; az `open()` (a karbantartás
 * „Eredmények” gombja) mindent visszaállít és újratölt.
 */
@Injectable()
export class AiKoltesDecisionsState {
  private readonly svc = inject(AdminAiSpendingService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly selectedRunId = signal<string | null>(null);
  readonly decisions = signal<QuizMaintenanceDecisionDto[]>([]);
  readonly decisionsLoading = signal(false);
  readonly actionFilter = signal<string | null>(null);
  readonly selectedForMerge = signal<Set<number>>(new Set());
  readonly mergeModalOpen = signal(false);
  readonly mergeKeepId = signal<number | null>(null);
  readonly merging = signal(false);

  readonly filteredDecisions = computed(() => {
    const filter = this.actionFilter();
    const all = this.decisions();
    return filter ? all.filter((d) => d.action === filter) : all;
  });

  readonly mergeCandidates = computed(() => {
    const ids = this.selectedForMerge();
    return this.decisions().filter((d) => ids.has(d.questionId));
  });

  open(runId: string): void {
    this.selectedRunId.set(runId);
    this.actionFilter.set(null);
    this.selectedForMerge.set(new Set());
    this.decisionsLoading.set(true);
    this.svc.getRunDecisions(runId).subscribe({
      next: (data) => {
        this.decisions.set(data);
        this.decisionsLoading.set(false);
      },
      error: (err) => {
        this.decisionsLoading.set(false);
        this.toast.danger(extractErrorMessage(err, 'Az eredmények betöltése sikertelen.'));
      },
    });
  }

  countByAction(action: string): number {
    return this.decisions().filter((d) => d.action === action).length;
  }

  async deactivateQuestion(d: QuizMaintenanceDecisionDto): Promise<void> {
    const ok = await this.confirmService.ask({
      message: 'Inaktiválod ezt a kérdést? A közös bankban/kvízben többé nem jelenik meg diákoknak.',
      danger: true,
      confirmLabel: 'Inaktiválás',
    });
    if (!ok) return;

    this.svc.deactivateQuestion(d.questionId).subscribe({
      next: () => {
        this.toast.success('Kérdés inaktiválva.');
        this.decisions.update((list) => list.filter((x) => x.questionId !== d.questionId));
        this.selectedForMerge.update((set) => {
          const next = new Set(set);
          next.delete(d.questionId);
          return next;
        });
      },
      error: (err) => this.toast.danger(extractErrorMessage(err, 'Az inaktiválás sikertelen.')),
    });
  }

  toggleMergeSelection(questionId: number): void {
    this.selectedForMerge.update((set) => {
      const next = new Set(set);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else if (next.size < 2) {
        next.add(questionId);
      }
      return next;
    });
  }

  openMergeModal(): void {
    const [first] = this.selectedForMerge();
    this.mergeKeepId.set(first ?? null);
    this.mergeModalOpen.set(true);
  }

  confirmMerge(): void {
    const keepId = this.mergeKeepId();
    const ids = [...this.selectedForMerge()];
    const duplicateId = ids.find((id) => id !== keepId);
    if (!keepId || !duplicateId) return;

    this.merging.set(true);
    this.svc.mergeQuestions({ keepQuestionId: keepId, duplicateQuestionId: duplicateId }).subscribe({
      next: (result) => {
        this.merging.set(false);
        this.mergeModalOpen.set(false);
        this.toast.success(result.teacherNotified ? 'Összevonva - a tanár értesítést kapott.' : 'Kérdések összevonva.');
        this.decisions.update((list) => list.filter((x) => x.questionId !== duplicateId));
        this.selectedForMerge.set(new Set());
      },
      error: (err) => {
        this.merging.set(false);
        this.toast.danger(extractErrorMessage(err, 'Az összevonás sikertelen.'));
      },
    });
  }
}
