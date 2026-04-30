import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AlertService, ApiService, AuthService, AppCurrencyPipe, Order, OrderTracking, openAuthenticatedWebSocket } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCurrencyPipe, GoogleMapsModule],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private zone = inject(NgZone);
  private alerts = inject(AlertService);

  order = signal<Order | null>(null);
  tracking = signal<OrderTracking[]>([]);
  loading = signal(true);
  cancelling = signal(false);
  private sub?: Subscription;

  // Tip
  tipAmount = signal<number>(0);
  tipping = signal(false);
  tipSubmitted = signal(false);
  readonly tipPresets = [10, 20, 50, 100];

  // Live tracking map
  center: google.maps.LatLngLiteral = {lat: 12.9716, lng: 77.5946};
  zoom = 14;
  driverPosition?: google.maps.LatLngLiteral;
  vendorPosition?: google.maps.LatLngLiteral;
  customerPosition?: google.maps.LatLngLiteral;
  driverMarkerOptions: google.maps.MarkerOptions = {};
  vendorMarkerOptions: google.maps.MarkerOptions = {};
  customerMarkerOptions: google.maps.MarkerOptions = {};
  mapOptions: google.maps.MapOptions = {};
  etaMinutes = signal<number | null>(null);

  private directionsService?: google.maps.DirectionsService;
  private directionsRenderer?: google.maps.DirectionsRenderer;
  private lastDirectionsTime = 0;
  private directionsEnabled = true;
  private ws: WebSocket | null = null;
  private animFrameId?: number;

  readonly orderSteps = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered'];
  private ratingRedirectDone = false;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadCancellationPolicy();
    this.sub = timer(0, 5000).subscribe(() => {
      this.api.getOrder(id).subscribe({
        next: (o) => {
          this.order.set(o);
          this.tracking.set(o.tracking || []);
          this.loading.set(false);
          this.api.getOrderTracking(id).subscribe({ next: (t) => this.tracking.set(t.results || t) });
          this.updateMapPositions(o);
          if (o.estimated_delivery_time) this.etaMinutes.set(o.estimated_delivery_time);
          if (o.status === 'delivered' && !o.has_rating && !this.ratingRedirectDone) {
            this.ratingRedirectDone = true;
            setTimeout(() => this.router.navigate(['/order', id, 'rate']), 1500);
          }
        },
        error: () => this.loading.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.closeWs();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.directionsRenderer?.setMap(null);
  }

  ngAfterViewInit() {
    this.initMarkerOptions();
    this.connectWebSocket(this.route.snapshot.paramMap.get('id')!);
  }

  /** Fired by (mapInitialized) on <google-map> once the native map is ready. */
  onMapReady(nativeMap: google.maps.Map) {
    this.directionsRenderer?.setMap(null);
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {strokeColor: '#6C63FF', strokeWeight: 5, strokeOpacity: 0.85},
    });
    this.directionsRenderer.setMap(nativeMap);
    this.lastDirectionsTime = 0;

    const pts = [this.vendorPosition, this.driverPosition, this.customerPosition].filter(Boolean) as google.maps.LatLngLiteral[];
    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach(p => bounds.extend(p));
      nativeMap.fitBounds(bounds, 60);
    } else if (pts.length === 1) {
      nativeMap.setCenter(pts[0]);
    }
    this.requestDirections();
  }

  private initMarkerOptions() {
    this.mapOptions = {zoomControl: true, streetViewControl: false, fullscreenControl: false, mapTypeControl: false, clickableIcons: false};
    this.driverMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/micons/motorcycling.png', scaledSize: new google.maps.Size(42, 42), anchor: new google.maps.Point(21, 21)},
      zIndex: 10, title: 'Delivery Partner',
    };
    this.vendorMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png', scaledSize: new google.maps.Size(34, 34)},
      zIndex: 5, title: 'Store',
    };
    this.customerMarkerOptions = {
      icon: {url: 'https://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png', scaledSize: new google.maps.Size(34, 34)},
      zIndex: 5, title: 'Your Location',
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

  private connectWebSocket(orderId: string) {
    this.ws = openAuthenticatedWebSocket(`/sa/ws/delivery/${orderId}/tracking/`, this.auth.getToken());
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
      if (data.type === 'eta_update' && data.eta_minutes != null) {
        this.zone.run(() => this.etaMinutes.set(data.eta_minutes));
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
        this.driverPosition = {lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + (to.lng - from.lng) * ease};
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
    return ['confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'].includes(s ?? '');
  }

  goBack() { this.location.back(); }

  isStepCompleted(step: string): boolean {
    const status = this.order()?.status;
    if (!status) return false;
    return this.orderSteps.indexOf(step) < this.orderSteps.indexOf(status);
  }

  isStepPending(step: string): boolean {
    const status = this.order()?.status;
    if (!status) return true;
    return this.orderSteps.indexOf(step) > this.orderSteps.indexOf(status);
  }

  isLastStep(step: string): boolean { return step === 'delivered'; }

  cancellationPolicy = signal<{ window_minutes: number; allowed_statuses: string[] } | null>(null);
  cancelError = signal('');

  private loadCancellationPolicy() {
    this.api.getCancellationPolicy().subscribe({
      next: (p) => this.cancellationPolicy.set(p),
      error: () => {}
    });
  }

  canCancel(): boolean {
    const o = this.order();
    if (!o) return false;
    const policy = this.cancellationPolicy();
    const allowed = policy?.allowed_statuses ?? ['placed', 'confirmed', 'preparing', 'ready'];
    if (!allowed.includes(o.status)) return false;
    if (policy && policy.window_minutes > 0) {
      const elapsed = (Date.now() - new Date(o.placed_at).getTime()) / 60000;
      if (elapsed > policy.window_minutes) return false;
    }
    return true;
  }

  cancelWindowLabel(): string {
    const o = this.order();
    const policy = this.cancellationPolicy();
    if (!o || !policy || policy.window_minutes === 0) return '';
    const elapsed = (Date.now() - new Date(o.placed_at).getTime()) / 60000;
    const remaining = Math.max(0, policy.window_minutes - elapsed);
    if (remaining <= 0) return 'Cancellation window expired';
    return `Cancel within ${Math.ceil(remaining)} min`;
  }

  isActiveOrder() {
    const status = this.order()?.status;
    return status && ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'].includes(status);
  }

  cancelOrder() {
    this.cancelling.set(true);
    this.cancelError.set('');
    this.api.cancelOrder(this.order()!.id).subscribe({
      next: (o) => { this.order.set(o); this.cancelling.set(false); },
      error: (err) => {
        this.cancelError.set(err.error?.error || 'Could not cancel order.');
        this.cancelling.set(false);
      }
    });
  }

  reordering = signal(false);

  reorder() {
    const o = this.order();
    if (!o) return;
    this.reordering.set(true);
    this.api.reorder(o.id).subscribe({
      next: (cart) => {
        this.reordering.set(false);
        this.api.refreshCartCount();
        if (cart.skipped?.length) {
          this.alerts.warning(`${cart.skipped.length} item(s) unavailable and were skipped.`, 'Some items were skipped');
        }
        this.router.navigate(['/checkout']);
      },
      error: () => {
        this.reordering.set(false);
        this.alerts.error('Could not reorder. Please try again.');
      }
    });
  }

  payingNow = signal(false);

  canPayNow(): boolean {
    const o = this.order();
    return !!o && o.payment_method === 'razorpay' && !o.is_payment_verified
      && !['cancelled', 'delivered'].includes(o.status);
  }

  payNow() {
    const o = this.order();
    if (!o) return;
    this.payingNow.set(true);
    this.api.createRazorpayOrder(o.id).subscribe({
      next: (rzData) => {
        const Razorpay = (window as any)['Razorpay'];
        const options = {
          key: rzData.key_id,
          amount: rzData.amount,
          currency: rzData.currency,
          name: 'NexConnect',
          description: `Order #${o.order_number}`,
          order_id: rzData.razorpay_order_id,
          theme: { color: '#6C63FF' },
          handler: (response: any) => {
            this.api.verifyRazorpayPayment(o.id, response.razorpay_payment_id, response.razorpay_signature).subscribe({
              next: (updated) => { this.order.set(updated); this.payingNow.set(false); this.alerts.success('Payment successful!'); },
              error: () => { this.payingNow.set(false); this.alerts.error('Payment verification failed. Contact support.'); }
            });
          },
          modal: { ondismiss: () => this.payingNow.set(false) }
        };
        this.payingNow.set(false);
        new Razorpay(options).open();
      },
      error: () => { this.payingNow.set(false); this.alerts.error('Could not initiate payment.'); }
    });
  }

  downloadInvoice() {
    const o = this.order(); if (!o) return;
    this.api.generateInvoice({invoice_type: 'customer_receipt', order: o.id, amount: o.total, notes: `Receipt for Order #${o.order_number}`}).subscribe({
      next: (inv) => this.api.downloadInvoice(inv.id).subscribe({
        next: (blob) => this.saveOrShareBlob(blob, `invoice-${o.order_number}.pdf`),
        error: () => this.alerts.error('Failed to download invoice.')
      }),
      error: () => this.alerts.error('Failed to generate invoice.')
    });
  }

  private saveOrShareBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  submitTip() {
    const o = this.order();
    if (!o || this.tipAmount() <= 0 || this.tipping()) return;
    this.tipping.set(true);
    this.api.tipDeliveryPartner(o.id, this.tipAmount()).subscribe({
      next: (res) => {
        this.order.update(ord => ord ? { ...ord, delivery_tip: res.delivery_tip } : ord);
        this.tipping.set(false);
        this.tipSubmitted.set(true);
        this.alerts.success('Tip sent! Thank you for your generosity.');
      },
      error: () => this.tipping.set(false),
    });
  }

  shareTracking() {
    const o = this.order();
    if (!o) return;
    const url = `${window.location.origin}/order/${o.id}/tracking`;
    if (navigator.share) {
      navigator.share({ title: 'Live Delivery Tracking', text: `Track my NexConnect delivery: ${url}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => this.alerts.success('Tracking link copied!')).catch(() => {});
    }
  }
}
