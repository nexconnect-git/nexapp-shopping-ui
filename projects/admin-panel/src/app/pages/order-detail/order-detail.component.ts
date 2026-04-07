import { Component, inject, signal, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

// Google Maps loaded via <script> tag in index.html
declare const google: any;

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private zone = inject(NgZone);

  order = signal<Order | null>(null);
  loading = signal(true);
  updating = signal(false);
  updateError = signal('');
  private orderId = '';
  private pollSub?: Subscription;

  // Status update
  readonly statuses = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];

  // Live tracking map
  showMap = signal(false);
  private gmMap: any;
  private gmDriverMarker: any;
  private gmVendorMarker: any;
  private gmCustomerMarker: any;
  private gmDirectionsService: any;
  private gmDirectionsRenderer: any;
  private driverPos?: {lat: number; lng: number};
  private vendorPos?: {lat: number; lng: number};
  private customerPos?: {lat: number; lng: number};
  private lastDirectionsTime = 0;
  private ws: WebSocket | null = null;
  private animFrameId?: number;

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('id')!;
    this.pollSub = timer(0, 10000).subscribe(() => this.loadOrder());
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.closeWs();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.gmDirectionsRenderer?.setMap(null);
  }

  loadOrder() {
    this.api.getAdminOrder(this.orderId).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
        this.extractPositions(o);
      },
      error: () => { this.loading.set(false); }
    });
  }

  updateStatus(newStatus: string) {
    if (!newStatus || newStatus === this.order()?.status) return;
    this.updating.set(true);
    this.updateError.set('');
    this.api.updateAdminOrderStatus(this.orderId, newStatus).subscribe({
      next: () => { this.updating.set(false); this.loadOrder(); },
      error: (err) => { this.updateError.set(err.error?.error || 'Failed to update status.'); this.updating.set(false); }
    });
  }

  canTrack(): boolean {
    const s = this.order()?.status;
    return s === 'ready' || s === 'picked_up' || s === 'on_the_way';
  }

  toggleMap() {
    if (this.showMap()) {
      this.showMap.set(false);
      this.closeWs();
      this.destroyMap();
    } else {
      this.showMap.set(true);
      this.connectWebSocket();
      requestAnimationFrame(() => requestAnimationFrame(() => this.initMap()));
    }
  }

  private extractPositions(o: Order) {
    if (o.vendor_info?.latitude && o.vendor_info?.longitude) {
      this.vendorPos = {lat: parseFloat(o.vendor_info.latitude as string), lng: parseFloat(o.vendor_info.longitude as string)};
    }
    if (o.delivery_latitude && o.delivery_longitude) {
      this.customerPos = {lat: o.delivery_latitude, lng: o.delivery_longitude};
    }
  }

  private initMap() {
    const el = document.getElementById('admin-order-map');
    if (!el) return;
    const center = this.vendorPos ?? {lat: 12.9716, lng: 77.5946};
    this.gmMap = new google.maps.Map(el, {
      center, zoom: 13, zoomControl: true,
      streetViewControl: false, fullscreenControl: false, mapTypeControl: false,
    });
    if (this.vendorPos) {
      this.gmVendorMarker = new google.maps.Marker({
        position: this.vendorPos, map: this.gmMap,
        icon: {url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png', scaledSize: new google.maps.Size(32, 32)},
        title: 'Vendor',
      });
    }
    if (this.customerPos) {
      this.gmCustomerMarker = new google.maps.Marker({
        position: this.customerPos, map: this.gmMap,
        icon: {url: 'https://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png', scaledSize: new google.maps.Size(32, 32)},
        title: 'Customer',
      });
    }
    const pts = [this.vendorPos, this.customerPos].filter(Boolean);
    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p: any) => bounds.extend(p));
      this.gmMap.fitBounds(bounds, 60);
    }
    this.gmDirectionsService = new google.maps.DirectionsService();
    this.gmDirectionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {strokeColor: '#06B6D4', strokeWeight: 4, strokeOpacity: 0.85},
    });
    this.gmDirectionsRenderer.setMap(this.gmMap);
    this.lastDirectionsTime = 0;
    this.requestDirections();
  }

  private requestDirections() {
    if (!this.gmDirectionsService || !this.gmDirectionsRenderer) return;
    const origin = this.driverPos ?? this.vendorPos;
    const destination = this.customerPos;
    if (!origin || !destination) return;
    const now = Date.now();
    if (now - this.lastDirectionsTime < 20000) return;
    this.lastDirectionsTime = now;
    this.gmDirectionsService.route(
      {origin, destination, travelMode: google.maps.TravelMode.DRIVING},
      (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK) {
          this.zone.run(() => this.gmDirectionsRenderer?.setDirections(result));
        }
      }
    );
  }

  private connectWebSocket() {
    this.closeWs();
    const token = localStorage.getItem('token') || '';
    const wsUrl = `ws://${window.location.host}/ws/delivery/${this.orderId}/tracking/?token=${token}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'location_update' && data.lat && data.lng) {
        const target = {lat: data.lat as number, lng: data.lng as number};
        this.zone.run(() => {
          if (this.driverPos && this.gmMap) {
            this.animateMarker(this.driverPos, target);
          } else {
            this.driverPos = target;
            if (this.gmMap) {
              this.gmDriverMarker = new google.maps.Marker({
                position: target, map: this.gmMap,
                icon: {url: 'https://maps.google.com/mapfiles/ms/micons/motorcycling.png', scaledSize: new google.maps.Size(38, 38), anchor: new google.maps.Point(19, 19)},
                title: 'Delivery Partner', zIndex: 10,
              });
              this.lastDirectionsTime = 0;
              this.requestDirections();
            }
          }
        });
      }
    };
  }

  private animateMarker(from: {lat: number; lng: number}, to: {lat: number; lng: number}) {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - startTime) / 1500, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const pos = {lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + (to.lng - from.lng) * ease};
      this.zone.run(() => { this.driverPos = pos; this.gmDriverMarker?.setPosition(pos); });
      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.zone.run(() => { this.driverPos = to; this.gmDriverMarker?.setPosition(to); this.requestDirections(); });
      }
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  private destroyMap() {
    this.gmDirectionsRenderer?.setMap(null);
    [this.gmDriverMarker, this.gmVendorMarker, this.gmCustomerMarker].forEach(m => m?.setMap(null));
    this.gmMap = this.gmDriverMarker = this.gmVendorMarker = this.gmCustomerMarker = undefined;
    this.gmDirectionsRenderer = this.gmDirectionsService = undefined;
    this.driverPos = undefined;
  }

  private closeWs() { if (this.ws) { this.ws.close(); this.ws = null; } }

  statusBadgeClass(s: string): string {
    const map: Record<string, string> = {
      placed: 'badge-placed', confirmed: 'badge-confirmed', preparing: 'badge-preparing',
      ready: 'badge-ready', picked_up: 'badge-picked_up', on_the_way: 'badge-on_the_way',
      delivered: 'badge-delivered', cancelled: 'badge-cancelled',
    };
    return 'badge ' + (map[s] || '');
  }
}
