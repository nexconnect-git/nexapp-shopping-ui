import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService, AppCurrencyPipe, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe, GoogleMapsModule],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);

  order = signal<Order | null>(null);
  loading = signal(true);
  private orderId = '';
  private pollSub?: Subscription;

  // OTP verification
  otpInput = signal('');
  otpError = signal('');
  verifying = signal(false);
  otpSuccess = signal(false);

  // Delivery search controls
  startingSearch = signal(false);
  cancellingSearch = signal(false);
  searchError = signal('');

  // Cancel modal
  showCancelModal = signal(false);
  cancelReason = '';
  cancelError = signal('');
  cancelling = signal(false);

  // Map state
  center: google.maps.LatLngLiteral = {lat: 12.9716, lng: 77.5946};
  zoom = 14;
  driverPosition?: google.maps.LatLngLiteral;
  vendorPosition?: google.maps.LatLngLiteral;
  customerPosition?: google.maps.LatLngLiteral;

  driverMarkerOptions: google.maps.MarkerOptions = {};
  vendorMarkerOptions: google.maps.MarkerOptions = {};
  customerMarkerOptions: google.maps.MarkerOptions = {};
  mapOptions: google.maps.MapOptions = {};

  private directionsService?: google.maps.DirectionsService;
  private directionsRenderer?: google.maps.DirectionsRenderer;
  private lastDirectionsTime = 0;
  private directionsEnabled = true;

  private ws: WebSocket | null = null;
  private animFrameId?: number;

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('id')!;
    this.loadOrder();
    this.pollSub = timer(10000, 10000).subscribe(() => {
      const s = this.order()?.status;
      if (s && !['delivered', 'cancelled'].includes(s)) this.loadOrder();
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.closeWs();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.directionsRenderer?.setMap(null);
  }

  ngAfterViewInit() {
    this.initMarkerOptions();
    this.connectWebSocket(this.route.snapshot.paramMap.get('id')!);
  }

  /** Called by (mapInitialized) on <google-map> when the map instance is ready. */
  onMapReady(nativeMap: google.maps.Map) {
    this.directionsRenderer?.setMap(null);
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {strokeColor: '#6C63FF', strokeWeight: 4, strokeOpacity: 0.8},
    });
    this.directionsRenderer.setMap(nativeMap);
    this.lastDirectionsTime = 0;

    const pts = [this.vendorPosition, this.driverPosition, this.customerPosition].filter(Boolean) as google.maps.LatLngLiteral[];
    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach(p => bounds.extend(p));
      nativeMap.fitBounds(bounds, 40);
    } else if (pts.length === 1) {
      nativeMap.setCenter(pts[0]);
    }
    this.requestDirections();
  }

  private initMarkerOptions() {
    this.mapOptions = {zoomControl: true, streetViewControl: false, fullscreenControl: false, mapTypeControl: false, clickableIcons: false};
    this.driverMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/micons/motorcycling.png', scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18)},
      zIndex: 10, title: 'Delivery Partner',
    };
    this.vendorMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png', scaledSize: new google.maps.Size(30, 30)},
      zIndex: 5, title: 'Your Store',
    };
    this.customerMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png', scaledSize: new google.maps.Size(30, 30)},
      zIndex: 5, title: 'Customer Location',
    };
  }

  private updateMapPositions(o: Order) {
    const vLat = parseFloat(o.vendor_info?.latitude as any);
    const vLng = parseFloat(o.vendor_info?.longitude as any);
    if (!isNaN(vLat) && !isNaN(vLng)) {
      this.vendorPosition = { lat: vLat, lng: vLng };
    }

    const cLat = parseFloat(o.delivery_latitude as any);
    const cLng = parseFloat(o.delivery_longitude as any);
    if (!isNaN(cLat) && !isNaN(cLng)) {
      this.customerPosition = { lat: cLat, lng: cLng };
    }

    if (this.vendorPosition) this.center = this.vendorPosition;
    this.requestDirections();
  }

  private requestDirections() {
    if (!this.directionsEnabled) return;
    if (!this.directionsService || !this.directionsRenderer) return;
    const origin = this.driverPosition ?? this.vendorPosition;
    const destination = this.customerPosition;
    if (!origin || !destination) return;
    const now = Date.now();
    if (now - this.lastDirectionsTime < 20000) return;
    this.lastDirectionsTime = now;
    this.directionsService.route(
      {origin, destination, travelMode: google.maps.TravelMode.DRIVING},
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          this.zone.run(() => this.directionsRenderer?.setDirections(result));
        } else if (status === 'REQUEST_DENIED' || status === 'NOT_FOUND') {
          this.directionsEnabled = false;
          console.warn('[Map] Directions API not available:', status, '— enable it in GCP Console. Markers only.');
        }
      }
    );
  }

  loadOrder() {
    this.api.getVendorOrder(this.orderId).subscribe({
      next: (o) => { this.order.set(o); this.loading.set(false); this.updateMapPositions(o); },
      error: () => this.loading.set(false)
    });
  }

  private connectWebSocket(orderId: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/sa/ws/delivery/${orderId}/tracking/?token=${this.auth.getToken()}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'location_update' && data.lat && data.lng) {
        const target: google.maps.LatLngLiteral = {lat: data.lat, lng: data.lng};
        this.zone.run(() => {
          if (this.driverPosition) {
            this.animateToPosition(this.driverPosition, target);
          } else {
            this.driverPosition = target;
            this.lastDirectionsTime = 0;
            this.requestDirections();
          }
        });
      }
    };
  }

  private animateToPosition(from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral) {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const startTime = performance.now();
    const duration = 1500;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.zone.run(() => {
        this.driverPosition = {
          lat: from.lat + (to.lat - from.lat) * ease,
          lng: from.lng + (to.lng - from.lng) * ease,
        };
      });
      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.zone.run(() => { this.driverPosition = to; this.requestDirections(); });
      }
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  private closeWs() { if (this.ws) { this.ws.close(); this.ws = null; } }

  showLiveMap(): boolean {
    const s = this.order()?.status;
    return ['ready', 'picked_up', 'on_the_way'].includes(s ?? '');
  }

  canUpdateStatus() {
    return ['placed', 'confirmed', 'preparing'].includes(this.order()?.status || '');
  }

  updateStatus(newStatus: string) {
    if (newStatus === 'cancelled') { this.cancelReason = ''; this.cancelError.set(''); this.showCancelModal.set(true); return; }
    this.api.updateOrderStatus(this.order()!.id, newStatus).subscribe({next: (o) => this.order.set(o)});
  }

  confirmCancel() {
    if (!this.cancelReason.trim()) { this.cancelError.set('Please provide a reason for cancellation.'); return; }
    this.cancelling.set(true);
    this.cancelError.set('');
    this.api.updateOrderStatus(this.order()!.id, 'cancelled', this.cancelReason.trim()).subscribe({
      next: (o) => { this.order.set(o); this.showCancelModal.set(false); this.cancelling.set(false); },
      error: (err) => { this.cancelError.set(err.error?.error || 'Failed to cancel order.'); this.cancelling.set(false); }
    });
  }

  closeCancelModal() {
    if (this.cancelling()) return;
    this.showCancelModal.set(false); this.cancelReason = ''; this.cancelError.set('');
  }

  startDeliverySearch() {
    this.startingSearch.set(true); this.searchError.set('');
    this.api.startDeliverySearch(this.order()!.id).subscribe({
      next: (o) => { this.order.set(o); this.startingSearch.set(false); },
      error: (err) => { this.searchError.set(err.error?.error || 'Failed to start search. Please try again.'); this.startingSearch.set(false); }
    });
  }

  cancelDeliverySearch() {
    this.cancellingSearch.set(true); this.searchError.set('');
    this.api.cancelDeliverySearch(this.order()!.id).subscribe({
      next: (o) => { this.order.set(o); this.cancellingSearch.set(false); },
      error: (err) => { this.searchError.set(err.error?.error || 'Failed to cancel search. Please try again.'); this.cancellingSearch.set(false); }
    });
  }

  verifyPickupOtp() {
    const otp = this.otpInput().trim();
    if (!otp) { this.otpError.set('Please enter the OTP.'); return; }
    this.verifying.set(true); this.otpError.set('');
    this.api.verifyPickupOtp(this.order()!.id, otp).subscribe({
      next: (o) => { this.order.set(o); this.verifying.set(false); this.otpSuccess.set(true); this.otpInput.set(''); },
      error: (err) => { this.verifying.set(false); this.otpError.set(err.error?.error || 'Invalid OTP.'); }
    });
  }

  downloadInvoice() {
    const o = this.order(); if (!o) return;
    this.api.generateInvoice({invoice_type: 'customer_receipt', order: o.id, amount: o.total, notes: `Receipt for Order #${o.order_number}`}).subscribe({
      next: (inv) => this.api.downloadInvoice(inv.id).subscribe({
        next: (blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `invoice-${o.order_number}.pdf`; a.click(); URL.revokeObjectURL(url); },
        error: () => alert('Failed to download invoice.')
      }),
      error: () => alert('Failed to generate invoice.')
    });
  }

  orderStatusBadge(s: string) {
    const map: Record<string, string> = {placed: 'badge-placed', confirmed: 'badge-confirmed', preparing: 'badge-preparing', ready: 'badge-ready', picked_up: 'badge-ready', on_the_way: 'badge-preparing', delivered: 'badge-delivered', cancelled: 'badge-cancelled'};
    return 'badge ' + (map[s] || 'badge-secondary');
  }
}
