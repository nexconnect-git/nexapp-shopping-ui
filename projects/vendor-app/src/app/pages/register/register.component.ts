import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  VendorApi,
  AuthService,
  formatFormErrors,
  INDIA_PINCODE_PATTERN,
  isValidEmail,
  isValidIndianPhone,
  MapLocation,
  MapPickerComponent,
  normalizeIndianPhone,
  parseFormErrors,
  sanitizeDigits,
  sanitizeEmail,
  sanitizeUsername,
  stripControlCharacters,
  USERNAME_PATTERN,
} from '@shared/public-api';
import { Subscription } from 'rxjs';

interface AvailabilityState {
  checking: boolean;
  unique?: boolean;
  message?: string;
  suggestions: string[];
  value: string;
}

const VENDOR_STORE_TYPE_OPTIONS = [
  { value: 'wholesale_store', label: 'Wholesale Store' },
  { value: 'retail_store', label: 'Retail Store' },
  { value: 'kirana_store', label: 'Kirana Store' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'hypermarket', label: 'Hypermarket' },
  { value: 'department_store', label: 'Department Store' },
  { value: 'specialty_store', label: 'Specialty Store' },
  { value: 'convenience_store', label: 'Convenience Store' },
  { value: 'discount_store', label: 'Discount Store' },
  { value: 'franchise_store', label: 'Franchise Store' },
  { value: 'chain_store', label: 'Chain Store' },
  { value: 'online_store', label: 'Online Store / E-commerce' },
  { value: 'street_vendor', label: 'Street Vendor / Hawker' },
  { value: 'mandi_market_yard', label: 'Mandi / Market Yard' },
  { value: 'b2b_store', label: 'B2B Store' },
];

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, MapPickerComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private api = inject(VendorApi);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly storeTypeOptions = VENDOR_STORE_TYPE_OPTIONS;

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
    vendor_type: 'retail_store',
    description: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    vendor_email: '',
    latitude: null,
    longitude: null,
  };
  logoFile = signal<File | null>(null);
  bannerFile = signal<File | null>(null);
  logoPreview = signal('');
  bannerPreview = signal('');

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
    ['address', 'city', 'state', 'postal_code', 'location'].forEach((field) =>
      this.clearFieldError(field)
    );
  }

  onImageSelected(kind: 'logo' | 'banner', event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    const fileSignal = kind === 'logo' ? this.logoFile : this.bannerFile;
    const previewSignal =
      kind === 'logo' ? this.logoPreview : this.bannerPreview;

    fileSignal.set(file);
    previewSignal.set('');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => previewSignal.set(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  clearImage(kind: 'logo' | 'banner') {
    if (kind === 'logo') {
      this.logoFile.set(null);
      this.logoPreview.set('');
    } else {
      this.bannerFile.set(null);
      this.bannerPreview.set('');
    }
  }

  onIdentityInput(field: 'username' | 'email' | 'phone') {
    if (field === 'username')
      this.form.username = sanitizeUsername(this.form.username);
    if (field === 'email') this.form.email = sanitizeEmail(this.form.email);
    if (field === 'phone')
      this.form.phone = normalizeIndianPhone(this.form.phone);
    this.clearFieldError(field);
    this.scheduleAvailabilityCheck(field);
  }

  onPublicEmailInput() {
    this.form.vendor_email = sanitizeEmail(this.form.vendor_email);
    this.clearFieldError('vendor_email');
  }

  onPostalCodeInput() {
    this.form.postal_code = sanitizeDigits(this.form.postal_code, 6);
    this.clearFieldError('postal_code');
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
    for (const step of [1, 2, 3]) {
      if (!this.validateStep(step)) {
        this.step.set(step);
        this.error.set('Please fix the highlighted fields before continuing.');
        return;
      }
    }

    this.loading.set(true);
    this.error.set('');

    const payload = {
      username: this.form.username.trim(),
      email: sanitizeEmail(this.form.email),
      password: this.form.password,
      phone: normalizeIndianPhone(this.form.phone),
      store_name: stripControlCharacters(this.form.store_name),
      vendor_type: this.form.vendor_type || 'retail_store',
      description: stripControlCharacters(this.form.description),
      vendor_email: sanitizeEmail(this.form.vendor_email || this.form.email),
      address: stripControlCharacters(this.form.address),
      city: stripControlCharacters(this.form.city),
      state: stripControlCharacters(this.form.state),
      postal_code: sanitizeDigits(this.form.postal_code, 6),
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      ...(this.logoFile() ? { logo: this.logoFile() } : {}),
      ...(this.bannerFile() ? { banner: this.bannerFile() } : {}),
    };

    this.api.registerVendor(payload).subscribe({
      next: (res) => {
        if (!this.auth.handleAuthResponse(res)) {
          this.error.set('This account is not allowed in the vendor app.');
          this.loading.set(false);
          return;
        }
        localStorage.setItem(
          this.auth.vendorKey,
          res.vendor_status || 'pending'
        );
        void this.router
          .navigate(['/pending-approval'])
          .finally(() => this.loading.set(false));
      },
      error: (err) => {
        const msg = this.applyRegistrationErrors(err?.error || err);
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  private applyRegistrationErrors(error: any): string {
    const fieldLabels: Record<string, string> = {
      username: 'Username',
      email: 'Email',
      phone: 'Phone',
      password: 'Password',
      store_name: 'Store name',
      description: 'Description',
      vendor_email: 'Public contact email',
      address: 'Street address',
      city: 'City',
      state: 'State',
      postal_code: 'Postal code',
      latitude: 'Latitude',
      longitude: 'Longitude',
      location: 'Location',
    };
    const parsed = parseFormErrors(error);
    this.fieldErrors.update((current) => ({
      ...current,
      ...parsed.fieldErrors,
    }));
    const firstStepWithError = [1, 2, 3].find((step) =>
      this.stepFieldKeys(step).some((field) => !!parsed.fieldErrors[field])
    );
    if (firstStepWithError) this.step.set(firstStepWithError);
    return formatFormErrors(
      error,
      'Registration failed. Please try again.',
      fieldLabels
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
      const email = sanitizeEmail(this.form.email);
      this.form.email = email;
      if (email && !isValidEmail(email)) {
        errors['email'] = 'Enter a valid email address.';
      }
      const phone = normalizeIndianPhone(this.form.phone);
      this.form.phone = phone;
      if (phone && !isValidIndianPhone(phone)) {
        errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';
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
      this.validateRequired('description', 'Description', errors);
      if (this.form.vendor_email && !isValidEmail(this.form.vendor_email)) {
        errors['vendor_email'] = 'Enter a valid public contact email.';
      }
    }

    if (step === 3) {
      this.validateRequired('address', 'Street address', errors);
      this.validateRequired('city', 'City', errors);
      this.validateRequired('state', 'State', errors);
      this.validateRequired('postal_code', 'Postal code', errors);
      if (
        this.form.postal_code &&
        !INDIA_PINCODE_PATTERN.test(sanitizeDigits(this.form.postal_code, 6))
      ) {
        errors['postal_code'] = 'Enter a valid 6-digit pincode.';
      }
      if (this.form.latitude === null || this.form.longitude === null) {
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
    errors: Record<string, string>
  ) {
    if (!String(this.form[field] ?? '').trim()) {
      errors[field] = `${label} is required.`;
    }
  }

  private stepFieldKeys(step: number): string[] {
    if (step === 1) return ['username', 'email', 'phone', 'password'];
    if (step === 2) return ['store_name', 'description', 'vendor_email'];
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
    delay = 450
  ) {
    const value = String(this.form[field] || '').trim();
    if (this.availabilityTimers[field])
      clearTimeout(this.availabilityTimers[field]);
    if (this.availabilitySubs[field])
      this.availabilitySubs[field].unsubscribe();

    if (
      !value ||
      (field === 'username' && !USERNAME_PATTERN.test(value)) ||
      (field === 'email' && !isValidEmail(value)) ||
      (field === 'phone' && !isValidIndianPhone(value))
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

  canContinueStep(step = this.step()): boolean {
    return this.stepIsComplete(step) && !this.stepHasErrors(step);
  }

  canSubmitRegistration(): boolean {
    return (
      !this.loading() &&
      this.canContinueStep(1) &&
      this.canContinueStep(2) &&
      this.canContinueStep(3)
    );
  }

  private stepHasErrors(step: number): boolean {
    const errors = this.fieldErrors();
    return this.stepFieldKeys(step).some((field) => !!errors[field]);
  }

  private stepIsComplete(step: number): boolean {
    if (step === 1) {
      const username = this.form.username.trim();
      const email = sanitizeEmail(this.form.email);
      const phone = normalizeIndianPhone(this.form.phone);
      if (!USERNAME_PATTERN.test(username)) return false;
      if (!isValidEmail(email)) return false;
      if (!isValidIndianPhone(phone)) return false;
      if (!this.form.password || this.form.password.length < 8) return false;

      return (['username', 'email', 'phone'] as const).every((field) => {
        const state = this.availability()[field];
        return (
          state?.value === this.form[field].trim() &&
          state.checking === false &&
          state.unique === true
        );
      });
    }

    if (step === 2) {
      if (!this.form.store_name.trim()) return false;
      if (!this.form.description.trim()) return false;
      if (this.form.vendor_email && !isValidEmail(this.form.vendor_email)) {
        return false;
      }
      return true;
    }

    if (!this.form.address.trim()) return false;
    if (!this.form.city.trim()) return false;
    if (!this.form.state.trim()) return false;
    if (!INDIA_PINCODE_PATTERN.test(sanitizeDigits(this.form.postal_code, 6)))
      return false;
    return this.form.latitude !== null && this.form.longitude !== null;
  }
}
