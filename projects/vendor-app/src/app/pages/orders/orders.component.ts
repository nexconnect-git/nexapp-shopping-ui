import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  VendorApi,
  AppCurrencyPipe,
  Order,
  ToastService,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';
import { VendorOrderActionsService } from '../../services/vendor-order-actions.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(VendorApi);
  private toast = inject(ToastService);
  private orderActions = inject(VendorOrderActionsService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  updatingId = signal<string | null>(null);

  // Pagination
  page = signal(1);
  total = signal(0);
  totalPages = signal(1);
  readonly pageSize = 20;
  Math = Math;

  statusFilter = signal('');
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.updatingId()) this.load();
    });
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.statusFilter()) params.status = this.statusFilter();
    this.api.getVendorOrders(params).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(
          Math.ceil((r.count || (r.results || r).length) / this.pageSize) || 1,
        );
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
    });
  }

  onFilterChange(status: string) {
    this.statusFilter.set(status);
    this.page.set(1);
    this.load();
  }

  statusFilterLabel(): string {
    const value = this.statusFilter();
    if (!value) return 'All Statuses';
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
      this.load();
    }
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const range: number[] = [];
    const delta = 2;
    for (
      let i = Math.max(1, cur - delta);
      i <= Math.min(total, cur + delta);
      i++
    ) {
      range.push(i);
    }
    return range;
  }

  updateStatus(order: Order, status: string) {
    this.updatingId.set(order.id);
    this.orderActions.run(order.id, 'set_status', { status }).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
        this.toast.show(`Order updated to "${status}".`, 'success');
      },
      error: (e) => {
        this.updatingId.set(null);
        this.toast.show(
          this.orderActions.errorMessage(e, 'Failed to update order.'),
          'error',
        );
      },
    });
  }
}
