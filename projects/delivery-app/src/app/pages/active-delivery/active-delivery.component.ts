import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Order, PaymentQR } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { AuthService } from '@shared/public-api';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-active-delivery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './active-delivery.component.html',
  styleUrls: ['./active-delivery.component.scss']
})
export class ActiveDeliveryComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  private sub?: Subscription;
  
  // Geotracking State
  private watchId?: number;
  private wsConns: Map<string, WebSocket> = new Map();

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

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.stopLocationTracking();
  }

  // --- Tracking Broadcast ---
  private startLocationTracking() {
    if (environment.production) {
      console.log('Live location tracking is disabled in production.');
      return;
    }
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.broadcastLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
  }

  private stopLocationTracking() {
    if (this.watchId !== undefined && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.wsConns.forEach(ws => ws.close());
    this.wsConns.clear();
  }

  private broadcastLocation(lat: number, lng: number) {
    const currentOrders = this.orders();
    if (!currentOrders || currentOrders.length === 0) return;
    
    currentOrders.forEach(order => {
      // Connect specifically for 'on_the_way' or 'picked_up'
      if (order.status !== 'delivered' && order.status !== 'cancelled') {
        let ws = this.wsConns.get(order.id);
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          ws = this.connectTrackerSocket(order.id);
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'update_location',
            lat: lat,
            lng: lng,
            partner_id: this.auth.user()?.id
          }));
        }
      }
    });
  }

  private connectTrackerSocket(orderId: string): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/delivery/${orderId}/tracking/?token=${this.auth.getToken()}`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log(`Connected tracking socket for order ${orderId}`);
    ws.onerror = (err) => console.error('WS Error:', err);
    this.wsConns.set(orderId, ws);
    return ws;
  }

  load() {
    this.loading.set(true);
    this.api.getDeliveryDashboard().subscribe({
      next: (d) => { this.orders.set(d.active_orders || []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  navigateToVendor(order: Order) {
    const lat = order.vendor_info?.latitude;
    const lng = order.vendor_info?.longitude;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  }

  navigateToCustomer(order: Order) {
    const lat = order.delivery_latitude;
    const lng = order.delivery_longitude;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  }

  setOnTheWay(order: Order) {
    this.api.setDeliveryOnTheWay(order.id).subscribe({ next: () => this.load() });
  }

  cancelAssignment(order: Order) {
    if (!confirm('Cancel this delivery? The system will find another partner.')) return;
    this.api.cancelDeliveryAssignment(order.id).subscribe({ next: () => this.load() });
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
      next: (qr) => { this.paymentQR.set(qr); this.loadingQR.set(false); },
      error: () => this.loadingQR.set(false)
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
    if (!otp) { this.confirmError.set('Please enter the OTP from the customer.'); return; }
    if (!this.confirmPhoto()) { this.confirmError.set('Please take a delivery photo.'); return; }

    this.confirming.set(true);
    this.confirmError.set('');
    this.api.confirmDelivery(order.id, otp, this.confirmPhoto()!).subscribe({
      next: () => { this.confirming.set(false); this.closeConfirmModal(); this.load(); },
      error: (err) => {
        this.confirming.set(false);
        this.confirmError.set(err.error?.error || 'Failed. Check the OTP and try again.');
      }
    });
  }
}


