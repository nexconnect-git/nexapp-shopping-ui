import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  onSubmit() {
    this.error.set('');

    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.api.changePassword({ current_password: this.currentPassword, new_password: this.newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        // Fetch vendor profile to determine next route
        this.api.getVendorProfile().subscribe({
          next: (profile) => {
            localStorage.setItem('vendor_status', profile.status);
            setTimeout(() => {
              if (profile.status === 'approved') {
                this.router.navigate(['/']);
              } else {
                this.router.navigate(['/pending-approval']);
              }
            }, 1500);
          },
          error: () => setTimeout(() => this.router.navigate(['/pending-approval']), 1500)
        });
      },
      error: (err) => {
        this.loading.set(false);
        const e = err.error;
        this.error.set(e?.current_password || e?.new_password || e?.detail || 'Failed to update password.');
      }
    });
  }

  logout() {
    this.auth.logout();
  }
}
