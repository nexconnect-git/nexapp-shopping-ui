import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  sanitizeUsername,
  USERNAME_PATTERN,
  VendorApi,
} from '@shared/public-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private api = inject(VendorApi);
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

  goToRegister(event?: MouseEvent) {
    if (
      event &&
      (event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey)
    ) {
      return;
    }

    event?.preventDefault();
    this.auth.clearInvalidSession();
    void this.router.navigateByUrl('/register');
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
        if (res.user.role !== 'vendor') {
          this.error.set(
            'Access denied. This portal is strictly for vendors and merchants.'
          );
          this.loading.set(false);
          return;
        }

        if (!this.auth.handleAuthResponse(res)) {
          this.error.set('This account is not allowed in the vendor app.');
          this.loading.set(false);
          return;
        }
        this.api.getVendorProfile().subscribe({
          next: (profile) => {
            localStorage.setItem(this.auth.vendorKey, profile.status);

            if (profile.status === 'approved') {
              if (res.user.force_password_change) {
                this.router.navigate(['/change-password']);
              } else {
                this.router.navigate(['/']);
              }
            } else {
              this.router.navigate(['/pending-approval']);
            }
            this.loading.set(false);
          },
          error: (err) => {
            if ([401, 403, 404].includes(err?.status)) {
              this.auth.clearInvalidSession();
              this.error.set(
                'Vendor profile could not be verified for this account.'
              );
            } else {
              this.error.set(
                'Could not verify vendor approval status. Please retry.'
              );
            }
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Invalid credentials. Please try again.'));
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
