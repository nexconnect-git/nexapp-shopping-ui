import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, AuthService, DeliveryDashboard } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);

  stats = signal<DeliveryDashboard | null>(null);
  loading = signal(true);
  isAvailable = signal(false);
  locationStatus = signal<'idle' | 'watching' | 'denied' | 'error'>('idle');

  private dashSub?: Subscription;
  private locationWatchId: number | null = null;
  private locationIntervalId: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  ngOnInit() {
    this.dashSub = timer(0, 10000).subscribe(() => {
      this.api.getDeliveryDashboard().subscribe({
        next: (d: DeliveryDashboard) => {
          this.stats.set(d);
          this.loading.set(false);

          // On first load sync toggle with server; don't override user's manual toggle later
          if (!this.initialized) {
            this.initialized = true;
            const serverOnline = d.partner_status === 'available' || d.partner_status === 'on_delivery';
            this.isAvailable.set(serverOnline);
            if (serverOnline) {
              this._startLocationTracking();
            }
          }
        },
        error: () => this.loading.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.dashSub?.unsubscribe();
    this._stopLocationTracking();
  }

  toggleAvailability() {
    const goOnline = !this.isAvailable();
    this.isAvailable.set(goOnline);

    this.api.setAvailability(goOnline).subscribe({
      error: () => {
        // Revert on failure
        this.isAvailable.set(!goOnline);
      }
    });

    if (goOnline) {
      this._startLocationTracking();
    } else {
      this._stopLocationTracking();
    }
  }

  private _startLocationTracking() {
    if (environment.production) {
      console.log('Live location tracking is disabled in production.');
      this.locationStatus.set('idle');
      return;
    }
    if (!navigator.geolocation) {
      this.locationStatus.set('error');
      return;
    }
    this.locationStatus.set('watching');

    // Send current position immediately, then every 15 seconds
    this._sendCurrentLocation();
    this.locationIntervalId = setInterval(() => this._sendCurrentLocation(), 15000);

    // Also watch for significant position changes (e.g. partner is driving)
    this.locationWatchId = navigator.geolocation.watchPosition(
      (pos) => this._pushLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        this.locationStatus.set(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
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
    this.locationStatus.set('idle');
  }

  private _sendCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => this._pushLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private _pushLocation(lat: number, lng: number) {
    this.api.updateLocation(lat, lng).subscribe();
  }
}
