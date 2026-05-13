import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Address, LocationService, MapPickerComponent, MapLocation } from '@shared/public-api';

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss'
})
export class AddressesComponent implements OnInit {
  private api = inject(ApiService);
  private locationService = inject(LocationService);

  addresses = signal<Address[]>([]);
  loading = signal(true);
  showForm = signal(false);
  showMap = signal(false);
  editing = signal<string | null>(null);
  saving = signal(false);
  selecting = signal<string | null>(null);
  formError = signal('');
  pageMessage = signal('');
  pageError = signal('');

  form: any = this.blankForm();

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getAddresses().subscribe({
      next: (r) => {
        const list = (r.results || r) as Address[];
        this.addresses.set(list);
        this.syncSelectedLocation(list);
        this.loading.set(false);
      },
      error: () => {
        this.pageError.set('We could not load your saved addresses. Please try again.');
        this.loading.set(false);
      }
    });
  }

  blankForm() {
    return { label: 'home', landmark: '', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', is_default: false, latitude: null as number | null, longitude: null as number | null };
  }

  openForm() { this.form = this.blankForm(); this.editing.set(null); this.showForm.set(true); this.formError.set(''); }

  cancelForm() { this.showForm.set(false); this.showMap.set(false); this.editing.set(null); this.formError.set(''); }

  onMapLocation(loc: MapLocation) {
    this.form.latitude = loc.lat;
    this.form.longitude = loc.lng;
    if (loc.address) this.form.address_line1 = loc.address;
    if (loc.city) this.form.city = loc.city;
    if (loc.state) this.form.state = loc.state;
    if (loc.postal_code) this.form.postal_code = loc.postal_code;
  }

  saveAddress() {
    if (!this.form.full_name?.trim() || !this.form.address_line1?.trim() || !this.form.city?.trim()) {
      this.formError.set('Full name, address line 1 and city are required.');
      return;
    }
    if (this.form.label === 'other' && !this.form.landmark?.trim()) {
      this.formError.set('Please enter a name for this address.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const payload = this.addressPayload();
    const req = this.editing()
      ? this.api.updateAddress(this.editing()!, payload)
      : this.api.createAddress(payload);
    req.subscribe({
      next: () => { this.saving.set(false); this.showForm.set(false); this.editing.set(null); this.pageMessage.set('Address saved.'); this.load(); },
      error: (err) => {
        const e = err.error;
        this.formError.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Save failed.');
        this.saving.set(false);
      }
    });
  }

  selectAddress(addr: Address) {
    this.pageError.set('');
    this.pageMessage.set('');
    this.selecting.set(addr.id);

    const nextAddress = { ...addr, is_default: true };
    this.api.updateAddress(addr.id, nextAddress).subscribe({
      next: (saved: Address) => {
        const selected = saved?.id ? saved : nextAddress;
        this.addresses.update(list => list.map(item => ({ ...item, is_default: item.id === addr.id })));
        this.applySelectedLocation(selected);
        this.pageMessage.set(`${this.addressTitle(selected)} is now your delivery location.`);
        this.selecting.set(null);
      },
      error: () => {
        this.pageError.set('We could not select this address. Please try again.');
        this.selecting.set(null);
      }
    });
  }

  deleteAddress(id: string, event?: Event) {
    event?.stopPropagation();
    if (!confirm('Delete this address?')) return;
    this.api.deleteAddress(id).subscribe({ next: () => this.load() });
  }

  editAddress(addr: Address, event?: Event) {
    event?.stopPropagation();
    this.form = { ...addr };
    this.editing.set(addr.id);
    this.showForm.set(true);
    this.formError.set('');
  }

  addressTitle(addr: Address): string {
    return addr.city || addr.address_line1 || 'Selected address';
  }

  displayLabel(addr: Address): string {
    if (addr.label === 'home') return 'Home';
    if (addr.label === 'work') return 'Work';
    return addr.landmark?.trim() || 'Other';
  }

  addressSummary(addr: Address): string {
    return [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code]
      .filter(Boolean)
      .join(', ');
  }

  canUseForDelivery(addr: Address): boolean {
    return addr.latitude !== null && addr.latitude !== undefined && addr.longitude !== null && addr.longitude !== undefined;
  }

  onCardKeydown(event: KeyboardEvent, addr: Address) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.selectAddress(addr);
  }

  private syncSelectedLocation(list: Address[]) {
    const current = this.locationService.location();
    if (!current) return;
    const selected = list.find(addr => {
      if (!this.canUseForDelivery(addr)) return false;
      return Number(addr.latitude) === current.lat && Number(addr.longitude) === current.lng;
    });
    if (selected && !selected.is_default) {
      this.addresses.update(items => items.map(item => ({ ...item, is_default: item.id === selected.id })));
    }
  }

  private applySelectedLocation(addr: Address) {
    if (!this.canUseForDelivery(addr)) return;
    this.locationService.setManualLocation({
      lat: Number(addr.latitude),
      lng: Number(addr.longitude),
      name: this.addressTitle(addr),
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postal_code || '',
      source: 'saved_address',
    });
  }

  private addressPayload() {
    return {
      ...this.form,
      landmark: this.form.label === 'other' ? this.form.landmark?.trim() || '' : '',
    };
  }
}
