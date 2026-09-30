import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { HangfireService } from './hangfire.service';

describe('HangfireService', () => {
  let service: HangfireService;
  let http: HttpTestingController;
  let tab: { location: { href: string }; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HangfireService);
    http = TestBed.inject(HttpTestingController);
    tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('a lapot azonnal megnyitja, a süti megszerzése után a dashboardra irányítja', async () => {
    const opening = service.openDashboard();
    expect(window.open).toHaveBeenCalledWith('', '_blank');

    http.expectOne({ method: 'POST', url: `${environment.apiUrl}/hangfire-session` }).flush(null, { status: 204, statusText: 'No Content' });
    await opening;

    expect(tab.location.href).toBe(`${environment.apiUrl}/hangfire`);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('ha a munkamenet nem kérhető, a lapot bezárja és a hibát továbbadja', async () => {
    const opening = service.openDashboard();
    http.expectOne(`${environment.apiUrl}/hangfire-session`).flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(opening).rejects.toBeTruthy();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });
});
