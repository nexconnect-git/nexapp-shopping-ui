import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';

const REQUEST_TIMEOUT_MS = 15_000;

// Only these paths confirm the token is definitively invalid.
const AUTH_CONFIRMING_PATHS = ['/auth/profile', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
    return next(req).pipe(timeout(REQUEST_TIMEOUT_MS), catchError(err => throwError(() => err)));
  }

  // Use AuthService.getToken() so the correct portal-prefixed key is read
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err) => {
      if (err.status === 401 && token) {
        const isAuthConfirming = AUTH_CONFIRMING_PATHS.some(p => req.url.includes(p));
        if (isAuthConfirming) {
          auth.logout();
        }
      }
      return throwError(() => err);
    })
  );
};
