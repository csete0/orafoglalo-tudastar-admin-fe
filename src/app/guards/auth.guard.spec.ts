import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthStore } from '../services/auth/auth.store';

/** Karakterizáció (WP-A2): belépés nélkül minden védett útvonal a /login-ra visz. */
describe('authGuard', () => {
  function run(authenticated: boolean): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { isAuthenticated: signal(authenticated) } }],
    });
    return TestBed.runInInjectionContext(
      () => authGuard({} as ActivatedRouteSnapshot, { url: '/users' } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('belépett felhasználót átenged', () => {
    expect(run(true)).toBe(true);
  });

  it('belépés nélkül a /login-ra irányít (UrlTree)', () => {
    const result = run(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
