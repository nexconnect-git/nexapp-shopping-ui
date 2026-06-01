import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  AlertService,
  ApiService,
  AppCurrencyPipe,
  AuthService,
  DeliveryDashboard,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  stats = signal<DeliveryDashboard | null>(null);
  loading = signal(true);
  isAvailable = signal(false);
  availabilityUpdating = signal(false);
  locationStatus = signal<'idle' | 'watching' | 'denied' | 'error'>('idle');

  private dashSub?: Subscription;
  private locationWatchId: number | null = null;
  private locationIntervalId: ReturnType<typeof setInterval> | null = null;
  private locationRetryId: ReturnType<typeof setTimeout> | null = null;
  private lastLocationPushAt = 0;
  private locationRetryDelayMs = 5000;
  private initialized = false;
  private locationAuthBlocked = false;
  private locationAuthErrorShown = false;

  ngOnInit() {
    if (this.auth.getRole() !== 'delivery') {
      this.loading.set(false);
      return;
    }

    this.dashSub = timer(0, 10000).subscribe(() => {
      if (document.hidden) return;
      this.api.getDeliveryDashboard().subscribe({
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
              this._startLocationTracking();
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
    const goOnline = !this.isAvailable();
    this.isAvailable.set(goOnline);
    this.availabilityUpdating.set(true);

    this.api.setAvailability(goOnline).subscribe({
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
      this._startLocationTracking();
    } else {
      this._stopLocationTracking();
    }
  }

  private _startLocationTracking() {
    if (this.auth.getRole() !== 'delivery' || this.locationAuthBlocked) {
      return;
    }
    if (!navigator.geolocation) {
      this.locationStatus.set('error');
      return;
    }
    this.locationStatus.set('watching');

    // Send current position immediately, then every 15 seconds
    this._sendCurrentLocation();
    this.locationIntervalId = setInterval(
      () => this._sendCurrentLocation(),
      15000,
    );

    // Also watch for significant position changes (e.g. partner is driving)
    this.locationWatchId = navigator.geolocation.watchPosition(
      (pos) => this._pushLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        this.locationStatus.set(
          err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  private _stopLocationTracking() {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
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

  private _sendCurrentLocation() {
    if (!this._shouldSendLocation()) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this._pushLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        this.locationStatus.set(
          err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
    this.api.updateLocation(lat, lng, this._activeTrackingOrderId()).subscribe({
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
      this._sendCurrentLocation();
      this.locationRetryDelayMs = Math.min(this.locationRetryDelayMs * 2, 60000);
    }, this.locationRetryDelayMs);
  }
}
