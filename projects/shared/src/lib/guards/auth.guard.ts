import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

/**
 * authGuard — allows only authenticated users.
 * Reads live from localStorage so cross-portal clearing is reflected.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  if (token) return true;
  router.navigate(['/login']);
  return false;
};

/**
 * unauthGuard — allows only unauthenticated users (e.g. login page).
 * If the user is logged in, redirects to dashboard.
 */
export const unauthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  if (!token) return true;
  router.navigate(['/']);
  return false;
};

/**
 * portalUnauthGuard(role) — role-aware guard for login pages.
 * Only blocks access to the login page if the logged-in user has the CORRECT role.
 * If the user is logged in with a DIFFERENT role (cross-portal), allows the login page
 * to render so they can see the "Access denied" message or log in with the right account.
 * Does NOT touch localStorage — avoiding cross-portal session destruction.
 */
export const portalUnauthGuard = (expectedRole: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const token = localStorage.getItem('access_token');
    if (!token) return true; // not logged in → show login page

    const userData = localStorage.getItem('user');
    if (!userData) return true; // no user data → show login page

    const user = JSON.parse(userData);
    if (user.role === expectedRole) {
      // Correct portal — already logged in, go to dashboard
      router.navigate(['/']);
      return false;
    }

    // Different role (cross-portal): let the login page show
    // The login component will display the "Access denied" error on submit.
    return true;
  };
};

/**
 * roleGuard(role) — blocks authenticated users with the wrong role.
 * Does NOT clear localStorage — another portal owns that session.
 * Simply redirects to /login so the user can log in with the right account.
 */
export const roleGuard = (allowedRole: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role === allowedRole) return true;
    }
    // Wrong role or no user — redirect to login. Do NOT clear localStorage
    // as other portals may legitimately own the current session.
    router.navigate(['/login']);
    return false;
  };
};

export const approvedVendorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const api = inject(ApiService);
  const token = localStorage.getItem('access_token');
  const userData = localStorage.getItem('user');

  if (!token || !userData) {
    router.navigate(['/login']);
    return false;
  }

  const user = JSON.parse(userData);
  if (user.role !== 'vendor') {
    router.navigate(['/login']);
    return false;
  }

  const cached = localStorage.getItem('vendor_status');
  if (cached !== null) {
    if (cached === 'approved') return true;
    router.navigate(['/pending-approval']);
    return false;
  }

  return api.getVendorProfile().pipe(
    map((profile: any) => {
      localStorage.setItem('vendor_status', profile.status);
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
