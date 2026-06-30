import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  type MapLocation,
  MapPickerComponent,
} from '@shared/lib/components/map-picker/map-picker.component';

import { AppStateService } from '../../services/app-state.service';

@Component({
  standalone: true,
  imports: [FormsModule, MapPickerComponent],
  templateUrl: './location.component.html',
  styleUrls: ['./location.component.scss'],
})
export class LocationComponent {
  label = signal('');
  city = signal('');
  stateName = signal('');
  postalCode = signal('');
  latitude = signal('');
  longitude = signal('');
  returnUrl = computed(() => this.route.snapshot.queryParamMap.get('returnUrl') || '/');
  canContinue = computed(() => !!this.state.serviceability()?.is_serviceable);
  mapInitialLat = computed(() => {
    const address = this.state.activeAddress();
    const lat = Number(address?.latitude || this.latitude() || 12.9716);
    return Number.isFinite(lat) ? lat : 12.9716;
  });
  mapInitialLng = computed(() => {
    const address = this.state.activeAddress();
    const lng = Number(address?.longitude || this.longitude() || 77.5946);
    return Number.isFinite(lng) ? lng : 77.5946;
  });

  constructor(
    public state: AppStateService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  useCurrentLocation(): void {
    this.state.useCurrentLocation();
    window.setTimeout(() => this.finishIfServiceable(), 900);
  }

  selectAddress(id: string): void {
    this.state.selectAddress(id);
    window.setTimeout(() => this.finishIfServiceable(), 300);
  }

  applyManualLocation(): void {
    const lat = Number(this.latitude());
    const lng = Number(this.longitude());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.state.showToast('Add valid map coordinates for this location.');
      return;
    }
    this.state.selectMapLocation({
      lat,
      lng,
      address: this.label() || this.city() || 'Selected location',
      city: this.city(),
      state: this.stateName(),
      postal_code: this.postalCode(),
    });
    window.setTimeout(() => this.finishIfServiceable(), 500);
  }

  onMapLocationPicked(location: MapLocation): void {
    this.latitude.set(String(location.lat));
    this.longitude.set(String(location.lng));
    if (location.address) this.label.set(location.address);
    if (location.city) this.city.set(location.city);
    if (location.state) this.stateName.set(location.state);
    if (location.postal_code) this.postalCode.set(location.postal_code);
    this.state.selectMapLocation({
      lat: location.lat,
      lng: location.lng,
      address: location.address || this.label() || 'Selected location',
      city: location.city || this.city(),
      state: location.state || this.stateName(),
      postal_code: location.postal_code || this.postalCode(),
    });
  }

  continueShopping(): void {
    if (!this.canContinue()) {
      this.state.showToast(
        this.state.serviceability()?.message || 'Select a serviceable location.',
      );
      return;
    }
    this.router.navigateByUrl(this.returnUrl());
  }

  addressLine(address: { line?: string; city?: string; pincode?: string }): string {
    return [address.line, address.city, address.pincode].filter(Boolean).join(', ');
  }

  private finishIfServiceable(): void {
    if (this.canContinue()) this.continueShopping();
  }
}
