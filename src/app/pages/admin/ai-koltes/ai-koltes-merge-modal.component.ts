import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { QuizMaintenanceDecisionDto } from '../../../models/ai-spending.model';

/**
 * Két kérdés összevonása: a `keepId` (kétirányú) a megtartott kérdés, a másik a duplikátum. Ha a duplikátum tanári
 * tulajdon, figyelmeztet. A háttérre vagy a „Mégse” gombra kattintás `closed`-ot, a megerősítés `confirmed`-et ad.
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-merge-modal',
  styles: ':host { display: contents; }',
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" (click)="closed.emit()">
      <div class="card w-full max-w-lg p-6" (click)="$event.stopPropagation()">
        <h2 class="font-bold text-lg mb-2">Kérdések összevonása</h2>
        <p class="text-xs text-text-muted mb-4">
          A megtartott kérdés marad a rendszerben, a duplikátum inaktiválódik.
        </p>

        @for (q of candidates(); track q.questionId) {
          <label class="flex gap-2.5 items-start p-3 border border-border-default rounded-lg cursor-pointer mb-2">
            <input type="radio" name="merge-target" class="mt-1"
              [checked]="keepId() === q.questionId" (change)="keepId.set(q.questionId)" />
            <span class="text-sm">
              <strong>{{ keepId() === q.questionId ? 'Megtartva:' : 'Duplikátum:' }}</strong>
              "{{ q.newQuestionText || q.oldQuestionText }}"
              @if (q.isTeacherOwned) {
                <span class="badge badge-warning ml-1">{{ q.teacherName }} tanár kérdése</span>
              } @else {
                <span class="badge badge-neutral ml-1">közös bank</span>
              }
            </span>
          </label>
        }

        @if (duplicateIsTeacherOwned()) {
          <div class="flex gap-3 p-3 rounded-lg bg-warning-subtle border border-warning/30 mt-3">
            <p class="text-xs">
              <strong class="block mb-0.5">Az egyik kérdés tanári tulajdon.</strong>
              A duplikátum nem törlődik, hanem inaktiválódik, és a tulajdonos tanár értesítést kap.
            </p>
          </div>
        }

        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Mégse</button>
          <button type="button" class="btn btn-primary" [disabled]="!keepId() || merging()" (click)="confirmed.emit()">
            {{ merging() ? 'Összevonás...' : 'Összevonás - tanár értesítése' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AiKoltesMergeModalComponent {
  readonly candidates = input.required<QuizMaintenanceDecisionDto[]>();
  readonly merging = input(false);
  readonly keepId = model<number | null>(null);
  readonly closed = output();
  readonly confirmed = output();

  protected readonly duplicateIsTeacherOwned = computed(() => {
    const keepId = this.keepId();
    return this.candidates().some((q) => q.questionId !== keepId && q.isTeacherOwned);
  });
}
