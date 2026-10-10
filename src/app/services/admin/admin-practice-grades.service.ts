import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PracticeGradeCreditRequest,
  PracticeGradeOverview,
  PracticeGradeUserDetail,
} from '../../models/practice-grades.model';

/** Gyakorló értékelések (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b): áttekintés, diák-részlet, kézi keret-jóváírás. */
@Injectable({ providedIn: 'root' })
export class AdminPracticeGradesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/practice-grades`;

  getOverview(days = 30): Observable<PracticeGradeOverview> {
    return this.http.get<PracticeGradeOverview>(`${this.base}/overview`, { params: new HttpParams().set('days', days) });
  }

  getUser(userId: number): Observable<PracticeGradeUserDetail> {
    return this.http.get<PracticeGradeUserDetail>(`${this.base}/users/${userId}`);
  }

  /** Naplózott jóváírás; a válasz a diák frissített keret-állása. */
  credit(userId: number, request: PracticeGradeCreditRequest): Observable<PracticeGradeUserDetail> {
    return this.http.post<PracticeGradeUserDetail>(`${this.base}/users/${userId}/credit`, request);
  }
}
