import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';

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
  const token = auth.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err) => {
      const canRefresh = err.status === 401 && !NON_REFRESHABLE_PATHS.some((path) => req.url.includes(path));
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
  );
};
