import { Component, computed, effect, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';

@Component({
  selector: 'fd-location-modal',
  standalone: true,
  imports: [NxModalShellComponent, CustomerIconComponent],
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
      `${address.label} ${address.name} ${address.line} ${address.city || ''} ${
        address.state || ''
      } ${address.pincode || ''}`
        .toLowerCase()
        .includes(q)
    );
  });
  selectedAddressId = signal('');

  constructor(
    public ui: UiService,
    public state: AppStateService,
    private router: Router
  ) {
    effect(() => {
      if (this.ui.locationModalOpen()) {
        this.query.set('');
        this.selectedAddressId.set(untracked(() => this.state.activeAddress()?.id || ''));
      }
    });
  }

  chooseSaved(address: Address): void {
    this.selectedAddressId.set(address.id);
  }

  isAddressSelected(address: Address): boolean {
    const selectedId =
      this.selectedAddressId() || this.state.activeAddress()?.id;
    return selectedId === address.id;
  }

  useCurrentLocation(): void {
    this.ui.closeLocation();
    this.state.useCurrentLocation();
  }

  openDeliveryArea(): void {
    this.ui.closeLocation();
    this.router.navigate(['/location'], {
      queryParams: { returnUrl: this.router.url },
      fragment: 'delivery-map',
    });
  }
  addAddress(): void {
    this.ui.closeLocation();
    this.router.navigate(['/addresses'], { queryParams: { add: '1' } });
  }

  save(): void {
    const id = this.selectedAddressId() || this.state.activeAddress()?.id;
    if (!id) return;
    this.state.selectAddress(id);
    this.ui.closeLocation();
  }
}
