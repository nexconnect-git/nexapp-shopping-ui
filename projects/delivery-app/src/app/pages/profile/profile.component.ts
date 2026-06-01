import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertService,
  ApiService,
  AuthService,
  MapLocation,
  MapPickerComponent,
  User,
} from '@shared/public-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, MapPickerComponent],
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

  private flattenApiError(err: unknown): string {
    const apiError = err as {
      error?: Record<string, string | string[]> | string;
    };
    const payload = apiError.error;
    if (!payload) return 'Update failed.';
    if (typeof payload === 'string') return payload;
    const values = Object.values(payload).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    );
    return values.filter(Boolean).join(' ') || 'Update failed.';
  }

  save() {
    this.saving.set(true);
    this.api.updateProfile(this.profile).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.alerts.success('Profile updated.');
        this.saving.set(false);
      },
      error: (err) => {
        this.alerts.error(this.flattenApiError(err));
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

  initials() {
    const u = this.profile;
    return (
      ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() ||
      u.username?.[0]?.toUpperCase() ||
      '?'
    );
  }
}
