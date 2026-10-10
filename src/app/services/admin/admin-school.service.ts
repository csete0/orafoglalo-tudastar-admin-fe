import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SchoolAdminDto, SchoolMergeResultDto } from '../../models/teacher-moderation.model';

@Injectable({ providedIn: 'root' })
export class AdminSchoolService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getSchools(): Observable<SchoolAdminDto[]> {
    return this.http.get<SchoolAdminDto[]>(`${this.baseUrl}/schools`);
  }

  merge(sourceSchoolId: number, targetSchoolId: number): Observable<SchoolMergeResultDto> {
    return this.http.post<SchoolMergeResultDto>(`${this.baseUrl}/schools/merge`, {
      sourceSchoolId,
      targetSchoolId,
    });
  }

  setPublicApproval(schoolId: number, approved: boolean): Observable<void> {
    const url = `${this.baseUrl}/schools/${schoolId}/public-approval`;
    return approved ? this.http.post<void>(url, null) : this.http.delete<void>(url);
  }
}
