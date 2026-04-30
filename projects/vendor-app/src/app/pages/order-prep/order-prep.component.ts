import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, Order, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-order-prep',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './order-prep.component.html',
  styleUrl: './order-prep.component.scss'
})
export class OrderPrepComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  order = signal<Order | null>(null);
  loading = signal(true);
  busy = signal(false);
  checkedItems = signal<Record<string, boolean>>({});
  otp = '';
  otpError = signal('');

  progress = computed(() => {
    const order = this.order();
    if (!order?.items.length) return 0;
    const done = order.items.filter(item => this.checkedItems()[item.id]).length;
    return Math.round((done / order.items.length) * 100);
  });

  elapsedMinutes = computed(() => {
    const order = this.order();
    if (!order) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(order.placed_at).getTime()) / 60000));
  });

  ngOnInit() { this.load(); }

  load() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading.set(true);
    this.api.getVendorOrder(id).subscribe({
      next: (order) => {
        this.order.set(order);
        const existing = this.checkedItems();
        const next: Record<string, boolean> = {};
        order.items.forEach((item: any) => next[item.id] = existing[item.id] ?? false);
        this.checkedItems.set(next);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load order prep.', 'error');
      }
    });
  }

  toggleItem(id: string, checked: boolean) {
    this.checkedItems.update(v => ({ ...v, [id]: checked }));
  }

  accept() { this.run(() => this.api.acceptVendorOrder(this.order()!.id), 'Order accepted.'); }
  startPreparing() { this.run(() => this.api.startPreparingVendorOrder(this.order()!.id), 'Prep started.'); }
  markReady() { this.run(() => this.api.markVendorOrderReady(this.order()!.id), 'Order marked ready.'); }
  findDriver() { this.run(() => this.api.startDeliverySearch(this.order()!.id), 'Delivery search started.'); }
  cancelSearch() { this.run(() => this.api.cancelDeliverySearch(this.order()!.id), 'Delivery search cancelled.'); }

  verifyOtp() {
    if (!this.otp.trim()) {
      this.otpError.set('Enter the pickup OTP.');
      return;
    }
    this.busy.set(true);
    this.otpError.set('');
    this.api.verifyPickupOtp(this.order()!.id, this.otp.trim()).subscribe({
      next: (order) => {
        this.order.set(order);
        this.otp = '';
        this.busy.set(false);
        this.toast.show('Pickup verified.', 'success');
      },
      error: (err) => {
        this.busy.set(false);
        this.otpError.set(err.error?.error || 'Invalid pickup OTP.');
      }
    });
  }

  private run(request: () => any, message: string) {
    this.busy.set(true);
    request().subscribe({
      next: (order: Order) => {
        this.order.set(order);
        this.busy.set(false);
        this.toast.show(message, 'success');
      },
      error: (err: any) => {
        this.busy.set(false);
        this.toast.show(err.error?.error || 'Action failed.', 'error');
      }
    });
  }
}
