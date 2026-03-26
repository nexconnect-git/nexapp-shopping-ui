import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/public-api';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  form = { first_name: '', last_name: '', username: '', email: '', phone: '', password: '', role: 'customer' };
  loading = signal(false);
  error = signal('');

  onRegister() {
    if (!this.form.username || !this.form.email || !this.form.password) {
      this.error.set('Username, email and password are required.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.form).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        this.router.navigate(['/']);
      },
      error: (err) => {
        const errors = err.error;
        const msg = typeof errors === 'object'
          ? Object.values(errors).flat().join(' ')
          : 'Registration failed. Please try again.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }
}
