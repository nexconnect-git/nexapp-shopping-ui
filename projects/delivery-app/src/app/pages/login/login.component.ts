import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  canSubmit(): boolean {
    return !this.loading() && !!this.username.trim() && !!this.password;
  }

  onLogin() {
    if (!this.username || !this.password) {
      this.error.set('Please enter username and password');
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
        this.api.getDeliveryDashboard().subscribe({
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
        this.error.set(err.error?.detail || 'Login failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
