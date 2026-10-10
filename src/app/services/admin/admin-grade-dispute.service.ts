import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GradeDisputeList, GradeItemCorrection } from '../../models/grade-dispute.model';

/** Értékelési kifogások (PATRICKS-TELJES-VIZSGA-TERV.md, H4). */
@Injectable({ providedIn: 'root' })
export class AdminGradeDisputeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/grade-disputes`;

  /** kind: null = minden fajta; 'files' / 'code' szűr (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b). */
  list(onlyOpen = true, page = 1, pageSize = 20, kind: 'files' | 'code' | null = null): Observable<GradeDisputeList> {
    let params = new HttpParams().set('onlyOpen', onlyOpen).set('page', page).set('pageSize', pageSize);
    if (kind) params = params.set('kind', kind);
    return this.http.get<GradeDisputeList>(this.baseUrl, { params });
  }

  /** Lezárás; a javított tételekkel (M2) az értékelés újraszámolódik, és tanulóeset lesz belőlük. */
  resolve(id: number, resolution: string | null, corrections: GradeItemCorrection[] = []): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/resolve`, { resolution, corrections });
  }

  file(id: number, fileId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/files/${fileId}`, { responseType: 'blob' });
  }
}
