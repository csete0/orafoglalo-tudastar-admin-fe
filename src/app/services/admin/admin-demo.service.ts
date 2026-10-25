import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateOwnerDemoRequest,
  CreateSchoolDemoRequest,
  DemoCredentials,
  DemoEnvironment,
  ExtendDemoRequest,
} from '../../models/demo.model';

/** Demó-környezetek admin-végpontjai (BE: DemoAdminController, api/admin/demos). */
@Injectable({ providedIn: 'root' })
export class AdminDemoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/demos`;

  list(): Observable<DemoEnvironment[]> {
    return this.http.get<DemoEnvironment[]>(this.baseUrl);
  }

  createSchool(request: CreateSchoolDemoRequest): Observable<DemoCredentials> {
    return this.http.post<DemoCredentials>(this.baseUrl, request);
  }

  createOwner(request: CreateOwnerDemoRequest): Observable<DemoCredentials> {
    return this.http.post<DemoCredentials>(`${this.baseUrl}/owner`, request);
  }

  extend(id: number, request: ExtendDemoRequest): Observable<DemoEnvironment> {
    return this.http.post<DemoEnvironment>(`${this.baseUrl}/${id}/extend`, request);
  }

  reset(id: number): Observable<DemoEnvironment> {
    return this.http.post<DemoEnvironment>(`${this.baseUrl}/${id}/reset`, {});
  }

  regeneratePasswords(id: number): Observable<DemoCredentials> {
    return this.http.post<DemoCredentials>(`${this.baseUrl}/${id}/passwords`, {});
  }

  delete(id: number): Observable<DemoEnvironment> {
    return this.http.delete<DemoEnvironment>(`${this.baseUrl}/${id}`);
  }
}
