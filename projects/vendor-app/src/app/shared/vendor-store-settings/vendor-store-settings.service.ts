import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  apiErrorMessage,
  AuthService,
  CurrencyService,
  MapLocation,
  User,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
import { VendorStoreSettings } from './vendor-store-settings.models';

const EMPTY_SETTINGS: VendorStoreSettings = {
  storeName: '',
  description: '',
  phone: '',
  email: '',
  storeOpen: false,
  acceptingOrders: false,
  autoAcceptOrders: false,
  openingTime: '',
  closingTime: '',
  minimumOrder: 0,
  basePrepMinutes: 0,
  deliveryRadiusKm: 0,
  instantRadiusKm: 0,
  address: '',
  city: '',
  state: '',
  postalCode: '',
  latitude: null,
  longitude: null,
  packagingPreferences: '',
  cancellationRules: '',
};

@Injectable({ providedIn: 'root' })
export class VendorStoreSettingsService {
  private readonly api = inject(VendorWorkspaceApi);
  readonly store = inject(VendorContextService);
  private readonly auth = inject(AuthService);
  readonly loadError = signal('');
  readonly loaded = signal(false);
  readonly result = signal('');
  readonly mediaBusy = signal('');
  readonly mediaError = signal('');
  readonly account = signal<User | null>(null);
  readonly accountError = signal('');
  readonly accountBusy = signal(false);
  accountForm = { first_name: '', last_name: '', phone: '', email: '' };
  private generation = 0;
  private readonly currency = inject(CurrencyService);

  readonly settings = signal<VendorStoreSettings>({ ...EMPTY_SETTINGS });
  readonly savedSettings = signal<VendorStoreSettings>({ ...EMPTY_SETTINGS });
  readonly dirty = computed(() => this.loaded() && JSON.stringify(this.settings()) !== JSON.stringify(this.savedSettings()));
  discard(): void {
    if (this.saving()) return;
    this.settings.set({ ...this.savedSettings() });
    this.errors.set({});
    this.result.set('');
  }
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly toast = signal('');
  readonly errors = signal<Record<string, string>>({});

