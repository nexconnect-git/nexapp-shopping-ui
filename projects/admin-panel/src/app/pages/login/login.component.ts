import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ApiService,
  apiErrorMessage,
  AuthService,
  sanitizeUsername,
  USERNAME_PATTERN,
} from '@shared/public-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');
  checkingSetup = signal(true);
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

  ngOnInit() {
    this.api.checkSetup().subscribe({
      next: (res: any) => {
        if (res.needs_setup) {
          this.router.navigate(['/setup']);
        } else {
          this.checkingSetup.set(false);
        }
      },
      error: () => {
        this.checkingSetup.set(false);
      },
    });
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
        if (res.user.role !== 'admin') {
          this.error.set('Access denied. Administrator privileges required.');
          this.loading.set(false);
          return;
        }

        if (!this.auth.handleAuthResponse(res)) {
          this.error.set('This account is not allowed in the admin panel.');
          this.loading.set(false);
          return;
        }
        if (res.user.force_password_change) {
          this.router.navigate(['/change-password']);
          this.loading.set(false);
          return;
        }
        this.router.navigate(['/']);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Invalid credentials.'));
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
