import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Address, MapPickerComponent, MapLocation } from '@shared/public-api';

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss'
})
export class AddressesComponent implements OnInit {
  private api = inject(ApiService);

  addresses = signal<Address[]>([]);
  loading = signal(true);
  showForm = signal(false);
  showMap = signal(false);
  editing = signal<string | null>(null);
  saving = signal(false);
  formError = signal('');

  form: any = this.blankForm();

  ngOnInit() { this.load(); }

  load() {
    this.api.getAddresses().subscribe({
      next: (r) => { this.addresses.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  blankForm() {
    return { label: 'home', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', is_default: false, latitude: null as number | null, longitude: null as number | null };
  }

  openForm() { this.form = this.blankForm(); this.editing.set(null); this.showForm.set(true); this.formError.set(''); }

  editAddress(addr: Address) {
    this.form = { ...addr };
    this.editing.set(addr.id);
    this.showForm.set(true);
    this.formError.set('');
  }

  cancelForm() { this.showForm.set(false); this.showMap.set(false); this.editing.set(null); }

  onMapLocation(loc: MapLocation) {
    this.form.latitude = loc.lat;
    this.form.longitude = loc.lng;
    if (loc.address) this.form.address_line1 = loc.address;
    if (loc.city) this.form.city = loc.city;
    if (loc.state) this.form.state = loc.state;
    if (loc.postal_code) this.form.postal_code = loc.postal_code;
    this.showMap.set(false);
  }

  saveAddress() {
    this.saving.set(true);
    this.formError.set('');
    const req = this.editing()
      ? this.api.updateAddress(this.editing()!, this.form)
      : this.api.createAddress(this.form);
    req.subscribe({
      next: () => { this.saving.set(false); this.showForm.set(false); this.editing.set(null); this.load(); },
      error: (err) => {
        const e = err.error;
        this.formError.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Save failed.');
        this.saving.set(false);
      }
    });
  }

  deleteAddress(id: string) {
    if (!confirm('Delete this address?')) return;
    this.api.deleteAddress(id).subscribe({ next: () => this.load() });
  }
}
