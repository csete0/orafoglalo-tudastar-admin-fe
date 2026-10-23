import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAINTENANCE_ACTION_BADGES, MAINTENANCE_ACTION_LABELS } from '../../../models/ai-spending.model';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { AiKoltesDecisionsState } from './ai-koltes-decisions.state';
import { AiKoltesMergeModalComponent } from './ai-koltes-merge-modal.component';

/**
 * AI-költés pult, Eredmények kezelése fül: a kiválasztott karbantartó-futás döntései akció-szűrővel, egyenkénti
 * inaktiválással és két kérdés összevonásával (modal). Az állapot az `AiKoltesDecisionsState`-ben (pult-szintű).
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-decisions',
  imports: [LocalSpinnerComponent, AiKoltesMergeModalComponent],
  styles: ':host { display: contents; }',
  template: `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div>
        <h2 class="font-bold text-lg">Karbantartási eredmények</h2>
        @if (state.selectedRunId(); as runId) {
          <p class="text-xs text-text-muted mt-0.5">Futás: #{{ runId.slice(0, 8) }}</p>
        } @else {
          <p class="text-xs text-text-muted mt-0.5">Válassz egy futást a Kvíz-karbantartás fülön ("Eredmények" gomb).</p>
        }
      </div>
    </div>

    @if (state.selectedRunId()) {
      <div class="flex gap-2 mb-4 flex-wrap text-xs">
        <button type="button" class="btn btn-ghost !px-3 !py-1.5" [class.!bg-bg-element]="!state.actionFilter()"
          (click)="state.actionFilter.set(null)">Mind ({{ state.decisions().length }})</button>
        @for (a of actions; track a) {
          <button type="button" class="btn btn-ghost !px-3 !py-1.5" [class.!bg-bg-element]="state.actionFilter() === a"
            (click)="state.actionFilter.set(a)">
            {{ actionLabel(a) }} ({{ state.countByAction(a) }})
          </button>
        }
      </div>

      <div class="flex items-center gap-3 mb-3">
        <span class="text-xs text-text-muted">
          {{ state.selectedForMerge().size === 2 ? '2 kérdés kijelölve - összevonhatók.' : 'Jelölj ki 2 kérdést az összevonáshoz (' + state.selectedForMerge().size + '/2).' }}
        </span>
        <button type="button" class="btn btn-primary !px-3 !py-1.5 !text-xs" [disabled]="state.selectedForMerge().size !== 2"
          (click)="state.openMergeModal()">
          Kijelöltek összevonása
        </button>
      </div>

      @if (state.decisionsLoading()) {
        <app-local-spinner />
      } @else {
        <div class="card divide-y divide-border-default">
          @for (d of state.filteredDecisions(); track d.questionId) {
            <div class="p-4">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <input type="checkbox" [checked]="state.selectedForMerge().has(d.questionId)"
                  (change)="state.toggleMergeSelection(d.questionId)" />
                <span class="badge" [class]="actionBadgeClass(d.action)">{{ actionLabel(d.action) }}</span>
                @if (d.isTeacherOwned) {
                  <span class="badge badge-neutral">{{ d.teacherName }} tanár kérdése</span>
                } @else {
                  <span class="badge badge-neutral">közös bank</span>
                }
              </div>
              <p class="text-sm">{{ d.newQuestionText || d.oldQuestionText }}</p>
              @if (d.reasoning) {
                <p class="text-xs text-text-muted italic mt-1">{{ d.reasoning }}</p>
              }
              <div class="mt-2">
                <button type="button" class="btn btn-danger !px-3 !py-1 !text-xs" (click)="state.deactivateQuestion(d)">Törlés</button>
              </div>
            </div>
          } @empty {
            <p class="p-6 text-center text-text-muted text-sm">Nincs ebbe a szűrésbe eső döntés.</p>
          }
        </div>
      }
    }

    @if (state.mergeModalOpen()) {
      <app-ai-koltes-merge-modal [candidates]="state.mergeCandidates()" [merging]="state.merging()"
        [(keepId)]="state.mergeKeepId" (closed)="state.mergeModalOpen.set(false)" (confirmed)="state.confirmMerge()" />
    }
  `,
})
export class AiKoltesDecisionsComponent {
  protected readonly state = inject(AiKoltesDecisionsState);
  protected readonly actions = ['Fixed', 'Deactivated', 'FlaggedForTeacher', 'ReplacementAdded', 'NoAction'];

  protected actionLabel(action: string): string {
    return MAINTENANCE_ACTION_LABELS[action] ?? action;
  }

  protected actionBadgeClass(action: string): string {
    return MAINTENANCE_ACTION_BADGES[action] ?? 'badge-neutral';
  }
}
