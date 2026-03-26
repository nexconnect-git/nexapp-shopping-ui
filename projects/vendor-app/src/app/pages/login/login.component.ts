import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, ApiService } from '@shared/public-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  onLogin() {
    if (!this.username || !this.password) {
      this.error.set('Please enter both username and password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        if (res.user.role !== 'vendor') {
          this.auth.logout();
          this.error.set('This portal is for vendors only.');
          this.loading.set(false);
          return;
        }
        if (res.user.force_password_change) {
          this.router.navigate(['/change-password']);
          this.loading.set(false);
          return;
        }
        this.api.getVendorProfile().subscribe({
          next: (profile) => {
            localStorage.setItem('vendor_status', profile.status);
            if (profile.status === 'approved') {
              this.router.navigate(['/']);
            } else {
              this.router.navigate(['/pending-approval']);
            }
            this.loading.set(false);
          },
          error: () => {
            this.router.navigate(['/pending-approval']);
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set(err.error?.detail || err.error?.error || 'Invalid credentials. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
