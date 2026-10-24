import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from './auth.store';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'patricks-admin-session';
const NOW = new Date('2026-10-23T10:00:00Z').getTime();

/** Karakterizáció (WP-A2): sessionStorage-alapú, frissítés nélküli admin-munkamenet. */
describe('AuthStore', () => {
  function create(): { store: AuthStore; http: HttpTestingController } {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { store: TestBed.inject(AuthStore), http: TestBed.inject(HttpTestingController) };
  }

  function stored(expiresAtMs: number): string {
    return JSON.stringify({ accessToken: 'tok', expiresAtMs, email: 'admin@example.com', displayName: 'Admin' });
  }

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('tárolt munkamenet nélkül nincs belépve', () => {
    const { store } = create();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.getAccessToken()).toBeNull();
    expect(store.displayName()).toBe('');
    expect(store.email()).toBe('');
  });

  it('az érvényes tárolt munkamenetet visszatölti', () => {
    sessionStorage.setItem(STORAGE_KEY, stored(NOW + 60_000));
    const { store } = create();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.getAccessToken()).toBe('tok');
    expect(store.displayName()).toBe('Admin');
    expect(store.email()).toBe('admin@example.com');
  });

  it('a lejárt tárolt munkamenetet eldobja és törli a tárolóból', () => {
    sessionStorage.setItem(STORAGE_KEY, stored(NOW));
    const { store } = create();
    expect(store.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('a lejárati idő nélküli tárolt munkamenetet eldobja', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'tok', email: 'a', displayName: 'b' }));
    const { store } = create();
    expect(store.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('a hibás JSON-t figyelmen kívül hagyja (a tárolóban marad)', () => {
    sessionStorage.setItem(STORAGE_KEY, '{nem json');
    const { store } = create();
    expect(store.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('{nem json');
  });

  it('a token a lejárat pillanatától nem adható ki', () => {
    sessionStorage.setItem(STORAGE_KEY, stored(NOW + 1000));
    const { store } = create();
    expect(store.getAccessToken()).toBe('tok');
    vi.setSystemTime(NOW + 1000);
    expect(store.getAccessToken()).toBeNull();
  });

  it('a belépés a login végpontot hívja, és a munkamenetet a sessionStorage-ba írja', async () => {
    const { store, http } = create();
    const done = store.login('admin@example.com', 'titok');

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@example.com', password: 'titok' });
    req.flush({ accessToken: 'uj', expiresIn: 900, email: 'admin@example.com', displayName: 'Admin' });
    await done;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.getAccessToken()).toBe('uj');
    expect(store.displayName()).toBe('Admin');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)).toEqual({
      accessToken: 'uj', expiresAtMs: NOW + 900_000, email: 'admin@example.com', displayName: 'Admin',
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('sikertelen belépéskor a hiba továbbmegy, és nem lesz munkamenet', async () => {
    const { store, http } = create();
    const done = store.login('admin@example.com', 'rossz');
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ errorMessage: 'x' }, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toMatchObject({ status: 401 });
    expect(store.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('a kilépés törli a munkamenetet és a tárolót', () => {
    sessionStorage.setItem(STORAGE_KEY, stored(NOW + 60_000));
    const { store } = create();
    store.logout();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.getAccessToken()).toBeNull();
    expect(store.displayName()).toBe('');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
