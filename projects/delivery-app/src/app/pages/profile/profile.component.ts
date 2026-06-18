import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertService,
  ApiService,
  AuthService,
  formatFormErrors,
  isValidEmail,
  isValidIndianPhone,
  MapLocation,
  MapPickerComponent,
  normalizeIndianPhone,
  parseFormErrors,
  sanitizeEmail,
  User,
} from '@shared/public-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe,
    MapPickerComponent,
    RouterLink,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private alerts = inject(AlertService);

  profile: Partial<User> = {};
  loading = signal(true);
  saving = signal(false);
  savingLocation = signal(false);
  showMapPicker = signal(false);
  pickedLat = signal<number | null>(null);
  pickedLng = signal<number | null>(null);
  locationSaved = signal(false);
  fieldErrors = signal<Record<string, string>>({});

  ngOnInit() {
    this.api.getProfile().subscribe({
      next: (u) => {
        this.profile = { ...u };
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error('Could not load profile details.');
      },
    });
  }

  save() {
    const errors = this.validateProfile();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.alerts.error('Please fix the highlighted profile fields.');
      return;
    }

    this.saving.set(true);
    const payload = {
      ...this.profile,
      email: this.profile.email ? sanitizeEmail(this.profile.email) : '',
      phone: this.profile.phone ? normalizeIndianPhone(this.profile.phone) : '',
    };
    this.api.updateProfile(payload).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.alerts.success('Profile updated.');
        this.saving.set(false);
      },
      error: (err) => {
        const fieldLabels = {
          first_name: 'First name',
          last_name: 'Last name',
          email: 'Email',
          phone: 'Phone',
        };
        const parsed = parseFormErrors(err?.error || err);
        this.fieldErrors.update((current) => ({
          ...current,
          ...parsed.fieldErrors,
        }));
        this.alerts.error(
          formatFormErrors(err?.error || err, 'Update failed.', fieldLabels)
        );
        this.saving.set(false);
      },
    });
  }

  onLocationPicked(loc: MapLocation) {
    this.pickedLat.set(loc.lat);
    this.pickedLng.set(loc.lng);
    this.locationSaved.set(false);
  }

  saveLocation() {
    const lat = this.pickedLat();
    const lng = this.pickedLng();
    if (!lat || !lng) return;
    this.savingLocation.set(true);
    this.api.updateLocation(lat, lng).subscribe({
      next: () => {
        this.locationSaved.set(true);
        this.savingLocation.set(false);
        this.showMapPicker.set(false);
        this.alerts.success('Base location updated.');
      },
      error: () => {
        this.savingLocation.set(false);
        this.alerts.error('Could not update base location.');
      },
    });
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  onEmailInput(value: string): void {
    this.profile.email = sanitizeEmail(value);
    this.clearFieldError('email');
  }

  onPhoneInput(value: string): void {
    this.profile.phone = normalizeIndianPhone(value);
    this.clearFieldError('phone');
  }

  isProfileFormValid(): boolean {
    return (
      Object.keys(this.validateProfile()).length === 0 &&
      Object.keys(this.fieldErrors()).length === 0
    );
  }

  logout() {
    this.auth.logout();
  }

  initials() {
    const u = this.profile;
    return (
      ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() ||
      u.username?.[0]?.toUpperCase() ||
      '?'
    );
  }

  private validateProfile(): Record<string, string> {
    const errors: Record<string, string> = {};
    const email = sanitizeEmail(this.profile.email);
    const phone = normalizeIndianPhone(this.profile.phone);

    if (email && !isValidEmail(email))
      errors['email'] = 'Enter a valid email address.';
    if (phone && !isValidIndianPhone(phone))
      errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';

    return errors;
  }
}
