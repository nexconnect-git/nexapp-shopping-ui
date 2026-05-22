import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  ApiService,
  AuthService,
  MapLocation,
  MapPickerComponent,
} from '@shared/public-api';
import { Subscription } from 'rxjs';

interface AvailabilityState {
  checking: boolean;
  unique?: boolean;
  message?: string;
  suggestions: string[];
  value: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{8,18}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, MapPickerComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal(1);
  loading = signal(false);
  error = signal('');
  success = signal('');
  fieldErrors = signal<Record<string, string>>({});
  availability = signal<Record<string, AvailabilityState>>({});
  private availabilityTimers: Record<string, ReturnType<typeof setTimeout>> =
    {};
  private availabilitySubs: Record<string, Subscription> = {};

  form: any = {
    username: '',
    email: '',
    password: '',
    phone: '',
    store_name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    vendor_email: '',
    latitude: null,
    longitude: null,
  };

  nextStep() {
    this.error.set('');
    if (!this.validateStep(this.step())) return;
    this.step.update((s) => s + 1);
  }

  prevStep() {
    this.error.set('');
    this.step.update((s) => s - 1);
  }

  onLocationPicked(loc: MapLocation) {
    this.form.latitude = loc.lat;
    this.form.longitude = loc.lng;
    if (loc.address && !this.form.address) this.form.address = loc.address;
    if (loc.city && !this.form.city) this.form.city = loc.city;
    if (loc.state && !this.form.state) this.form.state = loc.state;
    if (loc.postal_code && !this.form.postal_code)
      this.form.postal_code = loc.postal_code;
  }

