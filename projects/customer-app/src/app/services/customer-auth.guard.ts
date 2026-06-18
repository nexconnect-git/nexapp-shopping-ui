import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { UiService } from './ui.service';

export const customerAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(SharedAuthService);
  const ui = inject(UiService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.getRole() === 'customer') return true;
  if (auth.isLoggedIn() && auth.getRole() && auth.getRole() !== 'customer') {
    auth.clearInvalidSession();
  }
  ui.openLogin();
  const targetPath = state.url.split('?')[0].split('#')[0];
  router.navigate(targetPath === '/checkout' ? ['/cart'] : ['/']);
  return false;
};
