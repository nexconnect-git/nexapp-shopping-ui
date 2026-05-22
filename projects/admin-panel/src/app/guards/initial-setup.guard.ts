import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { catchError, map, of } from 'rxjs';

export const initialSetupGuard: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);

  return api.checkSetup().pipe(
    map((res: any) =>
      res.needs_setup ? router.createUrlTree(['/setup']) : true,
    ),
    catchError(() => of(true)),
  );
};