  onIdentityInput(field: 'username' | 'email' | 'phone') {
    this.clearFieldError(field);
    this.scheduleAvailabilityCheck(field);
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  availabilityState(field: string): AvailabilityState | null {
    return this.availability()[field] || null;
  }

  useSuggestion(field: 'username' | 'email' | 'phone', suggestion: string) {
    this.form[field] = suggestion;
    this.clearFieldError(field);
    this.scheduleAvailabilityCheck(field, 0);
  }

  onSubmit() {
    if (!this.validateStep(1) || !this.validateStep(2) || !this.validateStep(3))
      return;

    this.loading.set(true);
    this.error.set('');

    const payload = {
      username: this.form.username.trim(),
      email: this.form.email.trim(),
      password: this.form.password,
      phone: this.form.phone.trim(),
      store_name: this.form.store_name.trim(),
      description: this.form.description.trim(),
      vendor_email: (this.form.vendor_email || this.form.email).trim(),
      address: this.form.address.trim(),
      city: this.form.city.trim(),
      state: this.form.state.trim(),
      postal_code: this.form.postal_code.trim(),
      latitude: this.form.latitude,
      longitude: this.form.longitude,
    };

    this.api.registerVendor(payload).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        localStorage.setItem(
          this.auth.vendorKey,
          res.vendor_status || 'pending',
        );
        void this.router
          .navigate(['/pending-approval'])
          .finally(() => this.loading.set(false));
      },
      error: (err) => {
        const msg = this.registrationErrorMessage(err.error);
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  private registrationErrorMessage(error: any): string {
    const fieldLabels: Record<string, string> = {
      username: 'Username',
      email: 'Email',
      phone: 'Phone',
      password: 'Password',
      store_name: 'Store name',
      vendor_email: 'Public contact email',
      address: 'Street address',
      city: 'City',
      state: 'State',
      postal_code: 'Postal code',
      latitude: 'Latitude',
      longitude: 'Longitude',
      location: 'Location',
    };
    for (const [field, label] of Object.entries(fieldLabels)) {
      const message = error?.[field]?.[0] || error?.[field];
      if (message) return `${label}: ${message}`;
    }
    return (
      error?.non_field_errors?.[0] ||
      error?.detail ||
      error?.error ||
      'Registration failed. Please try again.'
    );
  }

  private validateStep(step: number): boolean {
    const errors = { ...this.fieldErrors() };
    for (const key of this.stepFieldKeys(step)) {
      delete errors[key];
    }

    if (step === 1) {
      this.validateRequired('username', 'Username', errors);
      this.validateRequired('email', 'Email address', errors);
      this.validateRequired('phone', 'Phone number', errors);
      this.validateRequired('password', 'Password', errors);

      const username = this.form.username.trim();
      if (username && !USERNAME_PATTERN.test(username)) {
        errors['username'] =
          'Use 3-30 letters, numbers, dots, dashes, or underscores.';
      }
      const email = this.form.email.trim();
      if (email && !EMAIL_PATTERN.test(email)) {
        errors['email'] = 'Enter a valid email address.';
      }
      const phone = this.form.phone.trim();
      if (phone && !PHONE_PATTERN.test(phone)) {
        errors['phone'] = 'Enter a valid phone number.';
      }
      if (this.form.password && this.form.password.length < 8) {
        errors['password'] = 'Password must be at least 8 characters.';
      }

      for (const field of ['username', 'email', 'phone'] as const) {
        const value = this.form[field].trim();
        const state = this.availability()[field];
        if (!value || errors[field]) continue;
        if (!state || state.value !== value) {
          this.scheduleAvailabilityCheck(field, 0);
          errors[field] = `Checking ${field} availability...`;
        } else if (state.checking) {
          errors[field] = `Checking ${field} availability...`;
        } else if (state.unique === false) {
          errors[field] = state.message || `${field} is already in use.`;
        }
      }
    }

    if (step === 2) {
      this.validateRequired('store_name', 'Store name', errors);
      if (
        this.form.vendor_email &&
        !EMAIL_PATTERN.test(this.form.vendor_email.trim())
      ) {
        errors['vendor_email'] = 'Enter a valid public contact email.';
      }
    }

    if (step === 3) {
      this.validateRequired('address', 'Street address', errors);
      this.validateRequired('city', 'City', errors);
      this.validateRequired('state', 'State', errors);
      if (
        this.form.postal_code &&
        !PINCODE_PATTERN.test(this.form.postal_code.trim())
      ) {
        errors['postal_code'] = 'Enter a valid 6-digit pincode.';
      }
      if (!this.form.latitude || !this.form.longitude) {
        errors['location'] = 'Please pick your store location on the map.';
      }
    }

    this.fieldErrors.set(errors);
    const currentStepFields = this.stepFieldKeys(step);
    return !currentStepFields.some((key) => !!errors[key]);
  }

  private validateRequired(
    field: string,
    label: string,
    errors: Record<string, string>,
  ) {
    if (!String(this.form[field] ?? '').trim()) {
      errors[field] = `${label} is required.`;
    }
  }

  private stepFieldKeys(step: number): string[] {
    if (step === 1) return ['username', 'email', 'phone', 'password'];
    if (step === 2) return ['store_name', 'vendor_email'];
    return ['address', 'city', 'state', 'postal_code', 'location'];
  }

  clearFieldError(field: string) {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  private scheduleAvailabilityCheck(
    field: 'username' | 'email' | 'phone',
    delay = 450,
  ) {
    const value = String(this.form[field] || '').trim();
    if (this.availabilityTimers[field])
      clearTimeout(this.availabilityTimers[field]);
    if (this.availabilitySubs[field])
      this.availabilitySubs[field].unsubscribe();

    if (
      !value ||
      (field === 'username' && !USERNAME_PATTERN.test(value)) ||
      (field === 'email' && !EMAIL_PATTERN.test(value)) ||
      (field === 'phone' && !PHONE_PATTERN.test(value))
    ) {
      this.availability.update((states) => {
        const next = { ...states };
        delete next[field];
        return next;
      });
      return;
    }

    this.availability.update((states) => ({
      ...states,
      [field]: { checking: true, suggestions: [], value },
    }));
    this.availabilityTimers[field] = setTimeout(() => {
      this.availabilitySubs[field] = this.api
        .checkVendorIdentityAvailability({ field, value })
        .subscribe({
          next: (result) => {
            if (String(this.form[field] || '').trim() !== value) return;
            const message = result.message || `${field} is already in use.`;
            this.availability.update((states) => ({
              ...states,
              [field]: {
                checking: false,
                unique: result.unique,
                message: result.unique ? '' : message,
                suggestions: result.suggestions || [],
                value,
              },
            }));
            if (result.unique) {
              this.clearFieldError(field);
            } else {
              this.fieldErrors.update((errors) => ({
                ...errors,
                [field]: message,
              }));
            }
          },
          error: () => {
            if (String(this.form[field] || '').trim() !== value) return;
            const message = `Could not validate ${field} availability. Try again.`;
            this.availability.update((states) => ({
              ...states,
              [field]: {
                checking: false,
                unique: false,
                message,
                suggestions: [],
                value,
              },
            }));
            this.fieldErrors.update((errors) => ({
              ...errors,
              [field]: message,
            }));
          },
        });
    }, delay);
  }
}
