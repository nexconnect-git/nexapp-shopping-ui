import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, AuthService, MapPickerComponent, MapLocation } from '@shared/public-api';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, DecimalPipe, MapPickerComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal(1);
  loading = signal(false);
  error = signal('');
  success = signal('');

  form: any = {
    username: '', email: '', password: '', phone: '',
    store_name: '', description: '', address: '', city: '', state: '', postal_code: '',
    vendor_email: '', latitude: null, longitude: null
  };

  nextStep() {
    this.error.set('');
    if (this.step() === 1) {
      if (!this.form.username || !this.form.email || !this.form.password || !this.form.phone) {
        this.error.set('Please fill in all fields.');
        return;
      }
      if (this.form.password.length < 8) {
        this.error.set('Password must be at least 8 characters.');
        return;
      }
    }
    if (this.step() === 2) {
      if (!this.form.store_name) {
        this.error.set('Please enter a store name.');
        return;
      }
    }
    this.step.update(s => s + 1);
  }

  prevStep() {
    this.error.set('');
    this.step.update(s => s - 1);
  }

  onLocationPicked(loc: MapLocation) {
    this.form.latitude = loc.lat;
    this.form.longitude = loc.lng;
    if (loc.address && !this.form.address) this.form.address = loc.address;
    if (loc.city && !this.form.city) this.form.city = loc.city;
    if (loc.state && !this.form.state) this.form.state = loc.state;
    if (loc.postal_code && !this.form.postal_code) this.form.postal_code = loc.postal_code;
  }

  onSubmit() {
    if (!this.form.latitude || !this.form.longitude) {
      this.error.set('Please pick your store location on the map.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const payload = {
      username: this.form.username,
      email: this.form.email,
      password: this.form.password,
      phone: this.form.phone,
      store_name: this.form.store_name,
      description: this.form.description,
      vendor_email: this.form.vendor_email || this.form.email,
      address: this.form.address,
      city: this.form.city,
      state: this.form.state,
      postal_code: this.form.postal_code,
      latitude: this.form.latitude,
      longitude: this.form.longitude
    };

    this.api.registerVendor(payload).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        localStorage.setItem('vendor_status', res.vendor_status || 'pending');
        this.router.navigate(['/pending-approval']);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err.error?.detail || err.error?.username?.[0] || err.error?.email?.[0] || err.error?.store_name?.[0] || 'Registration failed. Please try again.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }
}
