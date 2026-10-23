import { inject } from '@angular/core';
import { CanActivateChildFn, Router, UrlTree } from '@angular/router';
import { AuthStore } from '../services/auth/auth.store';

/** A védett útvonalak szülőjén (`canActivateChild`): belépés nélkül minden gyerek-útvonal a /login-ra visz. */
export const authGuard: CanActivateChildFn = (): boolean | UrlTree => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return true;
};
