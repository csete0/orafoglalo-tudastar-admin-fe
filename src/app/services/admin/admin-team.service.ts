import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminTeamDetail, AdminTeamRow } from '../../models/team.model';

/** Csapat-admin (BE: AdminTeamsController). */
@Injectable({ providedIn: 'root' })
export class AdminTeamService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/teams`;

  search(q: string, problems: boolean): Observable<AdminTeamRow[]> {
    return this.http.get<AdminTeamRow[]>(this.base, { params: new HttpParams().set('q', q).set('problems', problems).set('take', 100) });
  }
  get(id: number): Observable<AdminTeamDetail> { return this.http.get<AdminTeamDetail>(`${this.base}/${id}`); }
  retryMirror(id: number): Observable<void> { return this.http.post<void>(`${this.base}/${id}/github/retry`, {}); }
  unlink(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}/github`); }
}
