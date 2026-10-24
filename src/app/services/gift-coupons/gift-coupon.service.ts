import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GiftCouponListItem {
  id: number;
  code: string;
  subscriptionTypeName: string | null;
  purchaserEmail: string | null;
  childEmail: string | null;
  isRedeemed: boolean;
  redeemedAt: string | null;
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface GiftCouponPage {
  items: GiftCouponListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GiftCouponFilter {
  code?: string;
  email?: string;
  redeemed?: boolean;
  active?: boolean;
  page: number;
  pageSize: number;
}

export interface ResendResult {
  sentToPurchaser: boolean;
  sentToChild: boolean;
}

@Injectable({ providedIn: 'root' })
export class GiftCouponService {
  private readonly http = inject(HttpClient);

  getPage(filter: GiftCouponFilter): Observable<GiftCouponPage> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.code) params = params.set('code', filter.code);
    if (filter.email) params = params.set('email', filter.email);
    if (filter.redeemed !== undefined) params = params.set('redeemed', filter.redeemed);
    if (filter.active !== undefined) params = params.set('active', filter.active);

    return this.http.get<GiftCouponPage>(`${environment.apiUrl}/gift-coupons`, { params });
  }

  resend(id: number, toPurchaser: boolean, toChild: boolean): Observable<ResendResult> {
    return this.http.post<ResendResult>(`${environment.apiUrl}/gift-coupons/${id}/resend`, { toPurchaser, toChild });
  }

  deactivate(id: number): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/gift-coupons/${id}/deactivate`, {});
  }
}
