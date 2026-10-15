import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  computed,
  effect,
  ElementRef,
  Inject,
  inject,
  OnDestroy,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { shouldShowDeliveryPartner } from '@nexconnect/customer-checkout';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { GoogleMapsService } from '@shared/lib/services/google-maps.service';
import { openAuthenticatedWebSocket } from '@shared/lib/services/websocket-auth';
import { SessionStore } from '@shared/lib/services/session-store.service';
import { API_BASE_URL } from '@shared/lib/tokens/api-url.token';
import { normalizeOrderStatus } from '@shared/lib/models/adapters';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { OrderService } from '../../services/order.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { CustomerOrderApiService } from '../../services/customer-order-api.service';
import { AuthService } from '../../services/auth.service';
import { CustomerReceiptComponent } from '../../shared/customer-receipt/customer-receipt.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

declare const google: any;

@Component({
  standalone: true,
  imports: [CustomerIconComponent, BreadcrumbsComponent, CustomerReceiptComponent,
    RouterLink,
    AppCurrencyPipe,
    DisplayOrderIdPipe,
    FormsModule,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    NxModalShellComponent,
  ],
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.scss'],
})
export class TrackingComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private authSession = this.auth.sessionVersion;
  readonly showDetails = signal(false);
  readonly cancellationBlocked = signal(false);
  readonly knownInvoiceId = computed(() => String((this.order().raw as any)?.invoice_id || ''));
  readonly terminal = computed(() => ['delivered','cancelled','refunded'].includes(this.currentStatus()));
  readonly gpsStale = computed(() => {
    const stamp = Date.parse(this.gpsUpdate()?.timestamp || '');
    return !!this.gpsUpdate() && (!Number.isFinite(stamp) || this.clock()-stamp>120000);
  });
  readonly stageDescription = computed(() => {
    const status=this.currentStatus();
    if(!this.terminal() && this.connection().includes('interrupted'))return 'Reconnecting to delivery updates. Status remains visible.';
    if(status==='placed')return 'Waiting for '+this.storeName()+' to accept.';
    if(status==='confirmed'||status==='vendor_accepted')return 'The store has accepted your order.';
    if(status==='preparing'||status==='packed')return 'Your items are being prepared and packed.';
    if(status==='ready'||status==='ready_for_pickup')return ['searching','notified'].includes(this.order().raw?.assignment_status||'') ? 'The store has started partner search.' : this.partner() ? 'Partner assigned. Pickup has not been confirmed.' : 'Ready at the store. No partner is assigned yet.';
    if(status==='delivery_assigned')return 'Partner assigned. Pickup has not been confirmed.';
    if(this.hasPickedUp())return this.gpsStale() ? 'The last location update is older than expected.' : 'Your partner has picked up the order.';
    return this.statusLabel();
  });
  readonly journeySteps = computed(() => {
    const status=this.currentStatus();
    const stage=status==='delivered'?4:this.hasPickedUp()?3:['preparing','packed','ready','ready_for_pickup','delivery_assigned'].includes(status)?2:['confirmed','vendor_accepted'].includes(status)?1:0;
    const events=this.steps();
    return [
      {name:'Order placed',statuses:['placed','created'],pending:'Pending'},
      {name:'Store confirmed',statuses:['confirmed','vendor_accepted'],pending:'Waiting for the store'},
      {name:'Preparing your order',statuses:['preparing','packed','ready','ready_for_pickup'],pending:'Waiting for the store'},
      {name:'On the way',statuses:['picked_up','on_the_way','out_for_delivery','arrived_at_customer'],pending:'After confirmed pickup'},
      {name:'Delivered',statuses:['delivered'],pending:'We will update you here'},
    ].map((step,index)=>({name:step.name,done:index<stage,current:index===stage,time:events.find(event=>step.statuses.includes(event.status)&&event.time)?.time || (index>stage ? step.pending : 'Time unavailable')}));
  });
  @ViewChildren('trackingMap') trackingMaps?: QueryList<
    ElementRef<HTMLElement>
  >;
  private readonly routeParams = toSignal(this.route.paramMap);
  tracking = signal<any[]>([]);
  connection = signal('Connecting to live updates');
  private trackingRequest = 0;
  cancellationPolicy = signal<any>(null);
  cancelOpen = signal(false);
  cancelReason = signal('');
  cancelling = signal(false);
  cancelError = signal('');
  clock = signal(Date.now());
  gpsUpdate = signal<any>(null);
  detailError = computed(
    () => this.orders.detailErrors()[this.routeParams()?.get('id') || ''] || ''
  );
  canCancel = computed(() => {
    const policy = this.cancellationPolicy();
    const raw = this.order().raw;
    const placed = Date.parse(raw?.placed_at || '');
    return (
      !!policy &&
      !!raw &&
      policy.allowed_statuses?.includes(raw.status) &&
      (Number(policy.window_minutes) <= 0 ||
        (Number.isFinite(placed) &&
          this.clock() - placed < Number(policy.window_minutes) * 60000))
    );
  });
  stageCopy = computed(() => {
    const status = this.currentStatus();
    if (!this.terminal() && this.connection().includes('interrupted')) return 'Your order is still here.';
    if (['picked_up', 'on_the_way', 'out_for_delivery'].includes(status) && this.gpsStale()) return 'On the way. Location delayed.';
    const assignment = this.order().raw?.assignment_status;
    const messages: Record<string, string> = {
      placed: 'Your order is with the store.',
      confirmed: 'Accepted, with care.',
      preparing: 'Good things are coming together.',
      ready:
        assignment === 'searching' || assignment === 'notified'
          ? 'Finding a delivery partner.'
          : this.partner() ? 'Your partner is on the way to the store.' : 'Packed and ready.',
      delivery_assigned: 'Your partner is heading to the store.',
      picked_up: 'A little closer to your door.',
      on_the_way: 'A little closer to your door.',
      out_for_delivery: 'A little closer to your door.',
      arrived_at_customer: 'Your partner has arrived.',
      delivered: 'Good things, delivered.',
      cancelled: 'This order was cancelled.',
      refunded: 'This order was refunded.',
    };
    return messages[status] || this.statusLabel();
  });
  gpsLabel = computed(() => {
    this.clock();
    const gps = this.gpsUpdate();
    if (!gps) return 'Waiting for a delivery partner location.';
    const timestamp = Date.parse(gps.timestamp || '');
    return Number.isFinite(timestamp)
      ? (this.clock() - timestamp > 120000
          ? 'Last known location · '
          : 'Location updated · ') +
          new Date(timestamp).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })
      : 'Last known location · update time unavailable';
  });
  cancel(): void {
    if (this.cancelling() || !this.canCancel()) return;
    if (!this.cancelReason().trim()) {
      this.cancelError.set('Choose a reason for cancelling.');
      requestAnimationFrame(() =>
        document.getElementById('cancel-reason')?.focus()
      );
      return;
    }
    this.cancelling.set(true);
    this.cancelError.set('');
    const session=this.auth.sessionVersion;
    const id=this.order().id;
    this.orders.cancelOrder(this.order(), this.cancelReason()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if(session!==this.auth.sessionVersion || id!==this.routeParams()?.get('id'))return;
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.loadTracking(this.order().id);
      },
      error: (error) => {
        if(session!==this.auth.sessionVersion || id!==this.routeParams()?.get('id'))return;
        this.cancelling.set(false);
        this.cancelError.set(
          error.body?.error ||
            error.error?.error ||
            'Cancellation could not be confirmed. Refresh the order before trying again.'
        );
        this.orders.refreshOrder(this.order().id);
      },
    });
  }

  mapReady = signal(false);
  mapUnavailable = signal(false);
  trackingError = signal('');
  lastTrackingRefresh = signal<Date | null>(null);
  liveEtaMinutes = signal<number | null>(null);
  receiptOpen = signal(false);
  receiptError = signal('');
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
    @Inject(API_BASE_URL) private apiBaseUrl: string
  ) {
    this.orderApi
      .cancellationPolicy().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (policy) => this.cancellationPolicy.set(policy),
        error: () => this.cancellationPolicy.set(null),
      });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      this.stopAutoRefresh();
      this.closeTrackingSocket();
      this.tracking.set([]);
      this.gpsUpdate.set(null);
      this.lastTrackingRefresh.set(null);
      this.liveEtaMinutes.set(null);
      this.trackingError.set('');
      this.cancelOpen.set(false);
      this.cancellationBlocked.set(false);
      this.receiptOpen.set(false);
      this.receiptError.set('');
      this.showDetails.set(false);
      if (id) {
        this.orders.refreshOrder(id);
        this.loadTracking(id);
        this.connectTrackingSocket(id);
        this.startAutoRefresh(id);
      }
    });
    effect(() => {
      this.auth.currentUser();
      if(this.authSession===this.auth.sessionVersion)return;
      this.authSession=this.auth.sessionVersion;
      ++this.trackingRequest;
      this.stopAutoRefresh();this.closeTrackingSocket();
      this.tracking.set([]);this.gpsUpdate.set(null);this.cancelOpen.set(false);this.cancellationBlocked.set(false);
      if(!this.auth.isLoggedIn())this.router.navigate(['/']);
    });
    effect(() => {
      this.currentCoordinate();
      window.setTimeout(() => this.refreshMapMarker(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.mapHostChanges = this.trackingMaps?.changes.subscribe(() =>
      this.initGoogleMap()
    );
    window.setTimeout(() => this.initGoogleMap(), 0);
  }

  ngOnDestroy(): void {
    this.trackingRequest++;
    this.mapHostChanges?.unsubscribe();
    this.stopAutoRefresh();
    this.closeTrackingSocket();
    this.currentMarker?.setMap?.(null);
    this.map = null;
    this.mapHost = null;
  }

  order = computed(() =>
    this.orders.getOrder(this.routeParams()?.get('id') || null)
  );
  partner = computed(() => {
    const partner = this.order().raw?.delivery_partner_info;
    return shouldShowDeliveryPartner(partner) ? partner : null;
  });
  currentStatus = computed(() =>
    this.normalizeStatusKey(this.order().raw?.status || this.order().status)
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
    const orderStatus = this.normalizeStatusKey(
      order.raw?.status || order.status
    );
    if (
      orderStatus &&
      !normalized.some((entry: any) => entry.status === orderStatus)
    ) {
      normalized.push({ status: orderStatus, timestamp: null });
    }
    if (!normalized.some((entry: any) => entry.status === 'placed')) {
      normalized.unshift({ status: 'placed', timestamp: null });
    }
    const deduped = normalized.filter(
      (entry, index, list) =>
        list.findIndex((item) => item.status === entry.status) === index
    );
    deduped.sort(
      (a, b) => this.statusWeight(a.status) - this.statusWeight(b.status)
    );

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
    const status = this.normalizeStatusKey(
      this.order().raw?.status || this.order().status
    );
    const currentWeight = this.statusWeight(status);
    const timelineMap = new Map(
      this.steps().map((step: any) => [step.status, step.time])
    );
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
    if (
      typeof liveEta === 'number' &&
      Number.isFinite(liveEta) &&
      liveEta > 0
    ) {
      return `${Math.round(liveEta)} mins`;
    }
    const raw = this.order().raw?.estimated_delivery_time;
    if (raw === null || raw === undefined) return 'Estimate pending';
    const rawText = String(raw).trim();
    if (!rawText) return 'Estimate pending';
    const numeric = Number(rawText);
    if (Number.isFinite(numeric) && numeric > 0) return `${numeric} mins`;
    return rawText;
  });
  hasPickedUp = computed(() => {
    const status = String(
      this.order().raw?.status || this.order().status || ''
    ).toLowerCase();
    const hasPickupTracking = this.tracking().some((entry) =>
      String(entry?.status || '')
        .toLowerCase()
        .includes('pick')
    );
    return (
      hasPickupTracking ||
      status.includes('pick') ||
      status.includes('way') ||
      status.includes('deliver')
    );
  });
  mapStageLabel = computed(() =>
    this.hasPickedUp() ? 'Delivery route is active' : 'Pickup is at the store'
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
  currentCoordinate = computed(
    () =>
      this.driverCoordinate() ||
      (!this.hasPickedUp() ? this.vendorCoordinate() : null)
  );
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
    const request = ++this.trackingRequest;
    const session=this.auth.sessionVersion;
    this.trackingError.set('');
    this.orderApi.getOrderTracking(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (
          request !== this.trackingRequest || session!==this.auth.sessionVersion ||
          id !== this.routeParams()?.get('id')
        )
          return;
        this.tracking.set(
          Array.isArray(response)
            ? response
            : response.results || response.tracking || []
        );
        this.lastTrackingRefresh.set(new Date());
        this.refreshMapMarker();
      },
      error: () => {
        if (
          request !== this.trackingRequest || session!==this.auth.sessionVersion ||
          id !== this.routeParams()?.get('id')
        )
          return;
        this.trackingError.set('Could not refresh live tracking updates.');
      },
    });
  }

  retryTracking(): void {
    const id = this.routeParams()?.get('id');
    if (!id) return;
    this.orders.refreshOrder(id);
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
        action === 'zoom-in' ? 'Map loading' : 'Map loading'
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
        if(this.destroyRef.destroyed)return;
        const coordinate = this.currentCoordinate();
        if (!coordinate) {
          this.mapUnavailable.set(true);
          return;
        }
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
      title: this.hasPickedUp()
        ? 'Current delivery location'
        : 'Store pickup location',
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
    if(this.order().id==='loading' || !this.auth.isLoggedIn())return;
    this.receiptError.set('');this.receiptOpen.set(true);
  }
  receiptDownloaded():void {this.state.showToast('Receipt downloaded','success');}

  itemUnit(item: any): string {
    return item.raw?.product_unit || item.raw?.unit || 'item';
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
    if (key.includes('ready') || key.includes('assign'))
      return 'local_shipping';
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
      this.clock.set(Date.now());
      this.orders.refreshOrder(id);
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
      this.normalizeStatusKey(status)
    );
  }

  private connectTrackingSocket(id: string): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined')
      return;
    if (this.isTerminalStatus(this.currentStatus())) {
      this.connection.set('Order complete');
      return;
    }

    this.connection.set('Connecting to live updates');
    this.closeTrackingSocket(false);
    this.websocketClosedByComponent = false;

    try {
      const socket = openAuthenticatedWebSocket(
        `/ws/delivery/${id}/tracking/`,
        this.session.getAccessToken(),
        this.apiBaseUrl
      );
      this.trackingSocket = socket;
      socket.onopen = () => {
        this.connection.set('Live connection open');
        this.clearWebsocketReconnect();
      };
      socket.onmessage = (event) => this.applySocketTrackingMessage(event.data);
      socket.onerror = () => {
        this.connection.set(
          'Live connection interrupted · status refresh continues'
        );
        this.scheduleWebsocketReconnect(id);
      };
      socket.onclose = () => {
        this.connection.set(
          'Live connection interrupted · status refresh continues'
        );
        if (
          !this.websocketClosedByComponent &&
          !this.isTerminalStatus(this.currentStatus())
        ) {
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
    if (
      (payload.lat == null && payload.latitude == null) ||
      (payload.lng == null && payload.longitude == null) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return;

    this.gpsUpdate.set({
      latitude: lat,
      longitude: lng,
      timestamp: payload.timestamp || null,
    });
    this.lastTrackingRefresh.set(new Date());
    this.refreshMapMarker();
  }

  private scheduleWebsocketReconnect(id: string): void {
    if (typeof window === 'undefined' || this.websocketReconnectTimer !== null)
      return;
    this.websocketReconnectTimer = window.setTimeout(() => {
      this.websocketReconnectTimer = null;
      this.connectTrackingSocket(id);
    }, 5000);
  }

  private clearWebsocketReconnect(): void {
    if (
      this.websocketReconnectTimer !== null &&
      typeof window !== 'undefined'
    ) {
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
    return this.coordinateFrom(this.gpsUpdate());
  }
  private coordinateFrom(value: any): { lat: number; lng: number } | null {
    const latitude = value?.lat ?? value?.latitude;
    const longitude = value?.lng ?? value?.longitude;
    if (
      latitude == null ||
      longitude == null ||
      latitude === '' ||
      longitude === ''
    )
      return null;
    const lat = Number(latitude),
      lng = Number(longitude);
    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
      ? { lat, lng }
      : null;
  }

}
