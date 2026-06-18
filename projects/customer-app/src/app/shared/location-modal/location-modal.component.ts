import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { NxButtonComponent } from '../ui/nx-button/nx-button.component';

interface AreaOption {
  area: string;
  city: string;
  address: string;
  eta: string;
}

@Component({
  selector: 'fd-location-modal',
  standalone: true,
  imports: [NxButtonComponent],
  templateUrl: './location-modal.component.html',
  styleUrls: ['./location-modal.component.scss'],
})
export class LocationModalComponent {
  query = signal('');
  savedAddresses = computed(() => this.state.addresses());
  filteredAddresses = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.savedAddresses();
    return this.savedAddresses().filter((address) =>
      `${address.label} ${address.name} ${address.line} ${address.city || ''} ${address.state || ''} ${address.pincode || ''}`
        .toLowerCase()
        .includes(q),
    );
  });
  selected = signal<AreaOption>({
    area: 'Near you',
    city: '',
    address: 'Use current location or select a saved address',
    eta: '',
  });
  selectedAddressId = signal('');

  constructor(
    public ui: UiService,
    public state: AppStateService,
    private router: Router,
  ) {}

  choose(area: AreaOption): void {
    this.selected.set(area);
  }

  chooseSaved(address: Address): void {
    this.selectedAddressId.set(address.id);
    this.state.selectAddress(address.id);
    this.selected.set({
      area: address.label,
      city: address.city || '',
      address: address.line,
      eta: '',
    });
    this.state.showToast(`${address.label} selected`);
  }

  isAddressSelected(address: Address): boolean {
    const selectedId = this.selectedAddressId() || this.state.activeAddress()?.id;
    return selectedId === address.id;
  }

  useCurrentLocation(): void {
    this.state.showToast('Requesting browser location permission...');
    this.state.useCurrentLocation();
    this.ui.closeLocation();
  }

  addAddress(): void {
    this.ui.closeLocation();
    this.router.navigate(['/addresses'], { queryParams: { add: '1' } });
  }

  save(): void {
    if (this.selectedAddressId()) {
      this.state.selectAddress(this.selectedAddressId());
    }
    this.ui.closeLocation();
  }
}
