import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  private readonly api = inject(VendorWorkspaceApi);
  readonly auth = inject(AuthService);
  readonly store = inject(VendorContextService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly forced = this.auth.user()?.force_password_change || false;
  canSubmit(): boolean {
    return (
      !this.loading() &&
      !!this.currentPassword &&
      this.newPassword.length >= 8 &&
      this.newPassword === this.confirmPassword
    );
  }
  onSubmit(): void {
    if (!this.canSubmit()) {
      this.error.set(
        'Enter your current password and matching new passwords with at least eight characters.'
      );
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api
      .changePassword(this.currentPassword, this.newPassword)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (response) => {
          if (!this.auth.handleAuthResponse(response)) {
            this.error.set('Your session could not be renewed. Sign in again.');
            this.loading.set(false);
            return;
          }
          this.store.refresh();
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.success.set(true);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error, 'Password was not changed.'));
          this.loading.set(false);
        },
      });
  }
  continue(): void {
    void this.router.navigateByUrl(
      this.store.context()?.vendor.status === 'approved'
        ? '/'
        : '/pending-approval'
    );
  }
  logout(): void {
    this.auth.logout();
  }
}
