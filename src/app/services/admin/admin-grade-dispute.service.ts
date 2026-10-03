import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GradeDisputeList } from '../../models/grade-dispute.model';

/** Értékelési kifogások (PATRICKS-TELJES-VIZSGA-TERV.md, H4). */
@Injectable({ providedIn: 'root' })
export class AdminGradeDisputeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/grade-disputes`;

  list(onlyOpen = true, page = 1, pageSize = 20): Observable<GradeDisputeList> {
    const params = new HttpParams().set('onlyOpen', onlyOpen).set('page', page).set('pageSize', pageSize);
    return this.http.get<GradeDisputeList>(this.baseUrl, { params });
  }

  resolve(id: number, resolution: string | null): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/resolve`, { resolution });
  }

  file(id: number, fileId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/files/${fileId}`, { responseType: 'blob' });
  }
}
