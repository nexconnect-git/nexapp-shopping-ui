import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, switchMap, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { GlobalLoadingService } from '../services/global-loading.service';

const REQUEST_TIMEOUT_MS = 15_000;
const NON_REFRESHABLE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/setup',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const loading = inject(GlobalLoadingService);
  const token = auth.getToken();
  const hasSessionToken = !!token;

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  loading.start();

  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err) => {
      const canRefresh =
        err.status === 401 &&
        hasSessionToken &&
        !NON_REFRESHABLE_PATHS.some((path) => req.url.includes(path));
      if (!canRefresh) {
        return throwError(() => err);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            auth.logout();
            return throwError(() => err);
          }

          const refreshedToken = auth.getToken();
          if (!refreshedToken) {
            auth.logout();
            return throwError(() => err);
          }

          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${refreshedToken}` },
            }),
          ).pipe(timeout(REQUEST_TIMEOUT_MS));
        }),
        catchError(() => {
          auth.logout();
          return throwError(() => err);
        }),
      );
    }),
    finalize(() => loading.stop()),
  );
};
