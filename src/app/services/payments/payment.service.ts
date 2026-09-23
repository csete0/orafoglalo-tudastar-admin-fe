import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminPaymentListItem {
  id: number;
  userId: number;
  userEmail: string | null;
  amount: number;
  paymentDate: string;
  status: string;
  paymentMethod: string | null;
  refunded: boolean;
  needsManualReview: boolean;
  stripePaymentIntentUrl: string | null;
  stripeCustomerUrl: string | null;
}

export interface AdminPaymentPage {
  items: AdminPaymentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PaymentFilter {
  query?: string;
  status?: string;
  refunded?: boolean;
  needsManualReview?: boolean;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  async getPage(filter: PaymentFilter): Promise<AdminPaymentPage> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.query) params = params.set('query', filter.query);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.refunded !== undefined) params = params.set('refunded', filter.refunded);
    if (filter.needsManualReview !== undefined) params = params.set('needsManualReview', filter.needsManualReview);

    return firstValueFrom(this.http.get<AdminPaymentPage>(`${environment.apiUrl}/payments`, { params }));
  }
}
