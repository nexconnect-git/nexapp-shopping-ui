import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, ApiService } from '@shared/public-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
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
      }
    });
  }

  onLogin() {
    if (!this.username || !this.password) { this.error.set('Please fill in all fields.'); return; }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        if (res.user.role !== 'admin') {
          this.auth.logout();
          this.error.set('Access denied. Admin accounts only.');
          this.loading.set(false);
          return;
        }
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Invalid credentials.');
        this.loading.set(false);
      }
    });
  }
}
