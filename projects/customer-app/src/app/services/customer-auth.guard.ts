import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService as SharedAuthService } from '@shared/public-api';
import { UiService } from './ui.service';

export const customerAuthGuard: CanActivateFn = () => {
  const auth = inject(SharedAuthService);
  const ui = inject(UiService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  ui.openLogin();
  router.navigate(['/']);
  return false;
};
