import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * A Hangfire dashboard (háttérfeladatok) megnyitása. A dashboard böngészős oldal, Bearer tokent nem kap: előbb egy
 * rövid életű, csak a dashboard útvonalára szóló admin-sütit kérünk (POST hangfire-session), utána nyílik meg.
 */
@Injectable({ providedIn: 'root' })
export class HangfireService {
  private readonly http = inject(HttpClient);

  readonly dashboardUrl = `${environment.apiUrl}/hangfire`;

  /**
   * A lapot SZINKRON (a kattintásban) kell megnyitni - egy await utáni window.open-t a felugróablak-blokkoló
   * letiltana -, és csak a süti megszerzése után irányítjuk a dashboardra. Hiba esetén a lap bezárul.
   */
  async openDashboard(): Promise<void> {
    const tab = window.open('', '_blank');
    try {
      await firstValueFrom(this.http.post<void>(`${environment.apiUrl}/hangfire-session`, {}));
      if (tab) tab.location.href = this.dashboardUrl;
    } catch (error) {
      tab?.close();
      throw error;
    }
  }
}
