import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiService,
  CurrencyService,
  MapLocation,
  ToastService,
} from '@shared/public-api';
import {
  StoreLocationSuggestion,
  StoreSettingsStatusCard,
  VendorStoreSettings,
} from './vendor-store-settings.models';

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
  latitude: 0,
  longitude: 0,
  packagingPreferences: '',
  cancellationRules: '',
};

@Injectable({ providedIn: 'root' })
export class VendorStoreSettingsService {
  private readonly api = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly currency = inject(CurrencyService);

  readonly settings = signal<VendorStoreSettings>({ ...EMPTY_SETTINGS });
  readonly savedSettings = signal<VendorStoreSettings>({ ...EMPTY_SETTINGS });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly toast = signal('');
  readonly errors = signal<Record<string, string>>({});

  readonly locationSuggestions: StoreLocationSuggestion[] = [
    {
      label: 'Current store location',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      latitude: 0,
      longitude: 0,
    },
  ];

  async load(): Promise<void> {
    this.loading.set(true);
    this.errors.set({});

    try {
      const dto = await firstValueFrom(this.api.getVendorStoreSettings());
      const settings = this.fromApiDto(dto);
      this.settings.set(settings);
      this.savedSettings.set(settings);
      this.syncCurrentLocation(settings);
    } catch {
      this.showToast('Failed to load store settings.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  getStatusCards(value: VendorStoreSettings): StoreSettingsStatusCard[] {
    return [
      {
        label: 'Store status',
        value: value.storeOpen ? 'Open' : 'Closed',
        caption: value.storeOpen
          ? 'Store is operating for the day.'
          : 'Store is closed for customers.',
        icon: '🏪',
        tone: 'purple',
      },
      {
        label: 'Order intake',
        value: value.acceptingOrders ? 'Accepting' : 'Paused',
        caption: value.acceptingOrders
          ? 'Taking new orders from customers.'
          : 'New orders are temporarily paused.',
        icon: '🧾',
        tone: 'green',
      },
      {
        label: 'Order approval',
        value: value.autoAcceptOrders ? 'Auto' : 'Manual',
        caption: value.autoAcceptOrders
          ? 'Orders auto-confirm after placement.'
          : 'Orders require manual review.',
        icon: '⚡',
        tone: 'orange',
      },
    ];
  }

  patch(patch: Partial<VendorStoreSettings>): void {
    this.settings.update((current) => ({ ...current, ...patch }));
    this.errors.set({});
  }

  selectLocation(location: StoreLocationSuggestion): void {
    this.patch({
      address: location.address,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    this.showToast('Location selected', 'success');
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
      this.selectLocation(this.locationSuggestions[0]);
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
        this.selectLocation(this.locationSuggestions[0]);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async save(): Promise<boolean> {
    const errors = this.validate(this.settings());
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.showToast('Fix store settings errors before saving.', 'error');
      return false;
    }

    this.saving.set(true);
    try {
      const dto = await firstValueFrom(
        this.api.updateVendorStoreSettings(this.toApiPayload(this.settings())),
      );
      const settings = this.fromApiDto(dto);
      this.settings.set(settings);
      this.savedSettings.set(settings);
      this.syncCurrentLocation(settings);
      this.showToast('Store settings saved.', 'success');
      return true;
    } catch (err: any) {
      const mapped = this.mapBackendErrors(err?.error);
      this.errors.set({ ...this.errors(), ...mapped });
      const message = Object.keys(mapped).length
        ? 'Please fix the highlighted store settings fields.'
        : this.formatSaveError(err?.error) || 'Failed to save store settings.';
      this.showToast(message, 'error');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  fieldError(field: keyof VendorStoreSettings): string {
    return this.errors()[field] || '';
  }

  private fromApiDto(dto: any): VendorStoreSettings {
    return {
      storeName: this.toString(dto?.store_name),
      description: this.toString(dto?.description),
      phone: this.toString(dto?.phone),
      email: this.toString(dto?.email),
      storeOpen: this.toBool(dto?.is_open),
      acceptingOrders: this.toBool(dto?.is_accepting_orders),
      autoAcceptOrders: this.toBool(dto?.auto_order_acceptance),
      openingTime: this.toString(dto?.opening_time),
      closingTime: this.toString(dto?.closing_time),
      minimumOrder: this.toNumber(dto?.min_order_amount),
      basePrepMinutes: this.toNumber(dto?.base_prep_time_min),
      deliveryRadiusKm: this.toNumber(dto?.delivery_radius_km),
      instantRadiusKm: this.toNumber(dto?.instant_delivery_radius_km),
      address: this.toString(dto?.address),
      city: this.toString(dto?.city),
      state: this.toString(dto?.state),
      postalCode: this.toString(dto?.postal_code),
      latitude: this.toNumber(dto?.latitude),
      longitude: this.toNumber(dto?.longitude),
      packagingPreferences: this.toString(dto?.packaging_preferences),
      cancellationRules: this.toString(dto?.cancellation_rules),
    };
  }

  private toApiPayload(settings: VendorStoreSettings): Record<string, unknown> {
    return {
      store_name: settings.storeName,
      description: settings.description,
      phone: settings.phone,
      email: settings.email,
      is_open: settings.storeOpen,
      is_accepting_orders: settings.acceptingOrders,
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
      latitude: settings.latitude || null,
      longitude: settings.longitude || null,
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
    if (
      settings.openingTime &&
      settings.closingTime &&
      settings.openingTime >= settings.closingTime
    ) {
      errors['closingTime'] = 'Closing time must be later than opening time.';
    }
    if (!settings.address.trim())
      errors['address'] = 'Enter the pickup street address.';
    if (!settings.city.trim()) errors['city'] = 'Enter the pickup city.';
    if (!settings.state.trim()) errors['state'] = 'Enter the pickup state.';
    if (!settings.postalCode.trim())
      errors['postalCode'] = 'Enter the pickup postal code.';
    if (!settings.latitude)
      errors['latitude'] =
        'Pick the store location on the map or enter latitude.';
    if (!settings.longitude)
      errors['longitude'] =
        'Pick the store location on the map or enter longitude.';
    for (const field of [
      'minimumOrder',
      'basePrepMinutes',
      'deliveryRadiusKm',
      'instantRadiusKm',
    ] as const) {
      if (Number(settings[field]) < 0)
        errors[field] = 'Value cannot be negative.';
    }
    return errors;
  }

  private syncCurrentLocation(settings: VendorStoreSettings): void {
    this.locationSuggestions[0] = {
      label: settings.address || 'Current store location',
      address: settings.address,
      city: settings.city,
      state: settings.state,
      postalCode: settings.postalCode,
      latitude: settings.latitude,
      longitude: settings.longitude,
    };
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

  private formatSaveError(error: any): string {
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

  private mapBackendErrors(error: any): Record<string, string> {
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
    type: 'success' | 'error' = 'success',
  ): void {
    this.toast.set(message);
    this.toastService.show(message, type);
    window.setTimeout(() => this.toast.set(''), 2200);
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
}
