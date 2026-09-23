import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppStatusResult {
  name: string;
  isHealthy: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AppStatusService {
  private readonly http = inject(HttpClient);

  async getStatus(): Promise<AppStatusResult[]> {
    return firstValueFrom(this.http.get<AppStatusResult[]>(`${environment.apiUrl}/app-status`));
  }
}
