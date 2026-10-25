import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminDemoStore, DEMO_POLL_MS } from './admin-demo.store';
import { AdminDemoService } from './admin-demo.service';
import { demoCredentials, demoEnv } from '../../pages/admin/demok/demok.spec-data';

describe('AdminDemoStore', () => {
  let svc: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = {
      list: vi.fn(() => of([demoEnv()])),
      createSchool: vi.fn(() => of(demoCredentials)),
      createOwner: vi.fn(() => of(demoCredentials)),
      reset: vi.fn(() => of(demoEnv({ status: 'resetting' }))),
      delete: vi.fn(() => of(demoEnv({ status: 'deleting' }))),
      extend: vi.fn(() => of(demoEnv())),
      regeneratePasswords: vi.fn(() => of(demoCredentials)),
    };
    TestBed.configureTestingModule({ providers: [AdminDemoStore, { provide: AdminDemoService, useValue: svc }] });
  });

  afterEach(() => vi.useRealTimers());

  it('létrehozáskor a belépési adatok egyszer megjelennek, az űrlap a siker után zár, a lista frissül', () => {
    const store = TestBed.inject(AdminDemoStore);
    const done = vi.fn();
    store.createSchool({ title: 'Teszt', city: null, days: 14, expiresAt: null, studentCount: 5 }, done);
    expect(store.credentials()?.credentials.length).toBe(2);
    expect(done).toHaveBeenCalled();
    expect(svc['list']).toHaveBeenCalled();
    store.dismissCredentials();
    expect(store.credentials()).toBeNull();
  });

  it('futó betöltés alatt a lista magától frissül, utána nem', () => {
    svc['list'].mockReturnValueOnce(of([demoEnv({ status: 'resetting' })])).mockReturnValue(of([demoEnv()]));
    const store = TestBed.inject(AdminDemoStore);
    store.load();
    expect(svc['list']).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DEMO_POLL_MS);
    expect(svc['list']).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(DEMO_POLL_MS * 3);
    expect(svc['list']).toHaveBeenCalledTimes(2);
  });

  it('hibánál a szerver üzenete jelenik meg, és a hívó űrlapja nyitva marad', () => {
    svc['createSchool'].mockReturnValue(throwError(() => ({ error: { errorMessage: 'Egyszerre legfeljebb 10 iskolai demó lehet.' } })));
    const store = TestBed.inject(AdminDemoStore);
    const done = vi.fn();
    store.createSchool({ title: 'Teszt', city: null, days: 14, expiresAt: null, studentCount: 5 }, done);
    expect(store.error()).toBe('Egyszerre legfeljebb 10 iskolai demó lehet.');
    expect(done).not.toHaveBeenCalled();
    expect(store.loading()).toBe(false);
  });

  it('a saját és az iskolai demók külön látszanak', () => {
    svc['list'].mockReturnValue(of([demoEnv(), demoEnv({ id: 2, kind: 'owner', title: 'Saját demó', expiresAt: null, nightlyReset: true })]));
    const store = TestBed.inject(AdminDemoStore);
    store.load();
    expect(store.ownerDemo()?.id).toBe(2);
    expect(store.schoolDemos().map((d) => d.id)).toEqual([1]);
  });
});
