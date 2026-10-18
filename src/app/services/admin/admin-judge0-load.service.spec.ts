import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AdminJudge0LoadService } from './admin-judge0-load.service';

describe('AdminJudge0LoadService', () => {
  it('a riportot a napok számával kéri le', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    let status = '';
    TestBed.inject(AdminJudge0LoadService).getReport(30).subscribe((r) => (status = r.status));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/judge0-load`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('days')).toBe('30');
    req.flush({ status: 'green' });
    expect(status).toBe('green');
    http.verify();
  });
});
