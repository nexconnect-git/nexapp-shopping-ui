import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { UiService } from '../../services/ui.service';
import { Component, HostListener, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  type MapLocation,
  MapPickerComponent,
} from '@shared/lib/components/map-picker/map-picker.component';
import {
  INDIA_PINCODE_PATTERN,
  isValidIndianPhone,
  normalizeIndianPhone,
  sanitizeDigits,
  stripControlCharacters,
} from '@shared/lib/utils/input-validation';
import {
  formatFormErrors,
  parseFormErrors,
} from '@shared/lib/utils/form-field-errors';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { AuthService } from '../../services/auth.service';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbsComponent,
    CustomerIconComponent,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    NxModalShellComponent,
    MapPickerComponent,
    CustomerLockedStateComponent,
  ],
  templateUrl: './addresses.component.html',
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent {
  addresses = computed(() => this.state.addresses());
  showModal = signal(false);
  editing = signal<string | null>(null);
  saving = signal(false);
  formError = signal('');
  fieldErrors = signal<Record<string, string>>({});
  mapOpen = signal(false);
  private originalForm = '';
  returnUrl = '';
  form: Address = { id: '', label: '', name: '', line: '', phone: '' };

  constructor(
    public state: AppStateService,
    private route: ActivatedRoute,
    public auth: AuthService,
    private ui: UiService,
    private router: Router
  ) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const destination = params.get('returnUrl') || '';
      this.returnUrl =
        destination.startsWith('/') && !destination.startsWith('//')
          ? destination
          : '';
      if (params.get('add') === '1') this.openModal();
    });
    effect(() => {
      const signedIn = this.auth.isLoggedIn();
      untracked(() => {
        if (signedIn) this.state.loadAddresses();
        else {
          this.showModal.set(false);
          this.saving.set(false);
          this.editing.set(null);
          this.mapOpen.set(false);
          this.formError.set('');
          this.fieldErrors.set({});
          this.form = { id: '', label: '', name: '', line: '', phone: '' };
          this.originalForm = '';
        }
      });
    });
  }

  private draftSignature(): string {
    return JSON.stringify({
      label: this.form.label || '',
      name: this.form.name || '',
      line: this.form.line || '',
      phone: this.form.phone || '',
      city: this.form.city || '',
      state: this.form.state || '',
      pincode: this.form.pincode || '',
      latitude: this.form.latitude ?? null,
      longitude: this.form.longitude ?? null,
      isDefault: !!this.form.isDefault,
    });
  }

  openModal(): void {
    this.editing.set(null);
    this.formError.set('');
    this.fieldErrors.set({});
    this.form = {
      id: '',
      label: 'Home',
      name: '',
      line: '',
      phone: '',
      isDefault: this.state.addresses().length === 0,
    };
    this.originalForm = this.draftSignature();
    this.mapOpen.set(false);
    this.showModal.set(true);
  }

  edit(address: Address): void {
    this.editing.set(address.id);
    this.formError.set('');
    this.fieldErrors.set({});
    this.form = { ...address };
    this.originalForm = this.draftSignature();
    this.mapOpen.set(false);
    this.showModal.set(true);
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
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
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }
    this.formError.set('');
    this.saving.set(true);
    const callbacks = {
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        if (this.returnUrl) this.router.navigateByUrl(this.returnUrl);
      },
      error: (error: any) => {
        this.saving.set(false);
        this.applyBackendErrors(error);
      },
    };
    if (this.editing()) this.state.updateAddress(this.form, callbacks);
    else this.state.createAddress(this.form, callbacks);
  }

  remove(id: string): void {
    const address = this.addresses().find((item) => item.id === id);
    this.ui
      .confirm({
        title: 'Remove this saved address?',
        eyebrow:'Address change',
        notice:'Deleting a saved address does not rewrite an existing order address.',
        confirmIcon:'trash',
        message: `${
          address?.label || 'This address'
        } will be removed from your saved addresses.`,
        confirmText: 'Delete address',
        cancelText: 'Keep address',
        tone: 'danger',
      })
      .then((yes) => {
        if (yes) this.state.deleteAddress(id);
      });
  }

  makeDefault(id: string, event?: Event): void {
    this.state.setDefaultAddress(id, event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined);
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (!(this.saving() || (this.showModal() && this.draftSignature() !== this.originalForm))) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async canLeave(): Promise<boolean> {
    if (this.saving()) return false;
    if (!this.showModal() || this.draftSignature() === this.originalForm)
      return true;
    return this.ui.confirmDiscardDraft();
  }

  closeModal(): void {
    if (this.saving()) return;
    if (this.draftSignature() !== this.originalForm) {
      this.ui.confirmDiscardDraft()
        .then((yes) => {
          if (yes) this.showModal.set(false);
        });
      return;
    }
    this.showModal.set(false);
  }

  choose(address: Address): void {
    this.state.selectAddress(address.id);
    if (this.returnUrl) this.router.navigateByUrl(this.returnUrl);
  }

  useDeliveryArea(): void {
    const location = this.state.customerLocationQuery();
    if (location['lat'] == null || location['lng'] == null) return;
    this.form.latitude = Number(location['lat']);
    this.form.longitude = Number(location['lng']);
    this.clearFieldError('latitude');
    this.clearFieldError('longitude');
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

  blockInvalidNumberKey(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();
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

    for (const [field, limit] of [
      ['latitude', 90],
      ['longitude', 180],
    ] as const) {
      const value = this.form[field];
      if (
        value != null &&
        String(value).trim() !== '' &&
        (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit)
      )
        errors[field] = `Enter a coordinate between -${limit} and ${limit}.`;
    }
    return errors;
  }

  private applyBackendErrors(error: any): void {
    const parsed = parseFormErrors(error?.error || error, {
      full_name: 'name',
      address_line1: 'line',
      postal_code: 'pincode',
      postalCode: 'pincode',
      zip_code: 'pincode',
      receiver_phone: 'phone',
      recipient_phone: 'phone',
      receiver_name: 'name',
      recipient_name: 'name',
      address: 'line',
      address_line: 'line',
      line1: 'line',
    });
    this.fieldErrors.set(parsed.fieldErrors);
    this.formError.set(
      formatFormErrors(
        error?.error || error,
        'Could not save address. Please check the highlighted fields.'
      )
    );
  }
}
