import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TabBarComponent, TabItem } from '../../shared/tab-bar/tab-bar.component';
import { AdminGradeDisputesComponent } from './admin-grade-disputes.component';
import { QuestionReportsTabComponent } from './ellenorzes/question-reports-tab.component';
import { QuestionReportsState } from './ellenorzes/question-reports.state';
import { InquiriesTabComponent } from './ellenorzes/inquiries-tab.component';
import { InquiriesState } from './ellenorzes/inquiries.state';
import { PaymentReviewTabComponent } from './ellenorzes/payment-review-tab.component';
import { PaymentReviewState } from './ellenorzes/payment-review.state';

type Tab = 'reports' | 'inquiries' | 'payments' | 'grades';

/**
 * Ellenőrzés oldal: fülsor és a négy fül. A három lista állapota oldal-szintű (`providers`), így fülváltáskor megmarad;
 * az Érdeklődések és a Fizetések lusta (a fülre lépéskor tölt).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-ellenorzes',
  imports: [TabBarComponent, QuestionReportsTabComponent, InquiriesTabComponent, PaymentReviewTabComponent, AdminGradeDisputesComponent],
  providers: [QuestionReportsState, InquiriesState, PaymentReviewState],
  template: `
    <div class="max-w-5xl">
      <h1 class="page-title">Ellenőrzés</h1>
      <div class="hairline"></div>

      <div app-tab-bar variant="underline" class="flex gap-1 mb-6 text-sm border-b border-border-default" role="tablist"
        [tabs]="tabs" [active]="activeTab()" (activeChange)="setTab($event)"></div>

      @switch (activeTab()) {
        @case ('reports') { <app-question-reports-tab /> }
        @case ('inquiries') { <app-inquiries-tab /> }
        @case ('payments') { <app-payment-review-tab /> }
        @case ('grades') { <app-admin-grade-disputes /> }
      }
    </div>
  `,
})
export class AdminEllenorzesComponent {
  private readonly inquiries = inject(InquiriesState);
  private readonly payments = inject(PaymentReviewState);

  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'reports', label: 'Kérdés-jelentések' },
    { id: 'inquiries', label: 'Érdeklődések' },
    { id: 'payments', label: 'Fizetések' },
    { id: 'grades', label: 'Értékelési kifogások' },
  ];
  readonly activeTab = signal<Tab>('reports');

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'inquiries') this.inquiries.enter();
    if (tab === 'payments') this.payments.enter();
  }
}
