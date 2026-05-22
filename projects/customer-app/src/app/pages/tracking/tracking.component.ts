import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  shouldShowDeliveryPartner,
  trackingCurrentCoordinate,
} from '@nexconnect/customer-checkout';
import {
  ApiService,
  AppCurrencyPipe,
  GoogleMapsService,
} from '@shared/public-api';
import { OrderService } from '../../services/order.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';

declare const google: any;

@Component({
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe, DisplayOrderIdPipe],
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.scss'],
})
export class TrackingComponent implements AfterViewInit, OnDestroy {
  @ViewChild('trackingMap') trackingMap?: ElementRef<HTMLElement>;
  tracking = signal<any[]>([]);
  mapReady = signal(false);
  mapUnavailable = signal(false);
  private map: any = null;
  private currentMarker: any = null;
  private mapInitialized = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public orders: OrderService,
    private state: AppStateService,
    private googleMaps: GoogleMapsService,
  ) {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadTracking(id);
    effect(() => {
      this.currentCoordinate();
      window.setTimeout(() => this.refreshMapMarker(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.initGoogleMap();
  }

  ngOnDestroy(): void {
    this.currentMarker?.setMap?.(null);
    this.map = null;
  }

  order = computed(() =>
    this.orders.getOrder(this.route.snapshot.paramMap.get('id')),
  );
  partner = computed(() => {
    const partner = this.order().raw?.delivery_partner_info;
    return shouldShowDeliveryPartner(partner) ? partner : null;
  });
  partnerImage = computed(() => {
    const partner = this.partner() as any;
    return partner?.photo || partner?.avatar || partner?.image || '';
  });
  steps = computed(() => {
    const order = this.order();
    const tracking = this.tracking().length
      ? this.tracking()
      : order.raw?.tracking || [];
    if (tracking.length) {
      return tracking.map((entry: any) => ({
        icon: this.iconFor(entry.status),
        name: this.labelFor(entry.status),
        time: entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      }));
    }
    return [
      {
        icon: this.iconFor('placed'),
        name: 'Order Confirmed',
        time: order.time || '',
      },
      { icon: this.iconFor('preparing'), name: 'Preparing', time: '' },
      { icon: this.iconFor('on_the_way'), name: 'Out for Delivery', time: '' },
      {
        icon: this.iconFor('delivered'),
        name: order.status === 'Delivered' ? 'Delivered' : 'Arriving soon',
        time: order.status === 'Delivered' ? order.time : 'Upcoming',
      },
    ];
  });
  currentCoordinate = computed(() =>
    trackingCurrentCoordinate({
      driver: this.driverCoordinate(),
      destination: this.destinationCoordinate(),
      vendor: this.vendorCoordinate(),
    }),
  );
  directionsUrl = computed(() => {
    const origin = this.currentCoordinate();
    const destination = this.destinationCoordinate();
    if (!origin || !destination) return '';
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
  });

  private loadTracking(id: string): void {
    this.api.getOrderTracking(id).subscribe({
      next: (response) => {
        this.tracking.set(
          Array.isArray(response)
            ? response
            : response.results || response.tracking || [],
        );
        this.refreshMapMarker();
      },
      error: () => this.tracking.set([]),
    });
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

  private initGoogleMap(): void {
    this.googleMaps
      .loadJavaScriptApi()
      .then(() => {
        const coordinate = this.currentCoordinate() || {
          lat: 12.9716,
          lng: 77.5946,
        };
        const element = this.trackingMap?.nativeElement;
        if (!element || this.mapInitialized) return;
        this.mapInitialized = true;
        this.map = new google.maps.Map(element, {
          center: coordinate,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          styles: this.mapStyles(),
        });
        this.mapReady.set(true);
        this.refreshMapMarker();
      })
      .catch(() => this.mapUnavailable.set(true));
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
      title: 'Current delivery location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#6d3bff',
        fillOpacity: 1,
        strokeColor: '#ffffff',
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
    this.router.navigate(['/wallet']);
  }

  downloadInvoice(): void {
    this.state.showToast('Invoice download started');
  }

  private labelFor(status: string): string {
    return String(status || 'update')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private iconFor(status: string): string {
    const key = String(status || '').toLowerCase();
    if (key.includes('deliver')) return 'task_alt';
    if (key.includes('way') || key.includes('pick')) return 'two_wheeler';
    if (key.includes('prepar') || key.includes('pack')) return 'inventory_2';
    return 'task_alt';
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
}
