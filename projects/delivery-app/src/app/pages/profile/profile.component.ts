import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService, MapPickerComponent, MapLocation } from '@shared/public-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, MapPickerComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  profile: any = {};
  loading = signal(true);
  saving = signal(false);
  savingLocation = signal(false);
  showMapPicker = signal(false);
  pickedLat = signal<number | null>(null);
  pickedLng = signal<number | null>(null);
  locationSaved = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  ngOnInit() {
    this.api.getProfile().subscribe({
      next: (u) => { this.profile = { ...u }; this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  save() {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');
    this.api.updateProfile(this.profile).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.successMsg.set('Profile updated!');
        this.saving.set(false);
      },
      error: (err) => {
        const e = err.error;
        this.errorMsg.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Update failed.');
        this.saving.set(false);
      }
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
      },
      error: () => this.savingLocation.set(false)
    });
  }

  initials() {
    const u = this.profile;
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  }
}
