import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  type MapLocation,
  MapPickerComponent,
} from '@shared/lib/components/map-picker/map-picker.component';

import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';

@Component({
  standalone: true,
  imports: [RouterLink, CustomerIconComponent,FormsModule, MapPickerComponent, CustomerPageHeaderComponent, CustomerStateComponent],
  templateUrl: './location.component.html',
  styleUrls: ['./location.component.scss'],
})
export class LocationComponent {
  editLocation = signal(false);
  pointChosen = signal(false);
  confirmedPoint = computed(() => this.pointChosen() && this.state.serviceability()?.is_serviceable === true);
  error = signal('');
  label = signal('');
  city = signal('');
  stateName = signal('');
  postalCode = signal('');
  latitude = signal('');
  longitude = signal('');
  returnUrl = computed(
    () => this.route.snapshot.queryParamMap.get('returnUrl') || '/'
  );
  canContinue = computed(
    () =>
      !this.state.serviceabilityLoading() &&
      !!this.state.serviceability()?.is_serviceable
  );
  mapInitialLat = computed(() => this.mapCoordinate(this.latitude().trim() || this.state.customerLocationQuery()['lat']));
  mapInitialLng = computed(() => this.mapCoordinate(this.longitude().trim() || this.state.customerLocationQuery()['lng']));
  private mapCoordinate(value: unknown): number | null {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
  }

  constructor(
    public state: AppStateService,
    public ui: UiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  useCurrentLocation(): void {
    this.state.useCurrentLocation();
  }

  selectAddress(id: string): void {
    this.pointChosen.set(true);
    this.editLocation.set(false);
    this.state.selectAddress(id);
  }

  applyManualLocation(): void {
    const lat = Number(this.latitude());
    const lng = Number(this.longitude());
    this.error.set('');
    if (
      !this.latitude().trim() ||
      !this.longitude().trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      this.error.set(
        'Enter a latitude between -90 and 90 and a longitude between -180 and 180.'
      );
      return;
    }
    this.pointChosen.set(true);
    this.editLocation.set(false);
    this.state.selectMapLocation({
      lat,
      lng,
      address: this.label() || this.city() || 'Selected location',
      city: this.city(),
      state: this.stateName(),
      postal_code: this.postalCode(),
    });
  }

  onMapLocationPicked(location: MapLocation): void {
    this.pointChosen.set(true);
    this.editLocation.set(false);
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
        this.state.serviceability()?.message || 'Select a serviceable location.'
      );
      return;
    }
    const destination = this.returnUrl();
    this.router.navigateByUrl(
      destination.startsWith('/') && !destination.startsWith('//')
        ? destination
        : '/'
    );
  }

  addressLine(address: {
    line?: string;
    city?: string;
    pincode?: string;
  }): string {
    return [address.line, address.city, address.pincode]
      .filter(Boolean)
      .join(', ');
  }

}
