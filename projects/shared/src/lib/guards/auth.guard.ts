import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { SessionStore } from '../services/session-store.service';

/** Read the portal-scoped token from durable storage. */
function getScopedToken(): string | null {
  return inject(SessionStore).getAccessToken();
}

function getScopedUser(): any | null {
  return inject(SessionStore).getUser();
}

/**
 * authGuard — allows only authenticated users (reads scoped token).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() || getScopedToken()) return true;
  const returnUrl = router.url && router.url !== '/' ? router.url : undefined;
  router.navigate(
    ['/login'],
    returnUrl ? { queryParams: { returnUrl } } : undefined
  );
  return false;
};

/**
 * unauthGuard — allows only unauthenticated users (e.g. login page).
 */
export const unauthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = getScopedToken();
  if (!auth.isLoggedIn() && !token) return true;
  if (token && !getScopedUser()) {
    auth.clearInvalidSession();
    return true;
  }
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
    const auth = inject(AuthService);
    const token = auth.getToken() || getScopedToken();
    if (!token) return true;

    const user = getScopedUser();
    if (!user) {
      auth.clearInvalidSession();
      return true;
    }

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
  const auth = inject(AuthService);
  const session = inject(SessionStore);

  const token = session.getAccessToken();
  const user = session.getUser<any>();

  if (!token || !user) {
    router.navigate(['/login']);
    return false;
  }

  session.setAccessToken(token);
  session.setUser(user);
  if (user.role !== 'vendor') {
    router.navigate(['/login']);
    return false;
  }

  const cachedStatus = session.getVendorStatus();
  if (cachedStatus && cachedStatus !== 'approved') {
    router.navigate(['/pending-approval']);
    return false;
  }

  return api.getVendorProfile().pipe(
    map((profile: any) => {
      session.setVendorStatus(profile.status);
      if (profile.status === 'approved') {
        if (user.force_password_change) {
          router.navigate(['/change-password']);
          return false;
        }
        return true;
      }
      router.navigate(['/pending-approval']);
      return false;
    }),
    catchError((err) => {
      session.clearVendorStatus();
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        auth.clearInvalidSession();
        router.navigate(['/login']);
      } else {
        router.navigate(['/login'], {
          queryParams: { reason: 'profile_unavailable' },
        });
      }
      return of(false);
    })
  );
};

export const approvedDeliveryGuard: CanActivateFn = () => {
  const router = inject(Router);
  const api = inject(ApiService);
  const auth = inject(AuthService);
  const user = getScopedUser();

  if (user?.force_password_change) {
    router.navigate(['/change-password']);
    return false;
  }

  return api.getDeliveryDashboard().pipe(
    map((profile: any) => {
      if (profile?.is_approved) return true;
      router.navigate(['/pending-approval']);
      return false;
    }),
    catchError((err) => {
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        auth.clearInvalidSession();
        router.navigate(['/login']);
      } else {
        router.navigate(['/pending-approval']);
      }
      return of(false);
    })
  );
};
