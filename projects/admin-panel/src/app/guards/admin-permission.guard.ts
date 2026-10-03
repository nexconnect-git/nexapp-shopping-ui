import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminAccessService, permissionForRoute } from '../services/admin-access.service';

export const adminPermissionGuard: CanActivateFn = (_route, state) => {
  const access = inject(AdminAccessService);
  const router = inject(Router);
  return access.load(true).pipe(map(() => access.can(permissionForRoute(state.url)) || router.createUrlTree(['/access-denied'])));
};
