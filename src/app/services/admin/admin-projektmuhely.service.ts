import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProjectAdminCosts, ProjectAdminFunnel, ProjectAdminOverview, ProjectAdminUserProject } from '../../models/projektmuhely.model';

/** Az admin Projektműhely-oldal (haladás, tölcsér, költség) - csak olvasás. */
@Injectable({ providedIn: 'root' })
export class AdminProjektmuhelyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/projects`;

  getOverview(days = 30): Observable<ProjectAdminOverview> {
    return this.http.get<ProjectAdminOverview>(`${this.base}/overview`, { params: new HttpParams().set('days', days) });
  }

  getCosts(days = 30): Observable<ProjectAdminCosts> {
    return this.http.get<ProjectAdminCosts>(`${this.base}/costs`, { params: new HttpParams().set('days', days) });
  }

  getFunnel(slug: string): Observable<ProjectAdminFunnel> {
    return this.http.get<ProjectAdminFunnel>(`${this.base}/${encodeURIComponent(slug)}/funnel`);
  }

  getUserProjects(userId: number): Observable<ProjectAdminUserProject[]> {
    return this.http.get<ProjectAdminUserProject[]>(`${this.base}/users/${userId}`);
  }
}
