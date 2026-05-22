import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MapLocation, MapPickerComponent } from '@shared/public-api';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [BreadcrumbsComponent, MapPickerComponent],
  templateUrl: './addresses.component.html',
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent {
  addresses = computed(() => this.state.addresses());
  showModal = signal(false);
  editing = signal<string | null>(null);
  form: Address = { id: '', label: '', name: '', line: '', phone: '' };

  constructor(
    private state: AppStateService,
    private route: ActivatedRoute,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('add') === '1') this.openModal();
    });
  }

  openModal(): void {
    this.editing.set(null);
    this.form = { id: '', label: '', name: '', line: '', phone: '' };
    this.showModal.set(true);
  }

  edit(address: Address): void {
    this.editing.set(address.id);
    this.form = { ...address };
    this.showModal.set(true);
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.editing()) this.state.updateAddress(this.form);
    else this.state.createAddress(this.form);
    this.showModal.set(false);
  }

  remove(id: string): void {
    this.state.deleteAddress(id);
  }

  makeDefault(id: string): void {
    this.state.selectAddress(id);
    this.state.showToast('Default address updated');
  }

  onMapLocationPicked(location: MapLocation): void {
    this.form = {
      ...this.form,
      line: location.address || this.form.line,
      city: location.city || this.form.city,
      state: location.state || this.form.state,
      pincode: location.postal_code || this.form.pincode,
      latitude: location.lat,
      longitude: location.lng,
    };
  }
}
