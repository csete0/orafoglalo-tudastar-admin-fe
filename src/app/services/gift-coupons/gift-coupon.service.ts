import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

  async getPage(filter: GiftCouponFilter): Promise<GiftCouponPage> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.code) params = params.set('code', filter.code);
    if (filter.email) params = params.set('email', filter.email);
    if (filter.redeemed !== undefined) params = params.set('redeemed', filter.redeemed);
    if (filter.active !== undefined) params = params.set('active', filter.active);

    return firstValueFrom(
      this.http.get<GiftCouponPage>(`${environment.apiUrl}/gift-coupons`, { params }),
    );
  }

  async resend(id: number, toPurchaser: boolean, toChild: boolean): Promise<ResendResult> {
    return firstValueFrom(
      this.http.post<ResendResult>(`${environment.apiUrl}/gift-coupons/${id}/resend`, {
        toPurchaser,
        toChild,
      }),
    );
  }

  async deactivate(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/gift-coupons/${id}/deactivate`, {}));
  }
}
