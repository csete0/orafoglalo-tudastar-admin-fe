import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GitAdminRepo, GitQuota, GitQuotaUpdate } from '../../models/git.model';

/** Git-admin: kvóták, tárolók, zár, törlés (BE: AdminGitController). */
@Injectable({ providedIn: 'root' })
export class AdminGitService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/git`;

  getQuota(): Observable<GitQuota> {
    return this.http.get<GitQuota>(`${this.base}/quota`);
  }

  updateQuota(quota: GitQuotaUpdate): Observable<GitQuota> {
    return this.http.put<GitQuota>(`${this.base}/quota`, quota);
  }

  searchRepos(q: string): Observable<GitAdminRepo[]> {
    return this.http.get<GitAdminRepo[]>(`${this.base}/repos`, { params: new HttpParams().set('q', q).set('take', 100) });
  }

  lock(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/repos/${id}/lock`, { reason });
  }

  unlock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/repos/${id}/lock`);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/repos/${id}`);
  }
}
