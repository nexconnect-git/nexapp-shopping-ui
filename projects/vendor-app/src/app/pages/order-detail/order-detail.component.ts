import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  NgZone,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GoogleMapsModule } from '@angular/google-maps';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  AuthService,
  decodeGooglePolyline,
  GoogleMapsService,
  openAuthenticatedWebSocket,
  VendorOrderCommand,
} from '@shared/public-api';
import { finalize, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VendorOrdersStore } from '../../services/vendor-orders.store';
import { VendorOrderFacade } from '../../services/vendor-order.facade';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
function coordinate(value: unknown, bound: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= bound ? number : null;
}
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AppCurrencyPipe,
    GoogleMapsModule,
    WorkspaceDialogComponent,
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly maps = inject(GoogleMapsService);
  private readonly facade = inject(VendorOrderFacade);
  readonly store = inject(VendorOrdersStore);
  readonly id = signal('');
  readonly order = computed(() => this.store.records().get(this.id()) || null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly invoiceBusy = signal(false);
  readonly invoiceError = signal('');
  readonly otp = signal('');
  readonly validationError = signal('');
  readonly cancel = signal(false);
  readonly reason = signal('');
  readonly mapsReady = signal(false);
  readonly mapError = signal('');
  readonly trackingState = signal('Disconnected');
  readonly location = signal<google.maps.LatLngLiteral | null>(null);
  readonly locationTime = signal<number | null>(null);
  readonly eta = signal<number | null>(null);
  readonly pending = computed(() => this.store.pending().has(this.id()));
  readonly error = computed(
    () => this.store.errors().get(this.id()) || this.validationError()
  );
  readonly locationAge = computed(() =>
    this.locationTime() === null
      ? null
      : Math.max(
          0,
          Math.floor((this.store.clock() - this.locationTime()!) / 1000)
        )
  );
  readonly trackingEligible = computed(() => {
    const order = this.order();
    return (
      !!order?.delivery_partner &&
      ['ready', 'picked_up', 'on_the_way'].includes(order.status)
    );
  });
  readonly vendorPosition = computed(() =>
    this.position(
      this.order()?.vendor_info.latitude,
      this.order()?.vendor_info.longitude
    )
  );
  readonly customerPosition = computed(() =>
    this.position(
      this.order()?.delivery_latitude,
      this.order()?.delivery_longitude
    )
  );
  readonly center = computed(
    () => this.location() || this.vendorPosition() || this.customerPosition()
  );
  readonly mapOptions: google.maps.MapOptions = {
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
  };
  readonly driverMarker: google.maps.MarkerOptions = {
    title: 'Delivery partner',
  };
  readonly vendorMarker: google.maps.MarkerOptions = { title: 'Store' };
  readonly customerMarker: google.maps.MarkerOptions = {
    title: 'Delivery destination',
  };
  private socket: WebSocket | null = null;
  private retry?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private trackingGeneration = 0;
  private nativeMap?: google.maps.Map;
  private routeLine?: google.maps.Polyline;
  private routeRequested = 0;
  private alive = true;
  constructor() {
    const mapFailure = () =>
      this.zone.run(() => {
        this.mapsReady.set(false);
        this.mapError.set(
          'Map unavailable. Delivery status and tracking coordinates remain available below.'
        );
        this.routeLine?.setMap(null);
        this.nativeMap = undefined;
      });
    window.addEventListener('nexconnect:google-maps-auth-failure', mapFailure);
    this.destroy.onDestroy(() =>
      window.removeEventListener(
        'nexconnect:google-maps-auth-failure',
        mapFailure
      )
    );
    effect(() => {
      const id = this.id(),
        eligible = this.trackingEligible();
      this.disconnect();
      if (eligible && id) {
        this.connect(id);
        this.loadMap();
      } else {
        this.location.set(null);
        this.locationTime.set(null);
        this.eta.set(null);
      }
    });
    this.destroy.onDestroy(() => {
      this.alive = false;
      this.disconnect();
      this.routeLine?.setMap(null);
    });
  }
  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.id.set(params.get('id') || '');
        this.load();
      });
    timer(30000, 30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        const order = this.order();
        if (
          !document.hidden &&
          order &&
          !['delivered', 'cancelled'].includes(order.status)
        )
          this.load();
      });
  }
  private loadMap(): void {
    this.maps
      .loadJavaScriptApi()
      .then(() => {
        if (this.alive) this.zone.run(() => this.mapsReady.set(true));
      })
      .catch(() => {
        if (this.alive)
          this.mapError.set(
            'Map unavailable. Delivery status and tracking coordinates remain available below.'
          );
      });
  }
  load(): void {
    const id = this.id();
    this.loading.set(true);
    this.loadError.set('');
    this.store
      .fetch(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          if (id === this.id()) this.loading.set(false);
        },
        error: (failure) => {
          if (id === this.id()) {
            this.loading.set(false);
            this.loadError.set(
              apiErrorMessage(failure, 'Order details could not be loaded.')
            );
          }
        },
      });
  }
  can(action: VendorOrderCommand): boolean {
    const order = this.order();
    return !!order && this.store.can(order, action);
  }
  command(action: VendorOrderCommand, data: Record<string, string> = {}): void {
    this.validationError.set('');
    this.store
      .run(this.id(), action, data)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.otp.set('');
          this.cancel.set(false);
          this.reason.set('');
        },
        error: () => {
          /* Shared state displays the command failure and refreshes the order. */
        },
      });
  }
  verify(): void {
    if (!/^[0-9]{6}$/.test(this.otp().trim())) {
      this.validationError.set('Enter the six-digit pickup code.');
      return;
    }
    this.command('verify_pickup_otp', { otp: this.otp().trim() });
  }
  cancelOrder(): void {
    if (!this.reason().trim()) {
      this.validationError.set(
        'Provide a customer-facing cancellation reason.'
      );
      return;
    }
    this.command(this.can('reject') ? 'reject' : 'cancel_order', {
      reason: this.reason().trim(),
    });
  }
  downloadInvoice(): void {
    const order = this.order();
    if (!order || this.invoiceBusy()) return;
    this.invoiceBusy.set(true);
    this.invoiceError.set('');
    this.facade
      .downloadCustomerInvoice(order)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.invoiceBusy.set(false))
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob),
            link = document.createElement('a');
          link.href = url;
          link.download = `invoice-${order.order_number}.pdf`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (failure) =>
          this.invoiceError.set(
            apiErrorMessage(failure, 'Invoice download failed. Retry.')
          ),
      });
  }
  onMapReady(map: google.maps.Map): void {
    this.nativeMap = map;
    const points = [
      this.vendorPosition(),
      this.customerPosition(),
      this.location(),
    ].filter((point): point is google.maps.LatLngLiteral => point !== null);
    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 40);
    }
    this.requestRoute();
  }
  private position(
    lat: unknown,
    lng: unknown
  ): google.maps.LatLngLiteral | null {
    const latitude = coordinate(lat, 90),
      longitude = coordinate(lng, 180);
    return latitude === null || longitude === null
      ? null
      : { lat: latitude, lng: longitude };
  }
  private connect(id: string): void {
    const generation = this.trackingGeneration;
    this.trackingState.set(this.attempts ? 'Reconnecting' : 'Connecting');
    this.socket = openAuthenticatedWebSocket(
      `/ws/delivery/${id}/tracking/`,
      this.auth.getToken(),
      environment.apiBaseUrl
    );
    this.socket.onopen = () =>
      this.zone.run(() => {
        if (generation !== this.trackingGeneration) return;
        this.attempts = 0;
        this.trackingState.set('Connected · waiting for location');
        this.load();
      });
    this.socket.onmessage = (event) =>
      this.zone.run(() => {
        if (generation !== this.trackingGeneration) return;
        try {
          const data = JSON.parse(event.data) as {
            type?: string;
            lat?: unknown;
            lng?: unknown;
            eta_minutes?: number;
            timestamp?: string;
          };
          if (data.type === 'location_update') {
            const point = this.position(data.lat, data.lng);
            if (point) {
              const timestamp = data.timestamp ? Date.parse(data.timestamp) : null;
              const currentTime = this.locationTime();
              if (timestamp !== null && (!Number.isFinite(timestamp) || (currentTime !== null && timestamp <= currentTime))) return;
              this.location.set(point);
              this.locationTime.set(timestamp);
              this.trackingState.set('Connected');
              this.requestRoute();
            }
          } else if (
            data.type === 'eta_update' &&
            Number.isFinite(data.eta_minutes)
          )
            this.eta.set(data.eta_minutes!);
        } catch {
          this.trackingState.set('Connected · invalid tracking update');
        }
      });
    this.socket.onclose = () =>
      this.zone.run(() => {
        if (generation !== this.trackingGeneration || !this.alive) return;
        this.trackingState.set('Reconnecting · order status still refreshes');
        this.retry = setTimeout(
          () => this.connect(id),
          Math.min(30000, 1000 * 2 ** this.attempts++)
        );
      });
    this.socket.onerror = () =>
      this.zone.run(() => {
        if (generation === this.trackingGeneration)
          this.trackingState.set('Tracking unavailable · retrying');
      });
  }
  private disconnect(): void {
    this.trackingGeneration++;
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close();
    this.socket = null;
    this.routeLine?.setMap(null);
    this.routeLine = undefined;
    this.nativeMap = undefined;
    this.routeRequested = 0;
    this.trackingState.set('Disconnected');
  }
  private requestRoute(): void {
    const start = this.location() || this.vendorPosition(),
      end = this.customerPosition();
    if (
      !this.nativeMap ||
      !start ||
      !end ||
      Date.now() - this.routeRequested < 20000
    )
      return;
    this.routeRequested = Date.now();
    const generation=this.trackingGeneration;const map=this.nativeMap;
    this.maps
      .computeRoute(start, end)
      .then((route) => {
        if (!this.alive || !route || this.nativeMap!==map || generation!==this.trackingGeneration) return;
        this.zone.run(() => {
          this.routeLine?.setMap(null);
          this.routeLine = new google.maps.Polyline({
            path: decodeGooglePolyline(route.encodedPolyline),
            map: this.nativeMap,
            strokeColor: '#38268E',
            strokeWeight: 4,
          });
        });
      })
      .catch(() => {
        if (!this.alive || this.nativeMap !== map || generation !== this.trackingGeneration || !this.mapsReady()) return;
        this.mapError.set('Route guidance unavailable. Use the tracking coordinates below.');
      });
  }
}
