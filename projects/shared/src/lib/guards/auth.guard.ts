import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { ApiService } from '../services/api.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  if (token) return true;
  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  if (!token) return true;
  router.navigate(['/']);
  return false;
};

export const roleGuard = (allowedRole: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role === allowedRole) return true;
    }
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

  // Status not cached (e.g. page refresh after session restore) — fetch from API
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
