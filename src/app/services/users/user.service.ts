import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSearchResult {
  id: number;
  email: string;
  displayName: string | null;
  roles: string[];
  createdAt: string | null;
  hasActiveSubscription: boolean;
  isLockedOut: boolean;
}

export interface UserSearchPage {
  items: UserSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UserSearchFilter {
  query?: string;
  role?: string;
  subscriptionStatus?: string;
  page: number;
  pageSize: number;
}

export interface UserDetailSubscription {
  id: number;
  subscriptionTypeName: string | null;
  status: string;
  startDate: string;
  endDate: string;
  isCancelled: boolean;
  autoRenew: boolean;
  activatedViaGift: boolean;
}

export interface UserDetailPayment {
  id: number;
  amount: number;
  paymentDate: string;
  status: string;
  paymentMethod: string | null;
  refunded: boolean;
  needsManualReview: boolean;
  stripePaymentIntentUrl: string | null;
}

export interface UserDetailGroupMembership {
  groupId: number;
  groupName: string;
  joinedAt: string;
  removedAt: string | null;
}

export interface UserDetailParentEmail {
  email: string;
  isVerified: boolean;
}

export interface UserDetailTeacherProfile {
  teacherProfileId: number;
  displayName: string;
  institutionName: string | null;
  isActive: boolean;
  maxTaskSets: number | null;
  actualTaskSetCount: number;
  maxStorageBytes: number | null;
  actualStorageBytes: number;
  groupNames: string[];
  schoolNames: string[];
}

export interface UserDetail {
  id: number;
  email: string;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  emailConfirmed: boolean;
  isLockedOut: boolean;
  roles: string[];
  trialEndsAt: string | null;
  subscriptions: UserDetailSubscription[];
  payments: UserDetailPayment[];
  groupMemberships: UserDetailGroupMembership[];
  parentEmails: UserDetailParentEmail[];
  teacherProfile: UserDetailTeacherProfile | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  async search(filter: UserSearchFilter): Promise<UserSearchPage> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.query) params = params.set('query', filter.query);
    if (filter.role) params = params.set('role', filter.role);
    if (filter.subscriptionStatus) params = params.set('subscriptionStatus', filter.subscriptionStatus);

    return firstValueFrom(this.http.get<UserSearchPage>(`${environment.apiUrl}/users`, { params }));
  }

  async getDetail(id: number): Promise<UserDetail> {
    return firstValueFrom(this.http.get<UserDetail>(`${environment.apiUrl}/users/${id}`));
  }
}
