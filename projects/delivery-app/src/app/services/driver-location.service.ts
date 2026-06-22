import { inject, Injectable, signal } from '@angular/core';
import {
  AlertService,
  DeliveryApi,
  NativePlatformService,
  type NativeWatchId,
} from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class DriverLocationService {
  private readonly api = inject(DeliveryApi);
  private readonly nativePlatform = inject(NativePlatformService);
  private readonly alerts = inject(AlertService);

  readonly status = signal<'idle' | 'watching' | 'denied' | 'error'>('idle');

  private watchId?: NativeWatchId;

  async start(onLocation?: (lat: number, lng: number) => void): Promise<void> {
    try {
      const hasPermission = await this.nativePlatform.requestLocationPermissions();
      if (!hasPermission) {
        this.status.set('denied');
        return;
      }

      this.status.set('watching');
      this.watchId = await this.nativePlatform.watchPosition(
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          onLocation?.(lat, lng);
        },
        () => this.status.set('error'),
      );
    } catch {
      this.status.set('error');
      this.alerts.info('Location permission is required for live delivery tracking.');
    }
  }

  async stop(): Promise<void> {
    if (this.watchId !== undefined) {
      await this.nativePlatform.clearWatch(this.watchId);
      this.watchId = undefined;
    }
    this.status.set('idle');
  }

  updateBackend(lat: number, lng: number, orderId?: string) {
    return this.api.updateLocation(lat, lng, orderId);
  }
}
