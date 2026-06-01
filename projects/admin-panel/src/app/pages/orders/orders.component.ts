import {
  Component,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  AuthService,
  decodeGooglePolyline,
  GoogleMapsService,
  openAuthenticatedWebSocket,
  Order,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

// Google Maps loaded via <script> tag in index.html â€” no @types/google.maps needed
declare const google: any;

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private googleMaps = inject(GoogleMapsService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  statusFilter = '';
  search = '';
  updatingId = signal<string | null>(null);

  tableColumns = [
    { key: 'order_number', label: 'Order #', flex: '1fr' },
    { key: 'customer_name', label: 'Customer', flex: '1.5fr' },
    { key: 'vendor_name', label: 'Vendor', flex: '1.5fr' },
    { key: 'total', label: 'Total', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'date', label: 'Date', flex: '1fr' },
    { key: 'actions', label: 'Update Status', flex: '1.5fr' },
  ];

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);

  showModal = signal(false);
  selectedOrder = signal<any>(null);
  loadingDetails = signal(false);

  // Live tracking
  showTrackingMap = signal(false);

  private gmMap: any;
  private gmDriverMarker: any;
  private gmVendorMarker: any;
  private gmCustomerMarker: any;
  private gmRoutePolyline: any;
  private driverPos?: { lat: number; lng: number };
  private vendorPos?: { lat: number; lng: number };
  private customerPos?: { lat: number; lng: number };
  private lastDirectionsTime = 0;
  private directionsEnabled = true;

  private ws: WebSocket | null = null;
  private animFrameId?: number;
  private timer: any;
  readonly statuses = [
    'placed',
    'confirmed',
    'preparing',
    'ready',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
  ];

  /** Admin can cancel any order that hasn't been delivered yet. */
  getAvailableStatuses(order: Order): string[] {
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return [order.status]; // terminal â€” no transitions
    }
    return this.statuses.filter(
      (s) => s !== 'cancelled' || order.status !== 'delivered',
    );
  }
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal() && !this.updatingId()) {
        this.load();
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.closeWs();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.gmRoutePolyline?.setMap(null);
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.search) params.search = this.search;
    this.api.getAdminOrders(params).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }
  setPage(p: number) {
    this.page.set(p);
    this.load();
  }

  updateStatus(order: Order, newStatus: string) {
    if (order.status === newStatus) return;
    this.updatingId.set(order.id);
    this.api.updateAdminOrderStatus(order.id, newStatus).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
      },
      error: () => this.updatingId.set(null),
    });
  }

  viewDetails(o: any) {
    this.loadingDetails.set(true);
    this.showModal.set(true);
    this.selectedOrder.set(o);
    this.closeTrackingMap();
    this.api.getAdminOrder(o.id).subscribe({
      next: (fullOrder) => {
        this.selectedOrder.set(fullOrder);
        this.loadingDetails.set(false);
      },
      error: () => this.loadingDetails.set(false),
    });
  }

  canTrackOrder(): boolean {
    const s = this.selectedOrder()?.status;
    return s === 'ready' || s === 'picked_up' || s === 'on_the_way';
  }

  openTrackingMap() {
    if (!this.canTrackOrder()) return;
    this.showTrackingMap.set(true);
    const o = this.selectedOrder();

    const vLat = parseFloat(o?.vendor_info?.latitude);
    const vLng = parseFloat(o?.vendor_info?.longitude);
    if (!isNaN(vLat) && !isNaN(vLng)) {
      this.vendorPos = { lat: vLat, lng: vLng };
    }

    const cLat = parseFloat(o?.delivery_latitude);
    const cLng = parseFloat(o?.delivery_longitude);
    if (!isNaN(cLat) && !isNaN(cLng)) {
      this.customerPos = { lat: cLat, lng: cLng };
    }

    this.connectWebSocket(o.id);
    this.googleMaps
      .loadJavaScriptApi()
      .then(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => this.initNativeMap()),
        ),
      )
      .catch(() =>
        console.warn(
          '[Map] Google Maps JavaScript API is not configured or unavailable.',
        ),
      );
  }

  closeTrackingMap() {
    this.showTrackingMap.set(false);
    this.closeWs();
    this.destroyMap();
  }

  private initNativeMap() {
    const el = document.getElementById('admin-tracking-map');
    if (!el) return;
    const center = this.vendorPos ?? { lat: 12.9716, lng: 77.5946 };
    this.gmMap = new google.maps.Map(el, {
      center,
      zoom: 13,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      clickableIcons: false,
    });
    if (this.vendorPos) {
      this.gmVendorMarker = new google.maps.Marker({
        position: this.vendorPos,
        map: this.gmMap,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png',
          scaledSize: new google.maps.Size(30, 30),
        },
        title: 'Vendor',
        zIndex: 5,
      });
    }
    if (this.customerPos) {
      this.gmCustomerMarker = new google.maps.Marker({
        position: this.customerPos,
        map: this.gmMap,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png',
          scaledSize: new google.maps.Size(30, 30),
        },
        title: 'Customer',
        zIndex: 5,
      });
    }
    // Fit bounds to known points
    const pts = [this.vendorPos, this.customerPos].filter(Boolean);
    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p: any) => bounds.extend(p));
      this.gmMap.fitBounds(bounds, 40);
    }
    this.gmRoutePolyline?.setMap(null);
    this.lastDirectionsTime = 0;
    this.requestDirections();
  }

  private requestDirections() {
    if (!this.directionsEnabled) return;
    if (!this.gmMap) return;
    const origin = this.driverPos ?? this.vendorPos;
    const destination = this.customerPos;
    if (!origin || !destination) return;
    const now = Date.now();
    if (now - this.lastDirectionsTime < 20000) return;
    this.lastDirectionsTime = now;
    this.googleMaps
      .computeRoute(origin, destination)
      .then((route) => {
        this.zone.run(() => {
          if (!route || !this.gmMap) return;
          this.gmRoutePolyline?.setMap(null);
          this.gmRoutePolyline = new google.maps.Polyline({
            path: decodeGooglePolyline(route.encodedPolyline),
            map: this.gmMap,
            strokeColor: '#38268E',
            strokeWeight: 4,
            strokeOpacity: 0.85,
          });
        });
      })
      .catch((error) => {
        this.directionsEnabled = false;
        console.warn('[Map] Routes API not available. Markers only.', error);
      });
  }

  private connectWebSocket(orderId: string) {
    this.closeWs();
    this.ws = openAuthenticatedWebSocket(
      `/sa/ws/delivery/${orderId}/tracking/`,
      this.auth.getToken(),
    );
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'location_update' && data.lat && data.lng) {
        const target = { lat: data.lat as number, lng: data.lng as number };
        this.zone.run(() => {
          if (this.driverPos && this.gmMap) {
            this.animateMarker(this.driverPos, target);
          } else {
            this.driverPos = target;
            if (this.gmMap) {
              this.gmDriverMarker = new google.maps.Marker({
                position: target,
                map: this.gmMap,
                icon: {
                  url: 'https://maps.google.com/mapfiles/ms/micons/motorcycling.png',
                  scaledSize: new google.maps.Size(36, 36),
                  anchor: new google.maps.Point(18, 18),
                },
                title: 'Delivery Partner',
                zIndex: 10,
              });
              this.lastDirectionsTime = 0;
              this.requestDirections();
            }
          }
        });
      }
    };
  }

  private animateMarker(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ) {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const startTime = performance.now();
    const duration = 1500;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const pos = {
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      };
      this.zone.run(() => {
        this.driverPos = pos;
        this.gmDriverMarker?.setPosition(pos);
      });
      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.zone.run(() => {
          this.driverPos = to;
          this.gmDriverMarker?.setPosition(to);
          this.requestDirections();
        });
      }
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  private destroyMap() {
    this.gmRoutePolyline?.setMap(null);
    this.gmDriverMarker?.setMap(null);
    this.gmVendorMarker?.setMap(null);
    this.gmCustomerMarker?.setMap(null);
    this.gmMap = undefined;
    this.gmDriverMarker = undefined;
    this.gmVendorMarker = undefined;
    this.gmCustomerMarker = undefined;
    this.gmRoutePolyline = undefined;
    this.driverPos = undefined;
    this.vendorPos = undefined;
    this.customerPos = undefined;
  }

  private closeWs() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
    this.closeTrackingMap();
  }
}

