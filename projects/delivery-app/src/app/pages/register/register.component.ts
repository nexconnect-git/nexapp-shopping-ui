import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, ApiService } from '@shared/public-api';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  step = signal(1);
  loading = signal(false);
  error = signal('');

  form = {
    username: '',
    email: '',
    password: '',
    phone: '',
    first_name: '',
    last_name: ''
  };

  vehicle = {
    vehicle_type: '',
    vehicle_number: '',
    license_number: ''
  };

  nextStep() {
    if (!this.form.username || !this.form.email || !this.form.password || !this.form.first_name) {
      this.error.set('Please fill in all required fields');
      return;
    }
    this.error.set('');
    this.step.set(2);
  }

  onRegister() {
    if (!this.vehicle.vehicle_type || !this.vehicle.vehicle_number || !this.vehicle.license_number) {
      this.error.set('Please fill in all vehicle information');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const payload = { ...this.form, ...this.vehicle };

    this.api.registerDeliveryPartner(payload).subscribe({
      next: (res) => {
        if (res.tokens) {
          this.auth.handleAuthResponse(res);
        }
        this.router.navigate(['/']);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err.error?.username?.[0] || err.error?.email?.[0] || err.error?.vehicle_type?.[0] || err.error?.detail || 'Registration failed.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }
}
