import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { normalizeOrderStatus } from '@shared/lib/models/adapters';
import { OrderService } from '../../services/order.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { Order } from '../../models';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbsComponent,
    AppCurrencyPipe,
    DisplayOrderIdPipe,
  ],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent {
  activeTab = signal('All Orders');
  searchQuery = signal('');
  tabs = ['All Orders', 'Active', 'Delivered', 'Cancelled'];
  Math = Math;

  constructor(
    public orders: OrderService,
    public ui: UiService,
    private state: AppStateService,
  ) {}

  filteredOrders = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();
    return this.orders.orders().filter((order) => {
      if (tab !== 'All Orders' && this.statusBucket(order) !== tab) return false;
      if (!query) return true;
      const haystack = [
        order.id,
        order.raw?.order_number,
        order.status,
        order.payment,
        ...order.items.map((item) => item.name),
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });
  });
  totalSpent = computed(() =>
    this.orders.orders().reduce((total, order) => total + order.amount, 0),
  );

  count(tab: string): number {
    if (tab === 'All Orders') return this.orders.orders().length;
    return this.orders.orders().filter((order) => this.statusBucket(order) === tab)
      .length;
  }

  chooseDateRange(): void {
    this.state.showToast('Showing recent orders');
  }

  retryLoad(): void {
    this.orders.loadOrders();
  }

  reorder(order: Order): void {
    this.orders.reorder(order);
  }

  storeName(order: Order): string {
    const raw = order.raw as any;
    return (
      raw?.vendor_info?.store_name ||
      raw?.vendor?.store_name ||
      raw?.vendor_name ||
      (order as any).vendorName ||
      order.items?.[0]?.storeName ||
      'Store'
    );
  }

  statusLabel(order: Order): string {
    const status = this.statusKey(order);
    const labels: Record<string, string> = {
      created: 'Placed',
      placed: 'Placed',
      pending_payment: 'Payment pending',
      confirmed: 'Confirmed',
      vendor_accepted: 'Accepted',
      preparing: 'Preparing',
      packed: 'Packed',
      ready: 'Ready',
      ready_for_pickup: 'Ready',
      delivery_assigned: 'Driver assigned',
      picked_up: 'Picked up',
      out_for_delivery: 'On the way',
      on_the_way: 'On the way',
      arrived_at_customer: 'Arriving',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    };
    return labels[status] || order.status || 'Active';
  }

  statusBadgeClass(order: Order): 'green' | 'red' | 'purple' {
    if (this.isDelivered(order)) return 'green';
    if (this.isCancelled(order)) return 'red';
    return 'purple';
  }

  isDelivered(order: Order): boolean {
    return this.statusKey(order) === 'delivered';
  }

  isCancelled(order: Order): boolean {
    const status = this.statusKey(order);
    return status === 'cancelled' || status === 'refunded';
  }

  isActive(order: Order): boolean {
    return !this.isDelivered(order) && !this.isCancelled(order);
  }

  private statusBucket(order: Order): string {
    if (this.isCancelled(order)) return 'Cancelled';
    if (this.isDelivered(order)) return 'Delivered';
    return 'Active';
  }

  private statusKey(order: Order): string {
    return normalizeOrderStatus(
      order.raw?.normalized_status || order.raw?.status || order.status,
    );
  }
}
