import { inject, Injectable } from '@angular/core';
import { AppStateService } from '../app-state.service';

@Injectable({ providedIn: 'root' })
export class CustomerLocationFacade {
  private readonly state = inject(AppStateService);

  readonly location = this.state.location;
  readonly activeAddress = this.state.activeAddress;
  readonly addresses = this.state.addresses;
  readonly serviceability = this.state.serviceability;
  readonly serviceabilityLoading = this.state.serviceabilityLoading;

  updateLocation(value: string): void {
    this.state.updateLocation(value);
  }

  selectMapLocation(location: Parameters<AppStateService['selectMapLocation']>[0]): void {
    this.state.selectMapLocation(location);
  }

  useCurrentLocation(): void {
    this.state.useCurrentLocation();
  }

  loadAddresses(): void {
    this.state.loadAddresses();
  }

  selectAddress(id: string): void {
    this.state.selectAddress(id);
  }
}
