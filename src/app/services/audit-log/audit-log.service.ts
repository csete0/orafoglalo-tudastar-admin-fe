import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminAuditLogEntry {
  id: number;
  atUtc: string;
  actorUserId: string | null;
  actorIp: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  success: boolean;
}

export interface AdminAuditLogPage {
  items: AdminAuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilter {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  success?: boolean;
  fromUtc?: string;
  toUtc?: string;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  async getPage(filter: AuditLogFilter): Promise<AdminAuditLogPage> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.actorUserId) params = params.set('actorUserId', filter.actorUserId);
    if (filter.action) params = params.set('action', filter.action);
    if (filter.targetType) params = params.set('targetType', filter.targetType);
    if (filter.success !== undefined) params = params.set('success', filter.success);
    if (filter.fromUtc) params = params.set('fromUtc', filter.fromUtc);
    if (filter.toUtc) params = params.set('toUtc', filter.toUtc);

    return firstValueFrom(
      this.http.get<AdminAuditLogPage>(`${environment.apiUrl}/audit-log`, { params }),
    );
  }

  async getTargetTypes(): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${environment.apiUrl}/audit-log/target-types`));
  }
}
