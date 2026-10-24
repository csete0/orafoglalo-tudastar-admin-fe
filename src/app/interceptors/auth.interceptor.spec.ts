import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../services/auth/auth.store';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

/** Karakterizáció (WP-A2): Bearer-token csak az admin-API felé; 401 → kilépés + /login (a login-hívás kivételével). */
describe('authInterceptor', () => {
  let token: string | null;
  let auth: { getAccessToken: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    token = 'tok';
    auth = { getAccessToken: vi.fn(() => token), logout: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('az admin-API kérésére Bearer-tokent tesz', async () => {
    const done = firstValueFrom(http.get(`${API}/users`));
    const req = mock.expectOne(`${API}/users`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush({});
    await done;
  });

  it('token nélkül fejléc nélkül küld', async () => {
    token = null;
    const done = firstValueFrom(http.get(`${API}/users`));
    const req = mock.expectOne(`${API}/users`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await done;
  });

  it('idegen URL-re nem tesz tokent, és a 401-re sem léptet ki', async () => {
    const done = firstValueFrom(http.get('https://example.com/x'));
    const req = mock.expectOne('https://example.com/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(auth.getAccessToken).not.toHaveBeenCalled();
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('401-re kijelentkeztet, a /login-ra visz, és a hibát továbbadja', async () => {
    const done = firstValueFrom(http.get(`${API}/users`));
    mock.expectOne(`${API}/users`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toMatchObject({ status: 401 });
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('a login-hívás 401-ére nem léptet ki (a hibaüzenet a login oldalé)', async () => {
    const done = firstValueFrom(http.post(`${API}/auth/login`, {}));
    mock.expectOne(`${API}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toMatchObject({ status: 401 });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('más hibakódra (403, 500) nem léptet ki, csak továbbadja', async () => {
    for (const status of [403, 500]) {
      const done = firstValueFrom(http.get(`${API}/users`));
      mock.expectOne(`${API}/users`).flush(null, { status, statusText: 'Hiba' });
      await expect(done).rejects.toMatchObject({ status });
    }
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
