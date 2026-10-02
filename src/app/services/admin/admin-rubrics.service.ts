import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RubricDetail, RubricTaskRow } from '../../models/rubrics.model';

/** Szempontlisták: a hivatalos érettségi feladatok szempontlistáinak megtekintése és jóváhagyása. */
@Injectable({ providedIn: 'root' })
export class AdminRubricsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/rubrics`;

  listOfficial(): Observable<RubricTaskRow[]> {
    return this.http.get<RubricTaskRow[]>(`${this.base}/official`);
  }

  get(id: number): Observable<RubricDetail> {
    return this.http.get<RubricDetail>(`${this.base}/${id}`);
  }

  review(id: number, approve: boolean, note: string | null): Observable<RubricDetail> {
    return this.http.put<RubricDetail>(`${this.base}/${id}/review`, { approve, note });
  }
}
