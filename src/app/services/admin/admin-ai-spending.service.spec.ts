import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AdminAiSpendingService } from './admin-ai-spending.service';

describe('AdminAiSpendingService - havi riport', () => {
  let service: AdminAiSpendingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminAiSpendingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('a havi riportot a hónap paraméterrel kéri le', () => {
    let month = '';
    service.getMonthlyReport('2026-09').subscribe((r) => (month = r.month));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/ai-spending/monthly-report`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2026-09');
    req.flush({ month: '2026-09' });
    expect(month).toBe('2026-09');
  });

  it('a CSV-t blobként, a hónap paraméterrel tölti le', () => {
    let blob: Blob | null = null;
    service.downloadMonthlyReportCsv('2026-10').subscribe((b) => (blob = b));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/ai-spending/monthly-report.csv`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2026-10');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['Hónap;Intézmény'], { type: 'text/csv' }));
    expect(blob).toBeInstanceOf(Blob);
  });
});
