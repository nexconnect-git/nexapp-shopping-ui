import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  AlertService,
  AppCurrencyPipe,
  AuthService,
  DeliveryDashboard,
  NativePlatformService,
  type NativeWatchId,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';
import { DeliveryWorkflowFacade } from '../../services/delivery-workflow.facade';
import { DriverLocationService } from '../../services/driver-location.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private workflow = inject(DeliveryWorkflowFacade);
  private alerts = inject(AlertService);
  private nativePlatform = inject(NativePlatformService);
  private driverLocation = inject(DriverLocationService);

  stats = signal<DeliveryDashboard | null>(null);
  loading = signal(true);
  isAvailable = signal(false);
  availabilityUpdating = signal(false);
  locationStatus = signal<'idle' | 'watching' | 'denied' | 'error'>('idle');

  private dashSub?: Subscription;
  private locationWatchId: NativeWatchId | null = null;
  private locationIntervalId: ReturnType<typeof setInterval> | null = null;
  private locationRetryId: ReturnType<typeof setTimeout> | null = null;
  private lastLocationPushAt = 0;
  private locationRetryDelayMs = 5000;
  private initialized = false;
  private locationAuthBlocked = false;
  private locationAuthErrorShown = false;
  private locationTrackingStarting = false;

  ngOnInit() {
    if (this.auth.getRole() !== 'delivery') {
      this.loading.set(false);
      return;
    }

    this.dashSub = timer(0, 10000).subscribe(() => {
      if (document.hidden) return;
      this.workflow.loadDashboard().subscribe({
        next: (d: DeliveryDashboard) => {
          this.stats.set(d);
          this.loading.set(false);

          // On first load sync toggle with server; don't override user's manual toggle later
          if (!this.initialized) {
            this.initialized = true;
            const serverOnline =
              d.partner_status === 'available' ||
              d.partner_status === 'on_delivery';
            this.isAvailable.set(serverOnline);
            if (serverOnline) {
              void this._startLocationTracking();
            }
          }
        },
        error: () => this.loading.set(false),
      });
    });
  }

  ngOnDestroy() {
    this.dashSub?.unsubscribe();
    this._stopLocationTracking();
  }

  toggleAvailability() {
    if (this.auth.getRole() !== 'delivery') {
      this.alerts.error('Location and availability are only for delivery accounts.');
      return;
    }
    if (this.availabilityUpdating()) return;
    if (this.stats()?.is_approved === false) {
      this.alerts.error('Your delivery account must be approved before going online.');
      return;
    }
    const goOnline = !this.isAvailable();
    this.isAvailable.set(goOnline);
    this.availabilityUpdating.set(true);

    this.workflow.setAvailability(goOnline).subscribe({
      next: () => {
        this.availabilityUpdating.set(false);
        this.alerts.success(
          goOnline
            ? 'You are online and receiving delivery requests.'
            : 'You are offline and paused from new requests.',
        );
      },
      error: () => {
        // Revert on failure
        this.isAvailable.set(!goOnline);
        this.availabilityUpdating.set(false);
        this.alerts.error('Could not update availability. Please retry.');
      },
    });

    if (goOnline) {
      void this._startLocationTracking();
    } else {
      this._stopLocationTracking();
    }
  }

  private async _startLocationTracking() {
    if (
      this.auth.getRole() !== 'delivery' ||
      this.locationAuthBlocked ||
      this.locationTrackingStarting ||
      this.locationStatus() === 'watching'
    ) {
      return;
    }

    this.locationTrackingStarting = true;

    try {
      const hasPermission = await this.nativePlatform.requestLocationPermissions();
      if (!hasPermission) {
        this.locationStatus.set('denied');
        return;
      }
    } catch {
      this.locationStatus.set('error');
      return;
    } finally {
      this.locationTrackingStarting = false;
    }

    this.locationStatus.set('watching');

    void this._sendCurrentLocation();
    this.locationIntervalId = setInterval(
      () => void this._sendCurrentLocation(),
      15000,
    );

    try {
      this.locationWatchId = await this.nativePlatform.watchPosition(
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        (pos) => this._pushLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => this.locationStatus.set(this._locationErrorStatus(err)),
      );
    } catch {
      this.locationStatus.set('error');
    }
  }

  private _stopLocationTracking() {
    if (this.locationWatchId !== null) {
      void this.nativePlatform.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    if (this.locationIntervalId !== null) {
      clearInterval(this.locationIntervalId);
      this.locationIntervalId = null;
    }
    if (this.locationRetryId !== null) {
      clearTimeout(this.locationRetryId);
      this.locationRetryId = null;
    }
    this.locationStatus.set('idle');
  }

  private async _sendCurrentLocation() {
    if (!this._shouldSendLocation()) {
      return;
    }

    try {
      const pos = await this.nativePlatform.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      this._pushLocation(pos.coords.latitude, pos.coords.longitude);
    } catch (err) {
      this.locationStatus.set(this._locationErrorStatus(err));
    }
  }

  private _pushLocation(lat: number, lng: number) {
    if (!this._shouldSendLocation()) {
      return;
    }
    const now = Date.now();
    if (now - this.lastLocationPushAt < 15000) {
      return;
    }
    this.lastLocationPushAt = now;
    this.driverLocation
      .updateBackend(lat, lng, this._activeTrackingOrderId())
      .subscribe({
      next: () => {
        this.locationStatus.set('watching');
        this.locationRetryDelayMs = 5000;
      },
      error: (error: unknown) => {
        const httpError = error as HttpErrorResponse;
        if (httpError.status === 401 || httpError.status === 403) {
          this.locationAuthBlocked = true;
          this.isAvailable.set(false);
          this._stopLocationTracking();
          if (!this.locationAuthErrorShown) {
            this.locationAuthErrorShown = true;
            this.alerts.info(
              'Live location updates are unavailable for this account.',
            );
          }
          return;
        }
        this.locationStatus.set(navigator.onLine ? 'error' : 'idle');
        this._scheduleLocationRetry();
      },
    });
  }

  private _shouldSendLocation() {
    const status = this.stats()?.partner_status;
    return (
      this.isAvailable() &&
      navigator.onLine &&
      (status === 'available' || status === 'on_delivery')
    );
  }

  private _activeTrackingOrderId(): string | undefined {
    return this.stats()?.active_orders?.find((order) =>
      ['ready', 'picked_up', 'on_the_way'].includes(order.status),
    )?.id;
  }

  private _scheduleLocationRetry() {
    if (this.locationRetryId || !this.isAvailable() || this.locationAuthBlocked) {
      return;
    }
    this.locationRetryId = setTimeout(() => {
      this.locationRetryId = null;
      void this._sendCurrentLocation();
      this.locationRetryDelayMs = Math.min(this.locationRetryDelayMs * 2, 60000);
    }, this.locationRetryDelayMs);
  }

  private _locationErrorStatus(error: unknown): 'denied' | 'error' {
    const maybePositionError = error as GeolocationPositionError;
    return maybePositionError?.code === maybePositionError?.PERMISSION_DENIED
      ? 'denied'
      : 'error';
  }
}
