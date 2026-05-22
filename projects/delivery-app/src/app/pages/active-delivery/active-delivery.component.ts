import {
  AfterViewChecked,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApiService,
  AppCurrencyPipe,
  GoogleMapsService,
  openAuthenticatedWebSocket,
  Order,
  PaymentQR,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';
import { AuthService } from '@shared/public-api';

declare const google: any;

interface RouteMapState {
  map: any;
  markers: any[];
  partnerMarker: any | null;
  routePolyline: any | null;
}

@Component({
  selector: 'app-active-delivery',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './active-delivery.component.html',
  styleUrls: ['./active-delivery.component.scss'],
})
export class ActiveDeliveryComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private googleMaps = inject(GoogleMapsService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  mapErrors = signal<Record<string, string>>({});
  private sub?: Subscription;

  // Geotracking State
  private watchId?: number;
  private wsConns: Map<string, WebSocket> = new Map();

  // Google route maps keyed by order.id
  private routeMaps: Map<string, RouteMapState> = new Map();
  private initializingMaps: Set<string> = new Set();
  private currentLat = 0;
  private currentLng = 0;

  // Delivery confirmation modal state
  confirmModalOrder = signal<Order | null>(null);
  confirmOtp = signal('');
  confirmPhoto = signal<File | null>(null);
  confirmError = signal('');
  confirming = signal(false);

  // Payment QR state
  paymentQR = signal<PaymentQR | null>(null);
  loadingQR = signal(false);

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => this.load());
    this.startLocationTracking();
  }

  ngAfterViewChecked() {
    this.initMapsForOrders();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.stopLocationTracking();
    this.routeMaps.forEach((state) => this.clearRouteMapState(state));
    this.routeMaps.clear();
    this.initializingMaps.clear();
  }

  // --- Tracking Broadcast ---
  private startLocationTracking() {
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) =>
          this.broadcastLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
      );
    }
  }

  private stopLocationTracking() {
    if (this.watchId !== undefined && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.wsConns.forEach((ws) => ws.close());
    this.wsConns.clear();
  }

  private broadcastLocation(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;

    const currentOrders = this.orders();
    if (!currentOrders || currentOrders.length === 0) return;

    currentOrders.forEach((order) => {
      if (order.status !== 'delivered' && order.status !== 'cancelled') {
        let ws = this.wsConns.get(order.id);
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          ws = this.connectTrackerSocket(order.id);
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              action: 'update_location',
              lat,
              lng,
              partner_id: this.auth.user()?.id,
            }),
          );
        }
        const routeMap = this.routeMaps.get(order.id);
        if (routeMap?.partnerMarker) {
          routeMap.partnerMarker.setPosition({ lat, lng });
          this.refreshRoutePolyline(order, routeMap);
        }
      }
    });
  }

  private initMapsForOrders() {
    const activeOrderIds = new Set<string>();

    this.orders().forEach((order) => {
      if (!this.isRouteMapStatus(order.status)) return;

      activeOrderIds.add(order.id);
      if (
        !this.routeMaps.has(order.id) &&
        !this.initializingMaps.has(order.id)
      ) {
        this.initGoogleMapForOrder(order);
        return;
      }

      const routeMap = this.routeMaps.get(order.id);
      if (routeMap) this.refreshRoutePolyline(order, routeMap);
    });

    this.routeMaps.forEach((state, orderId) => {
      if (activeOrderIds.has(orderId)) return;
      this.clearRouteMapState(state);
      this.routeMaps.delete(orderId);
      this.clearMapError(orderId);
    });
  }

  private async initGoogleMapForOrder(order: Order) {
    const el = document.getElementById(`delivery-map-${order.id}`);
    if (!el) return;

    if (!this.googleMaps.hasApiKey()) {
      this.setMapError(order.id, 'Google Maps API key is not configured.');
      return;
    }

    this.initializingMaps.add(order.id);
    try {
      await this.googleMaps.loadJavaScriptApi();
      if (!this.isRouteMapStatus(order.status) || this.routeMaps.has(order.id))
        return;

      const center = this.routeCenter(order);
      const map = new google.maps.Map(el, {
        center,
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        gestureHandling: 'greedy',
      });
      const bounds = new google.maps.LatLngBounds();
      const state: RouteMapState = {
        map,
        markers: [],
        partnerMarker: null,
        routePolyline: null,
      };

      const addMarker = (
        position: { lat: number; lng: number },
        title: string,
        label: string,
      ) => {
        const marker = new google.maps.Marker({
          map,
          position,
          title,
          label,
        });
        state.markers.push(marker);
        bounds.extend(position);
        return marker;
      };

      const vendorPoint = this.vendorPoint(order);
      if (vendorPoint) {
        addMarker(
          vendorPoint,
          `Pickup: ${order.vendor_info?.store_name || 'Vendor'}`,
          'P',
        );
      }

      const customerPoint = this.customerPoint(order);
      if (customerPoint) addMarker(customerPoint, 'Drop-off', 'D');

      const partnerPoint = this.partnerPoint();
      if (partnerPoint) {
        state.partnerMarker = addMarker(partnerPoint, 'You', 'Y');
      }

      this.refreshRoutePolyline(order, state);
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48);

      this.routeMaps.set(order.id, state);
      this.clearMapError(order.id);
    } catch (error) {
      console.warn('[Delivery map] Google Maps unavailable:', error);
      this.setMapError(order.id, 'Google Maps could not be loaded.');
    } finally {
      this.initializingMaps.delete(order.id);
    }
  }

  private refreshRoutePolyline(order: Order, state: RouteMapState) {
    const path = this.routePoints(order);
    if (path.length < 2) return;

    if (!state.routePolyline) {
      state.routePolyline = new google.maps.Polyline({
        map: state.map,
        path,
        strokeColor: '#22C55E',
        strokeOpacity: 1,
        strokeWeight: 4,
      });
      return;
    }

    state.routePolyline.setPath(path);
  }

  private clearRouteMapState(state: RouteMapState) {
    state.markers.forEach((marker) => marker.setMap(null));
    state.routePolyline?.setMap(null);
  }

  private routePoints(order: Order): Array<{ lat: number; lng: number }> {
    return [
      this.partnerPoint(),
      this.vendorPoint(order),
      this.customerPoint(order),
    ].filter(Boolean) as Array<{ lat: number; lng: number }>;
  }

  private routeCenter(order: Order): { lat: number; lng: number } {
    return (
      this.partnerPoint() ||
      this.vendorPoint(order) ||
      this.customerPoint(order) || { lat: 12.9716, lng: 77.5946 }
    );
  }

  private vendorPoint(order: Order): { lat: number; lng: number } | null {
    return this.pointFrom(
      order.vendor_info?.latitude,
      order.vendor_info?.longitude,
    );
  }

  private customerPoint(order: Order): { lat: number; lng: number } | null {
    return this.pointFrom(order.delivery_latitude, order.delivery_longitude);
  }

  private partnerPoint(): { lat: number; lng: number } | null {
    return this.pointFrom(this.currentLat, this.currentLng);
  }

  private pointFrom(
    lat: unknown,
    lng: unknown,
  ): { lat: number; lng: number } | null {
    const parsedLat = Number(lat || 0);
    const parsedLng = Number(lng || 0);
    if (!parsedLat || !parsedLng) return null;
    return { lat: parsedLat, lng: parsedLng };
  }

  private isRouteMapStatus(status: string): boolean {
    return ['picked_up', 'on_the_way'].includes(status);
  }

  mapError(orderId: string): string {
    return this.mapErrors()[orderId] || '';
  }

  private setMapError(orderId: string, message: string) {
    this.mapErrors.update((errors) => ({ ...errors, [orderId]: message }));
  }

  private clearMapError(orderId: string) {
    this.mapErrors.update((errors) => {
      const next = { ...errors };
      delete next[orderId];
      return next;
    });
  }
  private connectTrackerSocket(orderId: string): WebSocket {
    const ws = openAuthenticatedWebSocket(
      `/sa/ws/delivery/${orderId}/tracking/`,
      this.auth.getToken(),
    );
    ws.onopen = () =>
      console.log(`Connected tracking socket for order ${orderId}`);
    ws.onerror = (err) => console.error('WS Error:', err);
    this.wsConns.set(orderId, ws);
    return ws;
  }

  load() {
    this.loading.set(true);
    this.api.getDeliveryDashboard().subscribe({
      next: (d) => {
        this.orders.set(d.active_orders || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  navigateToVendor(order: Order) {
    const lat = order.vendor_info?.latitude;
    const lng = order.vendor_info?.longitude;
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_blank',
      );
    }
  }

  navigateToCustomer(order: Order) {
    const lat = order.delivery_latitude;
    const lng = order.delivery_longitude;
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_blank',
      );
    }
  }

  setOnTheWay(order: Order) {
    this.api
      .setDeliveryOnTheWay(order.id)
      .subscribe({ next: () => this.load() });
  }

  cancelAssignment(order: Order) {
    if (!confirm('Cancel this delivery? The system will find another partner.'))
      return;
    this.api
      .cancelDeliveryAssignment(order.id)
      .subscribe({ next: () => this.load() });
  }

  openConfirmModal(order: Order) {
    this.confirmModalOrder.set(order);
    this.confirmOtp.set('');
    this.confirmPhoto.set(null);
    this.confirmError.set('');
    this.paymentQR.set(null);
    // Load QR when opening modal
    this.loadingQR.set(true);
    this.api.getPaymentQR(order.id).subscribe({
      next: (qr) => {
        this.paymentQR.set(qr);
        this.loadingQR.set(false);
      },
      error: () => this.loadingQR.set(false),
    });
  }

  closeConfirmModal() {
    this.confirmModalOrder.set(null);
    this.paymentQR.set(null);
  }

  onPhotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    this.confirmPhoto.set(file);
  }

  submitDelivery() {
    const order = this.confirmModalOrder();
    if (!order) return;
    const otp = this.confirmOtp().trim();
    if (!otp) {
      this.confirmError.set('Please enter the OTP from the customer.');
      return;
    }
    if (!this.confirmPhoto()) {
      this.confirmError.set('Please take a delivery photo.');
      return;
    }

    this.confirming.set(true);
    this.confirmError.set('');
    this.api.confirmDelivery(order.id, otp, this.confirmPhoto()!).subscribe({
      next: () => {
        this.confirming.set(false);
        this.closeConfirmModal();
        this.load();
      },
      error: (err) => {
        this.confirming.set(false);
        this.confirmError.set(
          err.error?.error || 'Failed. Check the OTP and try again.',
        );
      },
    });
  }
}
