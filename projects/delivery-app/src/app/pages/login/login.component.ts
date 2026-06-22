import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  sanitizeUsername,
  USERNAME_PATTERN,
} from '@shared/public-api';
import { DeliveryWorkflowFacade } from '../../services/delivery-workflow.facade';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private workflow = inject(DeliveryWorkflowFacade);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');
  submitted = signal(false);
  fieldErrors = signal<{ username?: string; password?: string }>({});

  canSubmit(): boolean {
    return !this.loading();
  }

  onUsernameInput(value: string): void {
    this.username = sanitizeUsername(value);
    this.clearFieldError('username');
  }

  onPasswordInput(value: string): void {
    this.password = value;
    this.clearFieldError('password');
  }

  onLogin() {
    this.submitted.set(true);
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        if (res.user.role !== 'delivery') {
          this.error.set(
            'Access denied. This portal is strictly for delivery partners.'
          );
          this.loading.set(false);
          return;
        }

        if (!this.auth.handleAuthResponse(res)) {
          this.error.set('This account is not allowed in the delivery app.');
          this.loading.set(false);
          return;
        }
        if (res.user.force_password_change) {
          this.router.navigate(['/change-password']);
          this.loading.set(false);
          return;
        }
        this.workflow.loadDashboard().subscribe({
          next: (profile) => {
            this.router.navigate([
              profile?.is_approved ? '/' : '/pending-approval',
            ]);
            this.loading.set(false);
          },
          error: () => {
            this.router.navigate(['/pending-approval']);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Login failed. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  private validate(): { username?: string; password?: string } {
    const errors: { username?: string; password?: string } = {};
    const username = this.username.trim();
    if (!username) {
      errors.username = 'Username is required.';
    } else if (!USERNAME_PATTERN.test(username)) {
      errors.username = 'Use 3-30 letters, numbers, dots, hyphens, or underscores.';
    }
    if (!this.password) {
      errors.password = 'Password is required.';
    }
    return errors;
  }

  private clearFieldError(field: 'username' | 'password'): void {
    const current = { ...this.fieldErrors() };
    delete current[field];
    this.fieldErrors.set(current);
    this.error.set('');
  }
}
