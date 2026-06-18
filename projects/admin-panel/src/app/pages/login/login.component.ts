import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

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

  canSubmit(): boolean {
    return !this.loading() && !!this.username.trim() && !!this.password;
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
    if (!this.username || !this.password) {
      this.error.set('Please fill in all fields.');
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
        this.error.set(err.error?.detail || 'Invalid credentials.');
        this.loading.set(false);
      },
    });
  }
}
