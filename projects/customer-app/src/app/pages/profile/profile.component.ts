import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    AppCurrencyPipe,
    CustomerLockedStateComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  quickLinks = [
    {
      icon: 'shopping_bag',
      label: 'Orders',
      sub: 'History, reorder, invoices',
      path: '/orders',
    },
    {
      icon: 'location_on',
      label: 'Addresses',
      sub: 'Manage delivery locations',
      path: '/addresses',
    },
    {
      icon: 'shopping_cart',
      label: 'Cart',
      sub: 'Review your current basket',
      path: '/cart',
    },
  ];

  totalOrders = computed(
    () =>
      this.orders.orders().length ||
      this.auth.currentUser()?.ordersDelivered ||
      0,
  );

  constructor(
    public ui: UiService,
    public state: AppStateService,
    public auth: AuthService,
    public orders: OrderService,
    private router: Router,
  ) {}

  editAddress(): void {
    this.ui.openEdit('address');
  }

  editProfile(): void {
    this.ui.openEdit('profile');
  }

  viewActivity(): void {
    this.router.navigate(['/orders']);
  }

}
