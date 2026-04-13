import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, AuthService, Order, OrderTracking } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, RouterLink, GoogleMapsModule],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.scss'
})
export class OrderTrackingComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);

  order = signal<Order | null>(null);
  tracking = signal<OrderTracking[]>([]);
  loading = signal(true);
  private sub?: Subscription;

  // Map center / zoom (used by <google-map> bindings)
  center: google.maps.LatLngLiteral = {lat: 12.9716, lng: 77.5946};
  zoom = 14;

  // Marker positions
  driverPosition?: google.maps.LatLngLiteral;
  vendorPosition?: google.maps.LatLngLiteral;
  customerPosition?: google.maps.LatLngLiteral;

  // Marker options — set after Maps API is ready
  driverMarkerOptions: google.maps.MarkerOptions = {};
  vendorMarkerOptions: google.maps.MarkerOptions = {};
  customerMarkerOptions: google.maps.MarkerOptions = {};
  mapOptions: google.maps.MapOptions = {};

  etaMinutes = signal<number | null>(null);

  // Native Maps objects for directions (created in onMapReady)
  private directionsService?: google.maps.DirectionsService;
  private directionsRenderer?: google.maps.DirectionsRenderer;
  private lastDirectionsTime = 0;
  private directionsEnabled = true;

  private ws: WebSocket | null = null;
  private animFrameId?: number;

  readonly orderSteps = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered'];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = timer(0, 5000).subscribe(() => {
      this.api.getOrder(id).subscribe({
        next: (o) => {
          this.order.set(o);
          this.tracking.set(o.tracking || []);
          this.loading.set(false);
          this.api.getOrderTracking(id).subscribe({ next: (t) => this.tracking.set(t.results || t) });
          this.updateMapPositions(o);
          if (o.estimated_delivery_time) this.etaMinutes.set(o.estimated_delivery_time);
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

  /** Called by (mapInitialized) output on <google-map> — fires when the map is ready. */
  onMapReady(nativeMap: google.maps.Map) {
    // Clean up any previous renderer
    this.directionsRenderer?.setMap(null);

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,       // We use our own custom markers
      preserveViewport: false,     // Fit to route on first load
      polylineOptions: {
        strokeColor: '#6C63FF',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    this.directionsRenderer.setMap(nativeMap);
    this.lastDirectionsTime = 0;   // Reset throttle so first request always fires

    // If positions are already loaded, fit bounds and request route
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
    this.mapOptions = {
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      clickableIcons: false,
    };
    this.driverMarkerOptions = {
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/micons/motorcycling.png',
        scaledSize: new google.maps.Size(42, 42),
        anchor: new google.maps.Point(21, 21),
      },
      zIndex: 10,
      title: 'Delivery Partner',
    };
    this.vendorMarkerOptions = {
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png',
        scaledSize: new google.maps.Size(34, 34),
      },
      zIndex: 5,
      title: 'Restaurant',
    };
    this.customerMarkerOptions = {
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png',
        scaledSize: new google.maps.Size(34, 34),
      },
      zIndex: 5,
      title: 'Your Location',
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

    const waypoints: google.maps.DirectionsWaypoint[] = [];
    if (this.driverPosition && this.vendorPosition && this.order()?.status === 'ready') {
      waypoints.push({location: new google.maps.LatLng(this.vendorPosition.lat, this.vendorPosition.lng), stopover: false});
    }

    this.directionsService.route(
      {origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING},
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
    const wsUrl = `ws://${window.location.host}/ws/delivery/${orderId}/tracking/?token=${this.auth.getToken()}`;
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
            this.lastDirectionsTime = 0; // Force fresh route on first fix
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
        this.driverPosition = {
          lat: from.lat + (to.lat - from.lat) * ease,
          lng: from.lng + (to.lng - from.lng) * ease,
        };
      });
      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.zone.run(() => {
          this.driverPosition = to;
          this.requestDirections(); // Request updated route when animation ends
        });
      }
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  private closeWs() {
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  showLiveMap(): boolean {
    const s = this.order()?.status;
    return ['confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'].includes(s ?? '');
  }

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
}
