import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../services/auth/auth.store';
import { environment } from '../../environments/environment';

/**
 * ADM-F1: nincs token-frissítési logika (ld. AuthStore doc-kommentje) - egy
 * 401 itt mindig azt jelenti, hogy a munkamenet lejárt/érvénytelen, ezért
 * egyszerűen kijelentkeztet és a login oldalra irányít, ahelyett hogy
 * megpróbálná csendben megújítani.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const token = authStore.getAccessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        authStore.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