  async load(): Promise<void> {
    const generation = ++this.generation,
      session = this.auth.sessionVersion;
    this.loading.set(true);
    this.loaded.set(false);
    this.loadError.set('');
    this.errors.set({});

    try {
      const dto = await firstValueFrom(this.api.storeSettings());
      if (
        generation !== this.generation ||
        session !== this.auth.sessionVersion
      )
        return;
      const settings = this.fromApiDto(dto);
      this.settings.set(settings);
      this.savedSettings.set(settings);
      this.loaded.set(true);
      this.syncCurrentLocation(settings);
    } catch (failure) {
      this.loadError.set(
        apiErrorMessage(failure, 'Failed to load store settings.')
      );
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  patch(patch: Partial<VendorStoreSettings>): void {
    this.settings.update((current) => ({ ...current, ...patch }));
    this.errors.set({});
  }

  selectMapLocation(location: MapLocation): void {
    const patch: Partial<VendorStoreSettings> = {
      latitude: this.toNumber(location.lat),
      longitude: this.toNumber(location.lng),
      address: location.address || this.settings().address,
      city: location.city || this.settings().city,
      state: location.state || this.settings().state,
      postalCode: location.postal_code || this.settings().postalCode,
    };
    this.patch(patch);
    this.syncCurrentLocation(this.settings());
    this.showToast('Map location selected', 'success');
  }

  async useMyLocation(): Promise<void> {
    if (!navigator?.geolocation) {
      this.showToast(
        'Geolocation is unavailable. Enter coordinates or choose a location on the map.',
        'error'
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.patch({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        this.showToast('Current location captured', 'success');
      },
      () => {
        this.showToast(
          'Could not obtain your location. Check browser permissions or enter coordinates.',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async save(): Promise<boolean> {
    if (!this.loaded() || this.saving()) return false;
    this.result.set('');
    const session = this.auth.sessionVersion;
    const errors = this.validate(this.settings());
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.showToast('Fix store settings errors before saving.', 'error');
      return false;
    }

    this.saving.set(true);
    try {
      const dto = await firstValueFrom(
        this.api.saveStoreSettings(this.toApiPayload(this.settings()))
      );
      if (session !== this.auth.sessionVersion) return false;
      const settings = this.fromApiDto(dto);
      this.settings.set(settings);
      this.savedSettings.set(settings);
      this.store.refresh();
      this.syncCurrentLocation(settings);
      this.showToast('Store settings saved.', 'success');
      return true;
    } catch (err: unknown) {
      const body = (err as { error?: unknown })?.error;
      const mapped = this.mapBackendErrors(body);
      this.errors.set({ ...this.errors(), ...mapped });
      const message = Object.keys(mapped).length
        ? 'Please fix the highlighted store settings fields.'
        : this.formatSaveError(body) || 'Failed to save store settings.';
      this.showToast(message, 'error');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  fieldError(field: keyof VendorStoreSettings): string {
    return this.errors()[field] || '';
  }

  private fromApiDto(dto: Record<string, unknown>): VendorStoreSettings {
    return {
      storeName: this.toString(dto['store_name']),
      description: this.toString(dto['description']),
      phone: this.toString(dto['phone']),
      email: this.toString(dto['email']),
      storeOpen: this.toBool(dto['is_open']),
      acceptingOrders: this.toBool(dto['is_accepting_orders']),
      autoAcceptOrders: this.toBool(dto['auto_order_acceptance']),
      openingTime: this.toString(dto['opening_time']),
      closingTime: this.toString(dto['closing_time']),
      minimumOrder: this.toNumber(dto['min_order_amount']),
      basePrepMinutes: this.toNumber(dto['base_prep_time_min']),
      deliveryRadiusKm: this.toNumber(dto['delivery_radius_km']),
      instantRadiusKm: this.toNumber(dto['instant_delivery_radius_km']),
      address: this.toString(dto['address']),
      city: this.toString(dto['city']),
      state: this.toString(dto['state']),
      postalCode: this.toString(dto['postal_code']),
      latitude:
        dto['latitude'] === null ||
        dto['latitude'] === undefined ||
        dto['latitude'] === ''
          ? null
          : this.toNumber(dto['latitude']),
      longitude:
        dto['longitude'] === null ||
        dto['longitude'] === undefined ||
        dto['longitude'] === ''
          ? null
          : this.toNumber(dto['longitude']),
      packagingPreferences: this.toString(dto['packaging_preferences']),
      cancellationRules: this.toString(dto['cancellation_rules']),
    };
  }

  private toApiPayload(settings: VendorStoreSettings): Record<string, unknown> {
    return {
      store_name: settings.storeName,
      description: settings.description,
      phone: settings.phone,
      email: settings.email,
      auto_order_acceptance: settings.autoAcceptOrders,
      opening_time: settings.openingTime,
      closing_time: settings.closingTime,
      min_order_amount: settings.minimumOrder,
      base_prep_time_min: settings.basePrepMinutes,
      delivery_radius_km: settings.deliveryRadiusKm,
      instant_delivery_radius_km: settings.instantRadiusKm,
      address: settings.address,
      city: settings.city,
      state: settings.state,
      postal_code: settings.postalCode,
      latitude: settings.latitude,
      longitude: settings.longitude,
      packaging_preferences: settings.packagingPreferences,
      cancellation_rules: settings.cancellationRules,
    };
  }

  private validate(settings: VendorStoreSettings): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!settings.storeName.trim())
      errors['storeName'] = 'Store name is required.';
    if (!settings.phone.trim()) errors['phone'] = 'Phone is required.';
    if (
      settings.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email.trim())
    ) {
      errors['email'] = 'Enter a valid email address.';
    }
    if (
      settings.phone &&
      !/^\+?[0-9][0-9\s-]{8,18}$/.test(settings.phone.trim())
    ) {
      errors['phone'] = 'Enter a valid phone number.';
    }
    if (!settings.address.trim())
      errors['address'] = 'Enter the pickup street address.';
    if (!settings.city.trim()) errors['city'] = 'Enter the pickup city.';
    if (!settings.state.trim()) errors['state'] = 'Enter the pickup state.';
    if (!settings.postalCode.trim())
      errors['postalCode'] = 'Enter the pickup postal code.';
    if (
      settings.latitude === null ||
      !Number.isFinite(settings.latitude) ||
      Math.abs(settings.latitude) > 90
    )
      errors['latitude'] =
        'Pick the store location on the map or enter latitude.';
    if (
      settings.longitude === null ||
      !Number.isFinite(settings.longitude) ||
      Math.abs(settings.longitude) > 180
    )
      errors['longitude'] =
        'Pick the store location on the map or enter longitude.';
    for (const field of [
      'minimumOrder',
      'basePrepMinutes',
      'deliveryRadiusKm',
      'instantRadiusKm',
    ] as const) {
      if (
        !Number.isFinite(Number(settings[field])) ||
        Number(settings[field]) < 0
      )
        errors[field] = 'Value cannot be negative.';
    }
    if (!Number.isInteger(settings.basePrepMinutes))
      errors['basePrepMinutes'] = 'Use whole minutes.';
    if (!settings.openingTime || !settings.closingTime)
      errors['openingTime'] = 'Set both opening and closing times.';
    if (settings.instantRadiusKm > settings.deliveryRadiusKm)
      errors['instantRadiusKm'] =
        'Instant radius cannot exceed the delivery radius.';
    return errors;
  }

  private syncCurrentLocation(settings: VendorStoreSettings): void {
    this.currency.configureFromLocation({
      latitude: settings.latitude,
      longitude: settings.longitude,
      address: settings.address,
      city: settings.city,
      state: settings.state,
      postalCode: settings.postalCode,
      name: settings.storeName,
    });
  }

  private formatSaveError(error: unknown): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return Object.entries(error)
      .map(([field, messages]) => {
        const text = Array.isArray(messages)
          ? messages.join(' ')
          : String(messages);
        return `${this.fieldLabel(field)}: ${text}`;
      })
      .join(' ');
  }

  private mapBackendErrors(error: unknown): Record<string, string> {
    if (!error || typeof error !== 'object') return {};
    const mapped: Record<string, string> = {};
    Object.entries(error).forEach(([field, messages]) => {
      const key = this.apiFieldMap[field] || field;
      const text = Array.isArray(messages)
        ? messages.join(' ')
        : String(messages);
      mapped[key] = this.friendlyFieldMessage(field, text);
    });
    return mapped;
  }

  private friendlyFieldMessage(field: string, fallback: string): string {
    const messages: Record<string, string> = {
      address: 'Enter the pickup street address.',
      city: 'Enter the pickup city.',
      state: 'Enter the pickup state.',
      postal_code: 'Enter the pickup postal code.',
      latitude: 'Pick the store location on the map or enter latitude.',
      longitude: 'Pick the store location on the map or enter longitude.',
      store_name: 'Store name is required.',
      description: 'Description is required.',
      phone: 'Enter a valid business phone number.',
      email: 'Enter a valid business email address.',
    };
    return messages[field] || fallback;
  }

  private fieldLabel(field: string): string {
    return this.apiFieldMap[field] || field.replace(/_/g, ' ');
  }

  private readonly apiFieldMap: Record<string, keyof VendorStoreSettings> = {
    store_name: 'storeName',
    description: 'description',
    is_open: 'storeOpen',
    is_accepting_orders: 'acceptingOrders',
    auto_order_acceptance: 'autoAcceptOrders',
    opening_time: 'openingTime',
    closing_time: 'closingTime',
    min_order_amount: 'minimumOrder',
    base_prep_time_min: 'basePrepMinutes',
    delivery_radius_km: 'deliveryRadiusKm',
    instant_delivery_radius_km: 'instantRadiusKm',
    postal_code: 'postalCode',
    packaging_preferences: 'packagingPreferences',
    cancellation_rules: 'cancellationRules',
  };

  private showToast(
    message: string,
    _type: 'success' | 'error' = 'success'
  ): void {
    this.toast.set(message);
    this.result.set(message);
  }

  private toString(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  private toBool(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  async loadAccount(): Promise<void> {
    this.accountError.set('');
    try {
      const user = await firstValueFrom(this.api.account());
      this.account.set(user);
      this.accountForm = {
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
      };
    } catch (failure) {
      this.accountError.set(
        apiErrorMessage(failure, 'Account details could not be loaded.')
      );
    }
  }
  async saveAccount(): Promise<void> {
    if (this.accountBusy() || !this.account()) return;
    this.accountBusy.set(true);
    this.accountError.set('');
    try {
      const user = await firstValueFrom(this.api.saveAccount(this.accountForm));
      this.account.set(user);
      this.auth.updateUserData(user);
      this.accountForm = {
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
      };
      this.result.set('Account details saved.');
    } catch (failure) {
      this.accountError.set(
        apiErrorMessage(failure, 'Account details were not saved.')
      );
    } finally {
      this.accountBusy.set(false);
    }
  }
  async upload(event: Event, kind: 'logo' | 'banner'): Promise<void> {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file || this.mediaBusy()) return;
    this.mediaError.set('');
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      this.mediaError.set('Choose a PNG, JPEG or WebP image up to 5 MB.');
      input.value = '';
      return;
    }
    this.mediaBusy.set(kind);
    try {
      await firstValueFrom(this.api.uploadStoreImage(file, kind));
      this.store.refresh();
      this.result.set(`${kind === 'logo' ? 'Logo' : 'Banner'} saved.`);
    } catch (failure) {
      this.mediaError.set(apiErrorMessage(failure, 'Image was not saved.'));
    } finally {
      this.mediaBusy.set('');
      input.value = '';
    }
  }
  accountDirty(): boolean {
    const user = this.account();
    return (
      !!user &&
      Object.entries(this.accountForm).some(
        ([key, value]) => value !== user[key as keyof User]
      )
    );
  }
}
