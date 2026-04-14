import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';

const REQUEST_TIMEOUT_MS = 15_000; // 15 s — prevents hung requests from blocking the browser

// Only these paths confirm the token is definitively invalid.
// Background calls (cart, notifications, etc.) can legitimately return 401 during
// page initialization without meaning the session is expired.
const AUTH_CONFIRMING_PATHS = ['/auth/profile', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
    return next(req).pipe(timeout(REQUEST_TIMEOUT_MS), catchError(err => throwError(() => err)));
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  const auth = inject(AuthService);
  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err) => {
      if (err.status === 401 && token) {
        // Only force logout when a token-validating endpoint says the token is bad.
        // Logging out on every 401 (e.g. cart, notifications) causes spurious logouts
        // on page reload before those endpoints are ready to respond.
        const isAuthConfirming = AUTH_CONFIRMING_PATHS.some(p => req.url.includes(p));
        if (isAuthConfirming) {
          auth.logout();
        }
      }
      return throwError(() => err);
    })
  );
};
