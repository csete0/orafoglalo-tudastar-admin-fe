import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Judge0LoadReport } from '../../models/judge0-load.model';

/** Admin „Kódfuttató terhelés” - csak olvasás. */
@Injectable({ providedIn: 'root' })
export class AdminJudge0LoadService {
  private readonly http = inject(HttpClient);

  getReport(days = 7): Observable<Judge0LoadReport> {
    return this.http.get<Judge0LoadReport>(`${environment.apiUrl}/judge0-load`, { params: new HttpParams().set('days', days) });
  }
}
