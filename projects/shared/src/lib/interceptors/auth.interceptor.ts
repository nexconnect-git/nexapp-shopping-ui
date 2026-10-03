import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, of, switchMap, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { GlobalLoadingService, SKIP_GLOBAL_LOADING } from '../services/global-loading.service';

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
  const sessionVersion=auth.sessionVersion;
  const hasSessionToken = !!token;

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  const showLoading = !req.context.get(SKIP_GLOBAL_LOADING);
  if (showLoading) loading.start();

  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err) => {
      const canRefresh =
        err.status === 401 &&
        hasSessionToken &&
        !NON_REFRESHABLE_PATHS.some((path) => req.url.includes(path));
      if (!canRefresh || sessionVersion!==auth.sessionVersion) {
        return throwError(() => err);
      }

      // A slower response may still reject the token that another request renewed.
      const renewedAlready = auth.getToken() && auth.getToken() !== token;
      const renewal = renewedAlready ? of(true) : auth.refreshAccessToken();
      return renewal.pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            if(sessionVersion===auth.sessionVersion || !auth.isLoggedIn())auth.logout();
            return throwError(() => err);
          }

          const refreshedToken = auth.getToken();
          if (!refreshedToken) {
            if(sessionVersion===auth.sessionVersion || !auth.isLoggedIn())auth.logout();
            return throwError(() => err);
          }

          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${refreshedToken}` },
            }),
          ).pipe(timeout(REQUEST_TIMEOUT_MS));
        }),
        catchError((refreshError) => {
          if(sessionVersion===auth.sessionVersion && refreshError.status===401)auth.logout();
          return throwError(() => refreshError.status === 400 || refreshError.status === 401 ? err : refreshError);
        }),
      );
    }),
    finalize(() => { if (showLoading) loading.stop(); }),
  );
};
