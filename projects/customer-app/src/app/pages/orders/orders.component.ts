import { Component, computed, effect, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { normalizeOrderStatus } from '@shared/lib/models/adapters';
import { OrderService } from '../../services/order.service';
import { UiService } from '../../services/ui.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { Order } from '../../models';
import { AuthService } from '../../services/auth.service';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    CustomerIconComponent,
    BreadcrumbsComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    AppCurrencyPipe,
    DisplayOrderIdPipe,
    CustomerLockedStateComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent {
  activeTab = signal('All Orders');
  searchQuery = signal('');
  tabs = ['All Orders', 'Active', 'Delivered', 'Cancelled'];
  private searchTimer?: ReturnType<typeof setTimeout>;
  chooseTab(tab: string): void {
    clearTimeout(this.searchTimer);
    this.activeTab.set(tab);
    this.orders.loadOrders(
      1,
      tab === 'All Orders' ? '' : tab.toLowerCase(),
      this.searchQuery()
    );
  }
  search(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () =>
        this.orders.loadOrders(
          1,
          this.activeTab() === 'All Orders'
            ? ''
            : this.activeTab().toLowerCase(),
          value
        ),
      250
    );
  }
  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  constructor(
    public orders: OrderService,
    public ui: UiService,
    public auth: AuthService,
    private router: Router
  ) {
    effect(() => {
      if (this.auth.currentUser()) untracked(() => this.retryLoad());
    });
  }

  filteredOrders = computed(() => this.orders.orders());

  itemCount(order: Order): number | null {
    const items = order.raw?.items;
    if (!items?.length || items.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) return null;
    return items.reduce((total, item) => total + Number(item.quantity), 0);
  }

  itemDescription(order: Order): string {
    return order.items.map((item,index) => { const quantity=Number(order.raw?.items?.[index]?.quantity); return Number.isFinite(quantity) && quantity>0 ? `${quantity} × ${item.name}` : item.name; }).join(' · ');
  }

  submitSearch(): void {
    clearTimeout(this.searchTimer);
    this.retryLoad();
  }

  browseStores(): void { this.router.navigate(['/stores']); }

  count(tab: string): number {
    return (
      this.orders.summary()[tab === 'All Orders' ? 'all' : tab.toLowerCase()] ??
      0
    );
  }

  retryLoad(): void {
    this.orders.loadOrders(1,this.activeTab() === 'All Orders' ? '' : this.activeTab().toLowerCase(),this.searchQuery());
  }

  reorder(order: Order, event: Event): void {
    this.orders.reorder(order, event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
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
      order.raw?.normalized_status || order.raw?.status || order.status
    );
  }
}
