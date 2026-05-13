import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Address, MapPickerComponent, MapLocation } from '@shared/public-api';

@Component({
  selector: 'app-address-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent],
  templateUrl: './address-modal.component.html',
  styleUrl: './address-modal.component.scss',
})
export class AddressModalComponent {
  private api = inject(ApiService);

  created = output<Address>();
  cancelled = output<void>();

  showMap = signal(false);
  saving = signal(false);
  formError = signal('');

  form = this.blankForm();

  private blankForm() {
    return {
      label: 'home' as 'home' | 'work' | 'other',
      landmark: '',
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      is_default: false,
      latitude: null as number | null,
      longitude: null as number | null,
    };
  }

  onMapLocation(loc: MapLocation) {
    this.form.latitude = loc.lat;
    this.form.longitude = loc.lng;
    if (loc.address) this.form.address_line1 = loc.address;
    if (loc.city) this.form.city = loc.city;
    if (loc.state) this.form.state = loc.state;
    if (loc.postal_code) this.form.postal_code = loc.postal_code;
  }

  save() {
    if (!this.form.full_name.trim() || !this.form.address_line1.trim()) {
      this.formError.set('Full name and address are required.');
      return;
    }
    if (this.form.label === 'other' && !this.form.landmark.trim()) {
      this.formError.set('Please enter a name for this address.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    this.api.createAddress(this.addressPayload()).subscribe({
      next: (addr: Address) => {
        this.saving.set(false);
        this.created.emit(addr);
      },
      error: (err: any) => {
        const e = err.error;
        this.formError.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Could not save address.');
        this.saving.set(false);
      },
    });
  }

  cancel() {
    this.cancelled.emit();
  }

  private addressPayload() {
    return {
      ...this.form,
      landmark: this.form.label === 'other' ? this.form.landmark.trim() : '',
    };
  }
}
