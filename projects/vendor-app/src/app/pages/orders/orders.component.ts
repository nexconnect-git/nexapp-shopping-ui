import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Order, ToastService } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  updatingId = signal<string | null>(null);
  statusFilter = '';
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.updatingId()) this.load();
    });
  }

  manualReload() { this.load(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getVendorOrders(this.statusFilter || undefined).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
    });
  }

  updateStatus(order: Order, status: string) {
    this.updatingId.set(order.id);
    this.api.updateOrderStatus(order.id, status).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
        this.toast.show(`Order updated to "${status}".`, 'success');
      },
      error: (e) => {
        this.updatingId.set(null);
        this.toast.show(e?.error?.error || 'Failed to update order.', 'error');
      },
    });
  }
}
