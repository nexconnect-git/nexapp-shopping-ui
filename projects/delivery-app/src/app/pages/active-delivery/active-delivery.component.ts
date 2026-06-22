import {
  AfterViewChecked,
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import {
  AlertService,
  API_BASE_URL,
  AppCurrencyPipe,
  AuthService,
  GoogleMapsService,
  NativePlatformService,
  type NativeWatchId,
  openAuthenticatedWebSocket,
  Order,
  PaymentQR,
} from '@shared/public-api';
import { DeliveryWorkflowFacade } from '../../services/delivery-workflow.facade';

declare const google: unknown;

interface GoogleMarker {
  setMap: (map: unknown) => void;
  setPosition: (position: { lat: number; lng: number }) => void;
}

interface GooglePolyline {
  setMap: (map: unknown) => void;
  setPath: (path: Array<{ lat: number; lng: number }>) => void;
}

interface RouteMapState {
  map: unknown;
  markers: GoogleMarker[];
  partnerMarker: GoogleMarker | null;
  routePolyline: GooglePolyline | null;
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
  private workflow = inject(DeliveryWorkflowFacade);
  private auth = inject(AuthService);
  private googleMaps = inject(GoogleMapsService);
  private nativePlatform = inject(NativePlatformService);
  private alerts = inject(AlertService);
  private apiBaseUrl = inject(API_BASE_URL);

  orders = signal<Order[]>([]);
  loading = signal(true);
  mapErrors = signal<Record<string, string>>({});
  private sub?: Subscription;

  private watchId?: NativeWatchId;
  private wsConns: Map<string, WebSocket> = new Map();
  private routeMaps: Map<string, RouteMapState> = new Map();
  private initializingMaps: Set<string> = new Set();
  private currentLat = 0;
  private currentLng = 0;

  actionLoading = signal<Record<string, boolean>>({});
  cancelModalOrder = signal<Order | null>(null);

  confirmModalOrder = signal<Order | null>(null);
  confirmOtp = signal('');
  confirmPhoto = signal<File | null>(null);
  confirmError = signal('');
  confirming = signal(false);
  deliverySuccess = signal(false);

  paymentQR = signal<PaymentQR | null>(null);
  loadingQR = signal(false);

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => {
      if (document.hidden) return;
      this.load(false);
    });
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

  @HostListener('document:keydown.escape')
  closeModalsOnEscape() {
    if (this.confirmModalOrder()) this.closeConfirmModal();
    if (this.cancelModalOrder()) this.closeCancelModal();
  }

  private setActionLoading(key: string, loading: boolean) {
    this.actionLoading.update((current) => ({ ...current, [key]: loading }));
  }

  isActionLoading(key: string): boolean {
    return !!this.actionLoading()[key];
  }

  actionKey(orderId: string, action: string): string {
    return `${orderId}:${action}`;
  }

  private async startLocationTracking() {
    try {
      const hasPermission = await this.nativePlatform.requestLocationPermissions();
      if (!hasPermission) return;

      this.watchId = await this.nativePlatform.watchPosition(
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
        (pos) => this.broadcastLocation(pos.coords.latitude, pos.coords.longitude),
        () => {},
      );
    } catch {
      this.alerts.info('Location permission is required for live delivery tracking.');
    }
  }

  private stopLocationTracking() {
    if (this.watchId !== undefined) {
      void this.nativePlatform.clearWatch(this.watchId);
      this.watchId = undefined;
    }
    this.wsConns.forEach((ws) => ws.close());
    this.wsConns.clear();
  }

  private broadcastLocation(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;

    const currentOrders = this.orders();
    if (!currentOrders.length) return;

    currentOrders.forEach((order) => {
      if (order.status === 'delivered' || order.status === 'cancelled') return;

      let ws = this.wsConns.get(order.id);
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        ws = this.connectTrackerSocket(order.id);
      }

      if (ws.readyState === WebSocket.OPEN) {
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
      if (routeMap) {
        routeMap.partnerMarker?.setPosition({ lat, lng });
        this.refreshRoutePolyline(order, routeMap);
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
      if (!this.isRouteMapStatus(order.status) || this.routeMaps.has(order.id)) {
        return;
      }

      const g = google as {
        maps: {
          Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
          Marker: new (opts: Record<string, unknown>) => GoogleMarker;
          Polyline: new (opts: Record<string, unknown>) => GooglePolyline;
          LatLngBounds: new () => {
            extend: (position: { lat: number; lng: number }) => void;
            isEmpty: () => boolean;
          };
        };
      };

      const center = this.routeCenter(order);
      const map = new g.maps.Map(el, {
        center,
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        gestureHandling: 'greedy',
      });
      const bounds = new g.maps.LatLngBounds();
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
        const marker = new g.maps.Marker({ map, position, title, label });
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
      if (partnerPoint) state.partnerMarker = addMarker(partnerPoint, 'You', 'Y');

      this.refreshRoutePolyline(order, state);
      if (!bounds.isEmpty()) {
        const fitBounds = (map as { fitBounds?: (b: unknown, p?: number) => void })
          .fitBounds;
        fitBounds?.call(map, bounds, 48);
      }

      this.routeMaps.set(order.id, state);
      this.clearMapError(order.id);
    } catch {
      this.setMapError(order.id, 'Google Maps could not be loaded.');
    } finally {
      this.initializingMaps.delete(order.id);
    }
  }

  private refreshRoutePolyline(order: Order, state: RouteMapState) {
    const path = this.routePoints(order);
    if (path.length < 2) return;

    const g = google as {
      maps: { Polyline: new (opts: Record<string, unknown>) => GooglePolyline };
    };

    if (!state.routePolyline) {
      state.routePolyline = new g.maps.Polyline({
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
    return [this.partnerPoint(), this.vendorPoint(order), this.customerPoint(order)].filter(
      Boolean,
    ) as Array<{ lat: number; lng: number }>;
  }

  private routeCenter(order: Order): { lat: number; lng: number } {
    return (
      this.partnerPoint() ||
      this.vendorPoint(order) ||
      this.customerPoint(order) || { lat: 12.9716, lng: 77.5946 }
    );
  }

  private vendorPoint(order: Order): { lat: number; lng: number } | null {
    return this.pointFrom(order.vendor_info?.latitude, order.vendor_info?.longitude);
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
      `/ws/delivery/${orderId}/tracking/`,
      this.auth.getToken(),
      this.apiBaseUrl,
    );
    ws.onclose = () => this.wsConns.delete(orderId);
    this.wsConns.set(orderId, ws);
    return ws;
  }

  load(showActionError = false) {
    this.loading.set(true);
    this.workflow.loadDashboard().subscribe({
      next: (d) => {
        this.orders.set(d.active_orders || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (showActionError) {
          this.alerts.error(this.errorMessage(err, 'Could not refresh active deliveries.'));
        }
      },
    });
  }

  private errorMessage(err: unknown, fallback: string): string {
    const apiError = err as {
      error?: { error?: string; detail?: string; message?: string };
    };
    return (
      apiError?.error?.error ||
      apiError?.error?.detail ||
      apiError?.error?.message ||
      fallback
    );
  }

  navigateToVendor(order: Order) {
    const lat = order.vendor_info?.latitude;
    const lng = order.vendor_info?.longitude;
    if (!lat || !lng) {
      this.alerts.info('Vendor location is not available for this order.');
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank',
    );
  }

  navigateToCustomer(order: Order) {
    const lat = order.delivery_latitude;
    const lng = order.delivery_longitude;
    if (!lat || !lng) {
      this.alerts.info('Customer location is not available for this order.');
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank',
    );
  }

  setOnTheWay(order: Order) {
    const key = this.actionKey(order.id, 'on_the_way');
    if (this.isActionLoading(key)) return;
    this.setActionLoading(key, true);
    this.workflow.setOnTheWay(order.id).subscribe({
      next: () => {
        this.setActionLoading(key, false);
        this.alerts.success(`Order #${order.order_number} marked as on the way.`);
        this.load(true);
      },
      error: (err) => {
        this.setActionLoading(key, false);
        this.alerts.error(this.errorMessage(err, 'Could not update delivery status.'));
      },
    });
  }

  openCancelModal(order: Order) {
    this.cancelModalOrder.set(order);
  }

  closeCancelModal() {
    this.cancelModalOrder.set(null);
  }

  confirmCancelAssignment() {
    const order = this.cancelModalOrder();
    if (!order) return;

    const key = this.actionKey(order.id, 'cancel');
    if (this.isActionLoading(key)) return;
    this.setActionLoading(key, true);

    this.workflow.cancelAssignment(order.id).subscribe({
      next: () => {
        this.setActionLoading(key, false);
        this.closeCancelModal();
        this.alerts.info(`Assignment for order #${order.order_number} has been cancelled.`);
        this.load(true);
      },
      error: (err) => {
        this.setActionLoading(key, false);
        this.alerts.error(this.errorMessage(err, 'Could not cancel assignment.'));
      },
    });
  }

  openConfirmModal(order: Order) {
    this.confirmModalOrder.set(order);
    this.confirmOtp.set('');
    this.confirmPhoto.set(null);
    this.confirmError.set('');
    this.paymentQR.set(null);

    this.loadingQR.set(true);
    this.workflow.getPaymentQR(order.id).subscribe({
      next: (qr) => {
        this.paymentQR.set(qr);
        this.loadingQR.set(false);
      },
      error: (err) => {
        this.loadingQR.set(false);
        this.confirmError.set(
          this.errorMessage(err, 'Could not load payment QR. You can still complete with OTP.'),
        );
      },
    });
  }

  closeConfirmModal() {
    this.confirmModalOrder.set(null);
    this.paymentQR.set(null);
  }

  handleOverlayClose(event: MouseEvent, modal: 'confirm' | 'cancel') {
    if (event.target !== event.currentTarget) return;
    if (modal === 'confirm') {
      this.closeConfirmModal();
      return;
    }
    this.closeCancelModal();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.confirmError.set('Only image files are allowed for delivery proof.');
      return;
    }
    this.confirmPhoto.set(file);
    this.confirmError.set('');
  }

  updateConfirmOtp(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.confirmOtp.set(target.value);
  }

  submitDelivery() {
    const order = this.confirmModalOrder();
    if (!order || this.confirming()) return;

    const otp = this.confirmOtp().trim();
    if (!/^\d{4,6}$/.test(otp)) {
      this.confirmError.set('Enter a valid numeric OTP (4 to 6 digits).');
      return;
    }
    if (!this.confirmPhoto()) {
      this.confirmError.set('Please take a delivery photo.');
      return;
    }

    this.confirming.set(true);
    this.confirmError.set('');
    this.workflow.confirmDelivery(order.id, otp, this.confirmPhoto()!).subscribe({
      next: () => {
        this.confirming.set(false);
        this.deliverySuccess.set(true);
        setTimeout(() => {
          this.deliverySuccess.set(false);
          this.closeConfirmModal();
          this.alerts.success(`Delivery completed for order #${order.order_number}.`);
          this.load(true);
        }, 2200);
      },
      error: (err) => {
        this.confirming.set(false);
        this.confirmError.set(
          this.errorMessage(err, 'Failed to confirm delivery. Please check OTP and retry.'),
        );
      },
    });
  }
}
