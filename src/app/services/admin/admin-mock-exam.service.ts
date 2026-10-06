import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminMockExam, AdminMockExamStatus, AdminMockExamTaskSetOption, AdminMockExamUpsert } from '../../models/mock-exam.model';

/** Próbaérettségi - admin (api/admin/mock-exams). */
@Injectable({ providedIn: 'root' })
export class AdminMockExamService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/mock-exams`;

  list(): Observable<AdminMockExam[]> {
    return this.http.get<AdminMockExam[]>(this.base);
  }

  taskSetOptions(): Observable<AdminMockExamTaskSetOption[]> {
    return this.http.get<AdminMockExamTaskSetOption[]>(`${this.base}/task-set-options`);
  }

  create(request: AdminMockExamUpsert): Observable<AdminMockExam> {
    return this.http.post<AdminMockExam>(this.base, request);
  }

  update(id: number, request: AdminMockExamUpsert): Observable<AdminMockExam> {
    return this.http.put<AdminMockExam>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  setPublished(id: number, published: boolean): Observable<AdminMockExam> {
    return this.http.post<AdminMockExam>(`${this.base}/${id}/${published ? 'publish' : 'unpublish'}`, {});
  }

  raiseBudget(id: number, totalBudgetUsd: number): Observable<AdminMockExam> {
    return this.http.post<AdminMockExam>(`${this.base}/${id}/budget`, { totalBudgetUsd });
  }

  publishResults(id: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.base}/${id}/publish-results`, {});
  }

  releasePractice(id: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.base}/${id}/release-practice`, {});
  }

  status(id: number): Observable<AdminMockExamStatus> {
    return this.http.get<AdminMockExamStatus>(`${this.base}/${id}/status`);
  }

  hideRegistration(registrationId: number, hidden: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/registrations/${registrationId}/hide`, {}, { params: new HttpParams().set('hidden', hidden) });
  }
}
