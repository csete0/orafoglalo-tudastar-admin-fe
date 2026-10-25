import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthStore } from './services/auth/auth.store';

const SESSION_KEY = 'patricks-admin-session';

/** Minden védett útvonal (a `login` és a `**` kívül) — egy-egy minta-URL-lel és a betöltött oldal szelektorával. */
const PROTECTED: ReadonlyArray<readonly [url: string, selector: string]> = [
  ['/', 'app-dashboard'],
  ['/audit-log', 'app-audit-log'],
  ['/gift-coupons', 'app-gift-coupons'],
  ['/users', 'app-users'],
  ['/users/42', 'app-user-detail'],
  ['/payments', 'app-payments'],
  ['/app-status', 'app-app-status'],
  ['/jelentkezesek', 'app-admin-jelentkezesek'],
  ['/tanarok', 'app-admin-tanarok'],
  ['/intezmenyek', 'app-admin-intezmenyek'],
  ['/demok', 'app-admin-demok'],
  ['/ellenorzes', 'app-admin-ellenorzes'],
  ['/kuponok', 'app-admin-kuponok'],
  ['/ai-koltes', 'app-admin-ai-koltes'],
  ['/projektmuhely', 'app-admin-projektmuhely'],
  ['/git', 'app-admin-git'],
  ['/csapatok', 'app-admin-csapatok'],
  ['/kodfuttato-terheles', 'app-admin-kodfuttato-terheles'],
  ['/verseny', 'app-admin-verseny'],
  ['/gyakorlo-ertekelesek', 'app-admin-gyakorlo-ertekelesek'],
  ['/szempontlistak', 'app-admin-szempontlistak'],
  ['/novekedes', 'app-admin-novekedes'],
  ['/probaerettsegi', 'app-admin-probaerettsegi'],
  ['/erettsegi-eredmenyek', 'app-admin-erettsegi-eredmenyek'],
];

/** Karakterizáció (WP-D1): az útvonal-tábla és az authGuard együttes viselkedése a valódi route-okkal. */
describe('app.routes', () => {
  function setup(authenticated: boolean) {
    sessionStorage.clear();
    if (authenticated) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ accessToken: 't', expiresAtMs: Date.now() + 3_600_000, email: 'a@b.hu', displayName: 'Admin' }),
      );
    }
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  }

  afterEach(() => sessionStorage.clear());

  it('minden URL-t lefed a táblázat (a login és a ** kívül)', () => {
    const flatten = (rs: Routes): string[] => rs.flatMap((r) => (r.children ? flatten(r.children) : [r.path ?? '']));
    expect(flatten(routes).filter((p) => p !== 'login' && p !== '**').sort()).toEqual(
      PROTECTED.map(([url]) => (url === '/users/42' ? 'users/:id' : url.slice(1))).sort(),
    );
  });

  it('belépés nélkül minden védett URL a /login-ra visz', async () => {
    setup(false);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    for (const [url] of PROTECTED) {
      await harness.navigateByUrl(url);
      expect(router.url, url).toBe('/login');
      expect(harness.routeNativeElement?.querySelector('form'), url).not.toBeNull();
    }
  });

  it('belépés nélkül a /login elérhető, ismeretlen URL is a /login-ra visz', async () => {
    setup(false);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/login');
    await harness.navigateByUrl('/nincs-ilyen');
    expect(router.url).toBe('/login');
  });

  it('belépve minden védett URL a saját oldalát tölti be', async () => {
    setup(true);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    for (const [url, selector] of PROTECTED) {
      const component = await harness.navigateByUrl(url);
      expect(router.url, url).toBe(url);
      expect((harness.fixture.nativeElement as HTMLElement).querySelector(selector), url).not.toBeNull();
      expect(component, url).toBeTruthy();
    }
  });

  it('belépve az ismeretlen URL a kezdőlapra, a /login a belépő oldalra visz', async () => {
    setup(true);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await harness.navigateByUrl('/nincs-ilyen/sem');
    expect(router.url).toBe('/');
    expect((harness.fixture.nativeElement as HTMLElement).querySelector('app-dashboard')).not.toBeNull();
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/login');
    expect((harness.fixture.nativeElement as HTMLElement).querySelector('app-login')).not.toBeNull();
  });

  it('a munkamenet lejárta (kijelentkezés) után a következő navigáció a /login-ra visz', async () => {
    setup(true);
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await harness.navigateByUrl('/users');
    expect(router.url).toBe('/users');
    TestBed.inject(AuthStore).logout();
    await harness.navigateByUrl('/users/7');
    expect(router.url).toBe('/login');
  });
});
