import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContestAdminProblem } from '../../models/contest-admin.model';

/** Verseny mód admin-lista (csak olvasás). */
@Injectable({ providedIn: 'root' })
export class AdminContestService {
  private readonly http = inject(HttpClient);

  getProblems(): Observable<ContestAdminProblem[]> {
    return this.http.get<ContestAdminProblem[]>(`${environment.apiUrl}/contest/problems`);
  }
}
