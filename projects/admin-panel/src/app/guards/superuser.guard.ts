import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@shared/public-api';

export const superuserGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn() && auth.isSuperUser()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
