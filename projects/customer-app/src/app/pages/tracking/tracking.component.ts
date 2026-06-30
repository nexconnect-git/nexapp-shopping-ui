import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  Inject,
  OnDestroy,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { shouldShowDeliveryPartner } from '@nexconnect/customer-checkout';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { GoogleMapsService } from '@shared/lib/services/google-maps.service';
import { openAuthenticatedWebSocket } from '@shared/lib/services/websocket-auth';
import { SessionStore } from '@shared/lib/services/session-store.service';
import { API_BASE_URL } from '@shared/lib/tokens/api-url.token';
import { normalizeOrderStatus } from '@shared/lib/models/adapters';
import { Subscription } from 'rxjs';
import { OrderService } from '../../services/order.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { CustomerOrderApiService } from '../../services/customer-order-api.service';

declare const google: any;

@Component({
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe, DisplayOrderIdPipe],
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.scss'],
})
export class TrackingComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('trackingMap') trackingMaps?: QueryList<ElementRef<HTMLElement>>;
  tracking = signal<any[]>([]);
  mapReady = signal(false);
  mapUnavailable = signal(false);
  trackingError = signal('');
  lastTrackingRefresh = signal<Date | null>(null);
  liveEtaMinutes = signal<number | null>(null);
  invoiceDownloading = signal(false);
  private map: any = null;
  private currentMarker: any = null;
  private mapHost: HTMLElement | null = null;
  private mapHostChanges?: Subscription;
  private mapInitialized = false;
  private refreshTimer: number | null = null;
  private trackingSocket: WebSocket | null = null;
  private websocketReconnectTimer: number | null = null;
  private websocketClosedByComponent = false;
  private readonly statusOrder: string[] = [
    'created',
    'placed',
    'pending_payment',
    'confirmed',
    'vendor_accepted',
    'preparing',
    'packed',
    'ready',
    'ready_for_pickup',
    'delivery_assigned',
    'picked_up',
    'out_for_delivery',
    'on_the_way',
    'arrived_at_customer',
    'delivered',
    'cancelled',
    'refunded',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderApi: CustomerOrderApiService,
    public orders: OrderService,
    private state: AppStateService,
    private googleMaps: GoogleMapsService,
    private session: SessionStore,
    @Inject(API_BASE_URL) private apiBaseUrl: string,
  ) {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTracking(id);
      this.connectTrackingSocket(id);
      this.startAutoRefresh(id);
    }
    effect(() => {
      this.currentCoordinate();
      window.setTimeout(() => this.refreshMapMarker(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.mapHostChanges = this.trackingMaps?.changes.subscribe(() =>
      this.initGoogleMap(),
    );
    window.setTimeout(() => this.initGoogleMap(), 0);
  }

  ngOnDestroy(): void {
    this.mapHostChanges?.unsubscribe();
    this.stopAutoRefresh();
    this.closeTrackingSocket();
    this.currentMarker?.setMap?.(null);
    this.map = null;
    this.mapHost = null;
  }

  order = computed(() =>
    this.orders.getOrder(this.route.snapshot.paramMap.get('id')),
  );
  partner = computed(() => {
    const partner = this.order().raw?.delivery_partner_info;
    return shouldShowDeliveryPartner(partner) ? partner : null;
  });
  currentStatus = computed(() =>
    this.normalizeStatusKey(this.order().raw?.status || this.order().status),
  );
  statusLabel = computed(() => this.labelFor(this.currentStatus()));
  isLoadingOrder = computed(() => this.order().id === 'loading');
  partnerImage = computed(() => {
    const partner = this.partner() as any;
    return partner?.photo || partner?.avatar || partner?.image || '';
  });
  steps = computed(() => {
    const order = this.order();
    const tracking = this.tracking().length
      ? this.tracking()
      : order.raw?.tracking || [];
    const normalized = tracking
      .map((entry: any) => ({
        status: this.normalizeStatusKey(entry?.status),
        timestamp: entry?.timestamp || null,
      }))
      .filter((entry: any) => !!entry.status);
    const orderStatus = this.normalizeStatusKey(order.raw?.status || order.status);
    if (orderStatus && !normalized.some((entry: any) => entry.status === orderStatus)) {
      normalized.push({ status: orderStatus, timestamp: null });
    }
    if (!normalized.some((entry: any) => entry.status === 'placed')) {
      normalized.unshift({ status: 'placed', timestamp: null });
    }
    const deduped = normalized.filter(
      (entry, index, list) => list.findIndex((item) => item.status === entry.status) === index,
    );
    deduped.sort((a, b) => this.statusWeight(a.status) - this.statusWeight(b.status));

    const cancelledFlow = orderStatus === 'cancelled';
    return deduped.map((entry) => {
      const weight = this.statusWeight(entry.status);
      const done = cancelledFlow
        ? entry.status === 'cancelled' || !!entry.timestamp
        : weight < this.statusWeight(orderStatus);
      const current = cancelledFlow
        ? entry.status === 'cancelled'
        : weight === this.statusWeight(orderStatus);
      return {
        icon: this.iconFor(entry.status),
        name: this.labelFor(entry.status),
        status: entry.status,
        done,
        current,
        time: entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : entry.status === 'placed'
            ? order.time || ''
            : '',
      };
    });
  });
  progressSteps = computed(() => {
    const status = this.normalizeStatusKey(this.order().raw?.status || this.order().status);
    const currentWeight = this.statusWeight(status);
    const timelineMap = new Map(this.steps().map((step: any) => [step.status, step.time]));
    const display = [
      { status: 'placed', label: 'Placed' },
      { status: 'confirmed', label: 'Confirmed' },
      { status: 'preparing', label: 'Preparing' },
      {
        status: status === 'delivered' ? 'delivered' : 'on_the_way',
        label: status === 'delivered' ? 'Delivered' : 'On the way',
      },
    ];
    return display.map((step) => ({
      ...step,
      icon: this.iconFor(step.status),
      done: currentWeight >= this.statusWeight(step.status),
      current: this.statusWeight(step.status) === currentWeight,
      time: timelineMap.get(step.status) || '',
    }));
  });
  estimatedArrivalLabel = computed(() => {
    const liveEta = this.liveEtaMinutes();
    if (typeof liveEta === 'number' && Number.isFinite(liveEta) && liveEta > 0) {
      return `${Math.round(liveEta)} mins`;
    }
    const raw = this.order().raw?.estimated_delivery_time;
    if (raw === null || raw === undefined) return 'Soon';
    const rawText = String(raw).trim();
    if (!rawText) return 'Soon';
    const numeric = Number(rawText);
    if (Number.isFinite(numeric) && numeric > 0) return `${numeric} mins`;
    return rawText;
  });
  hasPickedUp = computed(() => {
    const status = String(this.order().raw?.status || this.order().status || '').toLowerCase();
    const hasPickupTracking = this.tracking().some((entry) =>
      String(entry?.status || '').toLowerCase().includes('pick'),
    );
    return (
      hasPickupTracking ||
      status.includes('pick') ||
      status.includes('way') ||
      status.includes('deliver')
    );
  });
  mapStageLabel = computed(() =>
    this.hasPickedUp()
      ? 'Delivery route is active'
      : 'Pickup is at the store',
  );
  storeName = computed(() => {
    const order = this.order() as any;
    return (
      order.raw?.vendor_info?.store_name ||
      order.raw?.vendor?.store_name ||
      order.raw?.vendor_name ||
      order.vendorName ||
      order.items?.[0]?.storeName ||
      'Store'
    );
  });
  storeCategory = computed(() => {
    const order = this.order() as any;
    return (
      order.raw?.vendor_info?.category ||
      order.raw?.vendor?.category ||
      order.raw?.store_category ||
      'Nextou partner store'
    );
  });
  currentCoordinate = computed(() => {
    if (!this.hasPickedUp()) {
      return this.vendorCoordinate() || this.driverCoordinate();
    }
    return (
      this.driverCoordinate() ||
      this.destinationCoordinate() ||
      this.vendorCoordinate()
    );
  });
  directionsUrl = computed(() => {
    if (!this.hasPickedUp()) return '';
    const origin = this.currentCoordinate();
    const destination = this.destinationCoordinate();
    if (!origin || !destination) return '';
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
  });
  trackingFreshnessLabel = computed(() => {
    if (this.trackingError()) return 'Updates paused';
    const refreshedAt = this.lastTrackingRefresh();
    if (!refreshedAt) return 'Waiting for live updates';
    return `Updated ${refreshedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  });

  private loadTracking(id: string): void {
    this.trackingError.set('');
    this.orderApi.getOrderTracking(id).subscribe({
      next: (response) => {
        this.tracking.set(
          Array.isArray(response)
            ? response
            : response.results || response.tracking || [],
        );
        this.lastTrackingRefresh.set(new Date());
        this.refreshMapMarker();
      },
      error: () => {
        this.tracking.set([]);
        this.trackingError.set('Could not refresh live tracking updates.');
      },
    });
  }

  retryTracking(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.orders.loadOrders();
    this.loadTracking(id);
    this.connectTrackingSocket(id);
  }

  callPartner(): void {
    const phone = this.partner()?.phone;
    if (phone) {
      location.href = `tel:${phone}`;
      return;
    }
    this.state.showToast('Partner phone number is not available yet');
  }

  mapAction(action: 'zoom-in' | 'zoom-out'): void {
    const url = this.directionsUrl();
    if (url) window.open(url, '_blank', 'noopener');
    else
      this.state.showToast(
        action === 'zoom-in' ? 'Map loading' : 'Map loading',
      );
  }

  ordersLink(): string[] {
    return ['/orders'];
  }

  private initGoogleMap(): void {
    if (!this.shouldUseEmbeddedMap()) {
      this.mapUnavailable.set(true);
      return;
    }
    this.googleMaps
      .loadJavaScriptApi()
      .then(() => {
        const coordinate = this.currentCoordinate() || {
          lat: 12.9716,
          lng: 77.5946,
        };
        const element = this.visibleMapElement();
        if (!element) return;
        if (this.mapInitialized && this.mapHost === element) {
          this.refreshMapMarker();
          return;
        }
        this.currentMarker?.setMap?.(null);
        this.map = null;
        this.mapInitialized = true;
        this.mapHost = element;
        this.map = new google.maps.Map(element, {
          center: coordinate,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl:
            typeof window !== 'undefined' &&
            !window.matchMedia('(max-width: 760px)').matches,
          fullscreenControl:
            typeof window !== 'undefined' &&
            !window.matchMedia('(max-width: 760px)').matches,
          clickableIcons: false,
          styles: this.mapStyles(),
        });
        this.mapReady.set(true);
        window.setTimeout(() => {
          google.maps.event.trigger(this.map, 'resize');
          this.refreshMapMarker();
        }, 0);
      })
      .catch(() => this.mapUnavailable.set(true));
  }

  private shouldUseEmbeddedMap(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }
    return this.googleMaps.hasApiKey();
  }

  private visibleMapElement(): HTMLElement | null {
    const maps = this.trackingMaps?.toArray() || [];
    return (
      maps
        .map((item) => item.nativeElement)
        .find((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          );
        }) || null
    );
  }

  private refreshMapMarker(): void {
    if (!this.map || typeof google === 'undefined') return;
    const coordinate = this.currentCoordinate();
    if (!coordinate) return;
    this.map.setCenter(coordinate);
    this.currentMarker?.setMap?.(null);
    this.currentMarker = new google.maps.Marker({
      position: coordinate,
      map: this.map,
      title: this.hasPickedUp() ? 'Current delivery location' : 'Store pickup location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: this.hasPickedUp() ? '#6d3bff' : '#0f9f5f',
        fillOpacity: 1,
        strokeColor: '#FBFBFC',
        strokeWeight: 4,
      },
    });
  }

  private mapStyles(): any[] {
    return [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      {
        featureType: 'administrative',
        elementType: 'labels.icon',
        stylers: [{ visibility: 'off' }],
      },
      {
        featureType: 'road',
        elementType: 'labels.icon',
        stylers: [{ visibility: 'off' }],
      },
    ];
  }

  joinOne(): void {
    this.router.navigate(['/account']);
  }

  downloadInvoice(): void {
    if (this.invoiceDownloading()) return;
    const order = this.order();
    const orderId = String(order?.id || '');
    if (!orderId || orderId === 'loading') {
      this.state.showToast('Order details are still loading', 'info');
      return;
    }

    const knownInvoiceId = String((order.raw as any)?.invoice_id || '').trim();
    this.invoiceDownloading.set(true);
    this.state.showToast('Preparing your receipt', 'info');

    const downloadById = (invoiceId: string): void => {
      this.orderApi.downloadInvoice(invoiceId).subscribe({
        next: (blob) => {
          this.triggerFileDownload(
            blob,
            `receipt-${order.raw?.order_number || orderId}.pdf`,
          );
          this.state.showToast('Receipt downloaded', 'success');
          this.invoiceDownloading.set(false);
        },
        error: () => {
          this.state.showToast('Could not download receipt right now', 'error');
          this.invoiceDownloading.set(false);
        },
      });
    };

    if (knownInvoiceId) {
      downloadById(knownInvoiceId);
      return;
    }

    this.orderApi
      .generateInvoice({ order: orderId, invoice_type: 'customer_receipt' })
      .subscribe({
        next: (invoice: any) => {
          const invoiceId = String(invoice?.id || '').trim();
          if (!invoiceId) {
            this.state.showToast('Receipt is not ready yet', 'warning');
            this.invoiceDownloading.set(false);
            return;
          }
          downloadById(invoiceId);
        },
        error: () => {
          this.state.showToast('Could not prepare receipt right now', 'error');
          this.invoiceDownloading.set(false);
        },
      });
  }

  itemQuantity(item: any): number {
    const value = Number(item?.raw?.quantity ?? item?.quantity ?? 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private labelFor(status: string): string {
    if (status === 'on_the_way') return 'On the way';
    if (status === 'out_for_delivery') return 'On the way';
    if (status === 'picked_up') return 'Picked up';
    if (status === 'ready_for_pickup') return 'Ready for pickup';
    if (status === 'delivery_assigned') return 'Driver assigned';
    if (status === 'arrived_at_customer') return 'Arriving';
    if (status === 'pending_payment') return 'Payment pending';
    if (status === 'vendor_accepted') return 'Accepted';
    return String(status || 'update')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private iconFor(status: string): string {
    const key = String(status || '').toLowerCase();
    if (key.includes('deliver')) return 'task_alt';
    if (key.includes('way') || key.includes('pick')) return 'two_wheeler';
    if (key.includes('ready') || key.includes('assign')) return 'local_shipping';
    if (key.includes('prepar') || key.includes('pack')) return 'inventory_2';
    if (key.includes('confirm')) return 'verified';
    return 'task_alt';
  }

  private normalizeStatusKey(value: string): string {
    return normalizeOrderStatus(value);
  }

  private statusWeight(status: string): number {
    const normalized = this.normalizeStatusKey(status);
    const index = this.statusOrder.indexOf(normalized);
    return index >= 0 ? index : this.statusOrder.length + 1;
  }

  private startAutoRefresh(id: string): void {
    this.stopAutoRefresh();
    if (typeof window === 'undefined') return;
    this.refreshTimer = window.setInterval(() => {
      if (this.isTerminalStatus(this.currentStatus())) {
        this.stopAutoRefresh();
        this.closeTrackingSocket();
        return;
      }
      this.orders.loadOrders();
      this.loadTracking(id);
    }, 30000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.refreshTimer);
    }
    this.refreshTimer = null;
  }

  private isTerminalStatus(status: string): boolean {
    return ['delivered', 'cancelled', 'refunded'].includes(
      this.normalizeStatusKey(status),
    );
  }

  private connectTrackingSocket(id: string): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (this.isTerminalStatus(this.currentStatus())) return;

    this.closeTrackingSocket(false);
    this.websocketClosedByComponent = false;

    try {
      const socket = openAuthenticatedWebSocket(
        `/ws/delivery/${id}/tracking/`,
        this.session.getAccessToken(),
        this.apiBaseUrl,
      );
      this.trackingSocket = socket;
      socket.onopen = () => {
        this.trackingError.set('');
        this.clearWebsocketReconnect();
      };
      socket.onmessage = (event) => this.applySocketTrackingMessage(event.data);
      socket.onerror = () => this.scheduleWebsocketReconnect(id);
      socket.onclose = () => {
        if (!this.websocketClosedByComponent && !this.isTerminalStatus(this.currentStatus())) {
          this.scheduleWebsocketReconnect(id);
        }
      };
    } catch {
      this.scheduleWebsocketReconnect(id);
    }
  }

  private applySocketTrackingMessage(raw: string): void {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (payload?.type === 'eta_update') {
      const eta = Number(payload.eta_minutes);
      if (Number.isFinite(eta) && eta > 0) {
        this.liveEtaMinutes.set(eta);
        this.lastTrackingRefresh.set(new Date());
      }
      return;
    }

    if (payload?.type !== 'location_update') return;
    const lat = Number(payload.lat ?? payload.latitude);
    const lng = Number(payload.lng ?? payload.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const entry = {
      status: this.hasPickedUp() ? 'on_the_way' : 'delivery_assigned',
      latitude: lat,
      longitude: lng,
      partner_id: payload.partner_id || null,
      timestamp: new Date().toISOString(),
    };
    this.tracking.update((items) => [...items.slice(-49), entry]);
    this.lastTrackingRefresh.set(new Date());
    this.refreshMapMarker();
  }

  private scheduleWebsocketReconnect(id: string): void {
    if (typeof window === 'undefined' || this.websocketReconnectTimer !== null) return;
    this.websocketReconnectTimer = window.setTimeout(() => {
      this.websocketReconnectTimer = null;
      this.connectTrackingSocket(id);
    }, 5000);
  }

  private clearWebsocketReconnect(): void {
    if (this.websocketReconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.websocketReconnectTimer);
    }
    this.websocketReconnectTimer = null;
  }

  private closeTrackingSocket(markClosed = true): void {
    if (markClosed) {
      this.websocketClosedByComponent = true;
    }
    this.clearWebsocketReconnect();
    const socket = this.trackingSocket;
    this.trackingSocket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // REST polling remains the fallback if the socket cannot close cleanly.
    }
  }

  private vendorCoordinate(): { lat: number; lng: number } | null {
    return this.coordinateFrom(this.order().raw?.vendor_info);
  }

  private destinationCoordinate(): { lat: number; lng: number } | null {
    const raw = this.order().raw as any;
    return this.coordinateFrom({
      latitude: raw?.delivery_latitude ?? raw?.delivery_address?.latitude,
      longitude: raw?.delivery_longitude ?? raw?.delivery_address?.longitude,
    });
  }

  private driverCoordinate(): { lat: number; lng: number } | null {
    const tracking = this.tracking().length
      ? this.tracking()
      : this.order().raw?.tracking || [];
    const latest = [...tracking]
      .reverse()
      .find((entry: any) => entry?.latitude && entry?.longitude);
    return this.coordinateFrom(latest);
  }

  private coordinateFrom(value: any): { lat: number; lng: number } | null {
    const lat = Number(value?.lat ?? value?.latitude);
    const lng = Number(value?.lng ?? value?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  private triggerFileDownload(blob: Blob, fileName: string): void {
    const safeName = String(fileName || 'receipt.pdf').replace(/[^\w.-]+/g, '_');
    const link = document.createElement('a');
    const objectUrl = window.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = safeName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  }
}

