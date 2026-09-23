import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentService, AdminPaymentListItem } from '../../services/payments/payment.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css',
})
export class PaymentsComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);

  readonly items = signal<AdminPaymentListItem[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly isLoading = signal(false);

  query = '';
  status = '';
  refundedFilter: 'all' | 'true' | 'false' = 'all';
  reviewFilter: 'all' | 'true' | 'false' = 'all';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async search(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1) return;
    this.page.set(page);
    await this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE));
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.paymentService.getPage({
        query: this.query || undefined,
        status: this.status || undefined,
        refunded: this.refundedFilter === 'all' ? undefined : this.refundedFilter === 'true',
        needsManualReview: this.reviewFilter === 'all' ? undefined : this.reviewFilter === 'true',
        page: this.page(),
        pageSize: PAGE_SIZE,
      });
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
    } finally {
      this.isLoading.set(false);
    }
  }
}
