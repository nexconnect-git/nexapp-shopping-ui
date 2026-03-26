import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/public-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  onLogin() {
    if (!this.username || !this.password) {
      this.error.set('Please fill in all fields.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        if (res.user.role !== 'customer') {
          this.auth.logout();
          this.error.set('This portal is for customers only.');
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
