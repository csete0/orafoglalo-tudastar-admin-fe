import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { PagerComponent } from '../../../shared/pager/pager.component';
import { QuestionReportsState } from './question-reports.state';

/**
 * Ellenőrzés oldal, Kérdés-jelentések fül: szűrő (nyitott / összes), lista az „Elintézve” és a „Kérdés visszaengedélyezése”
 * művelettel, lapozó. Az állapot a `QuestionReportsState`-ben (oldal-szintű). A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-question-reports-tab',
  imports: [DatePipe, LocalSpinnerComponent, PagerComponent],
  styles: ':host { display: contents; }',
  template: `
    <div class="flex gap-2 mb-6 text-sm flex-wrap">
      @for (option of filterOptions; track option.value) {
        <button (click)="state.setOnlyOpen(option.value)"
          class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
          [class.bg-primary]="state.query().onlyOpen === option.value"
          [class.text-white]="state.query().onlyOpen === option.value"
          [class.border-primary]="state.query().onlyOpen === option.value"
          [class.border-border-default]="state.query().onlyOpen !== option.value"
          [class.text-text-muted]="state.query().onlyOpen !== option.value">
          {{ option.label }}
        </button>
      }
    </div>

    @if (state.error()) {
      <p class="text-danger text-sm mb-4">{{ state.error() }}</p>
    }
    @if (state.loading()) {
      <app-local-spinner />
    } @else {
      <ul class="space-y-3">
        @for (report of state.reports(); track report.id) {
          <li class="card p-4">
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">{{ report.questionText }}</p>
                <p class="text-xs text-text-muted mt-0.5">
                  @if (report.quizTitle) {
                    Kvíz: <span class="font-semibold">{{ report.quizTitle }}</span> ·
                  } @else {
                    <span class="italic">Közös bank-kérdés</span> ·
                  }
                  Téma: {{ report.topicName }} · {{ report.questionReportCount }} jelentés
                  @if (!report.questionIsApproved) {
                    · <span class="text-warning font-semibold">deaktivált</span>
                  }
                </p>
              </div>
              <span class="text-xs text-text-muted shrink-0">{{ report.createdAt | date: 'yyyy.MM.dd' }}</span>
            </div>
            @if (report.reason) {
              <p class="text-sm mb-2 break-words border-l-2 border-border-default pl-2 text-text-muted italic">
                „{{ report.reason }}"
              </p>
            }
            @if (report.isReviewed) {
              <span class="badge badge-success text-xs">Elintézve {{ report.reviewedAt | date: 'yyyy.MM.dd' }}</span>
            } @else {
              <div class="flex gap-2 mt-2">
                <button (click)="state.resolve(report)" [disabled]="state.pending()"
                  class="btn btn-primary !px-3 !py-1.5 !text-xs">
                  Elintézve
                </button>
                @if (!report.questionIsApproved) {
                  <button (click)="state.approveQuestion(report)" [disabled]="state.pending()"
                    class="btn !bg-success !text-white !px-3 !py-1.5 !text-xs">
                    Kérdés visszaengedélyezése
                  </button>
                }
              </div>
            }
          </li>
        } @empty {
          <li class="text-text-muted text-sm py-6 text-center">
            {{ state.query().onlyOpen ? 'Nincs elintézetlen jelentés.' : 'Nincs egyetlen jelentés sem.' }}
          </li>
        }
      </ul>

      @if (state.totalCount() > state.pageSize) {
        <div class="flex items-center gap-4 mt-6 text-sm" app-pager variant="ghost" [page]="state.query().page"
          [pageSize]="state.pageSize" [total]="state.totalCount()" (pageChange)="state.setPage($event)"></div>
      }
    }
  `,
})
export class QuestionReportsTabComponent {
  protected readonly state = inject(QuestionReportsState);

  protected readonly filterOptions = [
    { value: true, label: 'Csak nyitottak' },
    { value: false, label: 'Összes' },
  ];
}
