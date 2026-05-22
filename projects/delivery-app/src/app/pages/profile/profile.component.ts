import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AuthService,
  MapLocation,
  MapPickerComponent,
  ToastService,
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
  private toast = inject(ToastService);

  profile: any = {};
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
      error: () => this.loading.set(false),
    });
  }

  save() {
    this.saving.set(true);
    this.api.updateProfile(this.profile).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.toast.show('Profile updated!', 'success');
        this.saving.set(false);
      },
      error: (err) => {
        const e = err.error;
        this.toast.show(
          typeof e === 'object'
            ? Object.values(e).flat().join(' ')
            : 'Update failed.',
          'error',
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
        this.toast.show('Base location updated!', 'success');
      },
      error: () => this.savingLocation.set(false),
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
