import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocationService, MapLocation, MapPickerComponent } from '@shared/public-api';

@Component({
  selector: 'app-set-location',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapPickerComponent],
  templateUrl: './set-location.component.html',
  styleUrl: './set-location.component.scss',
})
export class SetLocationComponent {
  private readonly locationService = inject(LocationService);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly error = signal('');
  readonly showMap = signal(true);

  form = {
    label: '',
    city: '',
    state: '',
    postal_code: '',
    lat: 12.9716,
    lng: 77.5946,
  };

  constructor() {
    const current = this.locationService.location();
    if (current) {
      this.form.label = current.name;
      this.form.city = current.city || '';
      this.form.state = current.state || '';
      this.form.postal_code = current.postalCode || '';
      this.form.lat = current.lat;
      this.form.lng = current.lng;
    }
  }

  onMapLocation(location: MapLocation) {
    this.form.lat = location.lat;
    this.form.lng = location.lng;
    this.form.label = location.address || location.city || this.form.label;
    this.form.city = location.city || this.form.city;
    this.form.state = location.state || this.form.state;
    this.form.postal_code = location.postal_code || this.form.postal_code;
  }

  useCurrentLocation() {
    this.saving.set(true);
    this.error.set('');
    this.locationService.initializeLocation(true).then((location) => {
      this.saving.set(false);
      if (!location) {
        this.error.set('We could not detect your location. Try searching and pinning it on the map.');
        return;
      }
      this.form.label = location.name;
      this.form.city = location.city || this.form.city;
      this.form.state = location.state || this.form.state;
      this.form.postal_code = location.postalCode || this.form.postal_code;
      this.form.lat = location.lat;
      this.form.lng = location.lng;
    });
  }

  save() {
    const name = this.form.city || this.form.postal_code || this.form.label;
    if (!name.trim()) {
      this.error.set('Add at least a city, postal code, or pinned place before saving.');
      return;
    }

    this.locationService.setManualLocation({
      lat: this.form.lat,
      lng: this.form.lng,
      name: [this.form.label, this.form.city || this.form.postal_code].filter(Boolean)[0] || name.trim(),
      city: this.form.city || '',
      state: this.form.state || '',
      postalCode: this.form.postal_code || '',
      source: 'manual',
    });
    this.router.navigate(['/']);
  }
}
