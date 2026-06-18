import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MapPickerComponent,
  type MapLocation,
} from '@shared/lib/components/map-picker/map-picker.component';
import {
  INDIA_PINCODE_PATTERN,
  isValidIndianPhone,
  normalizeIndianPhone,
  sanitizeDigits,
  stripControlCharacters,
} from '@shared/lib/utils/input-validation';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { MobileBottomSheetComponent } from '../../mobile-ui/mobile-bottom-sheet/mobile-bottom-sheet.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbsComponent,
    MapPickerComponent,
    MobileBottomSheetComponent,
  ],
  templateUrl: './addresses.component.html',
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent {
  addresses = computed(() => this.state.addresses());
  showModal = signal(false);
  editing = signal<string | null>(null);
  formError = signal('');
  fieldErrors = signal<Record<string, string>>({});
  form: Address = { id: '', label: '', name: '', line: '', phone: '' };

  constructor(private state: AppStateService, private route: ActivatedRoute) {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('add') === '1') this.openModal();
    });
  }

  openModal(): void {
    this.editing.set(null);
    this.formError.set('');
    this.fieldErrors.set({});
    this.form = { id: '', label: '', name: '', line: '', phone: '' };
    this.showModal.set(true);
  }

  edit(address: Address): void {
    this.editing.set(address.id);
    this.formError.set('');
    this.fieldErrors.set({});
    this.form = { ...address };
    this.showModal.set(true);
  }

  save(event: Event): void {
    event.preventDefault();
    this.form = {
      ...this.form,
      label: stripControlCharacters(this.form.label),
      name: stripControlCharacters(this.form.name),
      line: stripControlCharacters(this.form.line),
      city: stripControlCharacters(this.form.city),
      state: stripControlCharacters(this.form.state),
      pincode: sanitizeDigits(this.form.pincode, 6),
      phone: normalizeIndianPhone(this.form.phone),
    };
    const errors = this.validateForm();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.formError.set('Please fix the highlighted address fields.');
      return;
    }
    this.formError.set('');
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

  closeModal(): void {
    this.showModal.set(false);
    this.formError.set('');
    this.fieldErrors.set({});
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  isAddressFormValid(): boolean {
    return (
      Object.keys(this.validateForm()).length === 0 &&
      Object.keys(this.fieldErrors()).length === 0
    );
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    this.formError.set('');
  }

  onPhoneInput(value: string): void {
    this.form.phone = normalizeIndianPhone(value);
    this.clearFieldError('phone');
  }

  onPincodeInput(value: string): void {
    this.form.pincode = sanitizeDigits(value, 6);
    this.clearFieldError('pincode');
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
    ['line', 'city', 'state', 'pincode', 'latitude', 'longitude'].forEach(
      (field) => this.clearFieldError(field)
    );
  }

  private validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const phone = normalizeIndianPhone(this.form.phone);
    const pincode = sanitizeDigits(this.form.pincode, 6);

    if (!this.form.label?.trim())
      errors['label'] = 'Address label is required.';
    if (!this.form.name?.trim()) errors['name'] = 'Receiver name is required.';
    if (!phone) errors['phone'] = 'Receiver phone is required.';
    else if (!isValidIndianPhone(phone))
      errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';
    if (!this.form.line?.trim()) errors['line'] = 'Full address is required.';
    if (!this.form.city?.trim()) errors['city'] = 'City is required.';
    if (!this.form.state?.trim()) errors['state'] = 'State is required.';
    if (!pincode) errors['pincode'] = 'PIN code is required.';
    else if (!INDIA_PINCODE_PATTERN.test(pincode))
      errors['pincode'] = 'Enter a valid 6-digit PIN code.';

    return errors;
  }
}
