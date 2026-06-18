import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AppStateService } from '../../services/app-state.service';

@Component({
  standalone: true,
  imports: [FormsModule],
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
