import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';

/** Read the portal-scoped token from localStorage. */
function getScopedToken(): string | null {
  const prefix = inject(AUTH_PREFIX);
  return localStorage.getItem(`${prefix}_access_token`);
}

function getScopedUser(): any | null {
  const prefix = inject(AUTH_PREFIX);
  const raw = localStorage.getItem(`${prefix}_user`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * authGuard — allows only authenticated users (reads scoped token).
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (getScopedToken()) return true;
  router.navigate(['/login']);
  return false;
};

/**
 * unauthGuard — allows only unauthenticated users (e.g. login page).
 */
export const unauthGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!getScopedToken()) return true;
  router.navigate(['/']);
  return false;
};

/**
 * portalUnauthGuard(role) — role-aware login page guard.
 * Only blocks the login page if the CORRECT portal's user is already logged in.
 * Cross-portal users (different role) are always allowed to see the login page.
 */
export const portalUnauthGuard = (expectedRole: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const token = getScopedToken();
    if (!token) return true;

    const user = getScopedUser();
    if (!user) return true;

    if (user.role === expectedRole) {
      router.navigate(['/']);
      return false;
    }

    // Different role in OUR scoped key — shouldn't normally happen since
    // each portal now has its own key, but guard defensively.
    return true;
  };
};

/**
 * roleGuard(role) — blocks users with the wrong role from protected routes.
 */
export const roleGuard = (allowedRole: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const user = getScopedUser();
    if (user?.role === allowedRole) return true;
    router.navigate(['/login']);
    return false;
  };
};

export const approvedVendorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const api = inject(ApiService);
  const prefix = inject(AUTH_PREFIX);

  const token = localStorage.getItem(`${prefix}_access_token`);
  const userData = localStorage.getItem(`${prefix}_user`);

  if (!token || !userData) {
    router.navigate(['/login']);
    return false;
  }

  const user = JSON.parse(userData);
  if (user.role !== 'vendor') {
    router.navigate(['/login']);
    return false;
  }

  const cached = localStorage.getItem(`${prefix}_vendor_status`);
  if (cached !== null) {
    if (cached === 'approved') return true;
    router.navigate(['/pending-approval']);
    return false;
  }

  return api.getVendorProfile().pipe(
    map((profile: any) => {
      localStorage.setItem(`${prefix}_vendor_status`, profile.status);
      if (profile.status === 'approved') return true;
      router.navigate(['/pending-approval']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/pending-approval']);
      return of(false);
    })
  );
};
