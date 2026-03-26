import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-active-delivery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './active-delivery.component.html',
  styleUrls: ['./active-delivery.component.scss']
})
export class ActiveDeliveryComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  private sub?: Subscription;

  // OTP + photo modal state
  confirmModalOrder = signal<Order | null>(null);
  confirmOtp = signal('');
  confirmPhoto = signal<File | null>(null);
  confirmError = signal('');
  confirming = signal(false);

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getDeliveryDashboard().subscribe({
      next: (d) => { this.orders.set(d.active_orders || []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  updateStatus(order: Order, status: string) {
    this.api.updateDeliveryStatus(order.id, status).subscribe({ next: () => this.load() });
  }

  openConfirmModal(order: Order) {
    this.confirmModalOrder.set(order);
    this.confirmOtp.set('');
    this.confirmPhoto.set(null);
    this.confirmError.set('');
  }

  closeConfirmModal() {
    this.confirmModalOrder.set(null);
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
    this.confirming.set(true);
    this.confirmError.set('');
    this.api.confirmDelivery(order.id, otp, this.confirmPhoto() || undefined).subscribe({
      next: () => { this.confirming.set(false); this.closeConfirmModal(); this.load(); },
      error: (err) => {
        this.confirming.set(false);
        this.confirmError.set(err.error?.error || 'Failed to confirm delivery. Check the OTP and try again.');
      }
    });
  }
}
