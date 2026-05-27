import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/public-api';
import { OrderService } from '../../services/order.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { DisplayOrderIdPipe } from '../../shared/display-order-id.pipe';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
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
  tabs = ['All Orders', 'Active', 'Delivered', 'Cancelled'];
  Math = Math;

  constructor(
    public orders: OrderService,
    public ui: UiService,
    private state: AppStateService,
  ) {}

  filteredOrders = computed(() => {
    const tab = this.activeTab();
    if (tab === 'All Orders') return this.orders.orders();
    return this.orders
      .orders()
      .filter(
        (order) => order.status === (tab === 'Cancelled' ? 'Cancelled' : tab),
      );
  });
  totalSpent = computed(() =>
    this.orders.orders().reduce((total, order) => total + order.amount, 0),
  );

  count(tab: string): number {
    if (tab === 'All Orders') return this.orders.orders().length;
    return this.orders
      .orders()
      .filter(
        (order) => order.status === (tab === 'Cancelled' ? 'Cancelled' : tab),
      ).length;
  }

  chooseDateRange(): void {
    this.state.showToast('Showing recent orders');
  }
}
