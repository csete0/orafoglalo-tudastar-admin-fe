import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentService } from '../../services/payments/payment.service';
import { PagerComponent } from '../../shared/pager/pager.component';
import { latestValue } from '../../shared/resource/latest-value';

const PAGE_SIZE = 50;

type YesNoFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-payments',
  imports: [ReactiveFormsModule, RouterLink, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments.component.html',
  styleUrls: ['../list-page.css', './payments.component.css'],
})
export class PaymentsComponent {
  private readonly paymentService = inject(PaymentService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly pageSize = PAGE_SIZE;
  /** A szűrő-mezők; csak a Szűrés gombbal lépnek érvénybe. */
  readonly form = this.fb.group({
    query: '',
    status: '',
    refundedFilter: this.fb.control<YesNoFilter>('all'),
    reviewFilter: this.fb.control<YesNoFilter>('all'),
  });
  private readonly filter = signal(this.form.getRawValue());
  readonly page = signal(1);

  private readonly result = rxResource({
    params: () => {
      const f = this.filter();
      return {
        query: f.query || undefined,
        status: f.status || undefined,
        refunded: f.refundedFilter === 'all' ? undefined : f.refundedFilter === 'true',
        needsManualReview: f.reviewFilter === 'all' ? undefined : f.reviewFilter === 'true',
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
    },
    stream: ({ params }) => this.paymentService.getPage(params),
  });
  private readonly latest = latestValue(this.result);
  readonly items = computed(() => this.latest()?.items ?? []);
  readonly totalCount = computed(() => this.latest()?.totalCount ?? 0);
  readonly isLoading = this.result.isLoading;

  search(): void {
    this.page.set(1);
    this.filter.set(this.form.getRawValue());
  }

  goToPage(page: number): void {
    if (page >= 1) this.page.set(page);
  }
}
