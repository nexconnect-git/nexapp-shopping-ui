import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
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
    last_name: '',
  };

  vehicle = {
    vehicle_type: '',
    vehicle_number: '',
    license_number: '',
  };

  nextStep() {
    if (
      !this.form.username ||
      !this.form.email ||
      !this.form.password ||
      !this.form.first_name
    ) {
      this.error.set('Please fill in all required fields');
      return;
    }
    this.error.set('');
    this.step.set(2);
  }

  onRegister() {
    if (
      !this.vehicle.vehicle_type ||
      !this.vehicle.vehicle_number ||
      !this.vehicle.license_number
    ) {
      this.error.set('Please fill in all vehicle information');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const payload = {
      username: this.form.username.trim(),
      email: this.form.email.trim(),
      password: this.form.password,
      phone: this.form.phone.trim(),
      first_name: this.form.first_name.trim(),
      last_name: this.form.last_name.trim(),
      vehicle_type: this.vehicle.vehicle_type,
      vehicle_number: this.vehicle.vehicle_number.trim(),
      license_number: this.vehicle.license_number.trim(),
    };

    this.api.registerDeliveryPartner(payload).subscribe({
      next: (res) => {
        if (res.tokens && !this.auth.handleAuthResponse(res)) {
          this.error.set('This account is not allowed in the delivery app.');
          this.loading.set(false);
          return;
        }
        this.router.navigate(['/']);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = this.registrationErrorMessage(err.error);
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  private registrationErrorMessage(error: any): string {
    return (
      error?.username?.[0] ||
      error?.email?.[0] ||
      error?.phone?.[0] ||
      error?.vehicle_type?.[0] ||
      error?.license_number?.[0] ||
      error?.non_field_errors?.[0] ||
      error?.detail ||
      error?.error ||
      'Registration failed.'
    );
  }
}
