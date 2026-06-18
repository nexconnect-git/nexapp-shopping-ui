import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [RouterLink, BreadcrumbsComponent, AppCurrencyPipe],
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
      icon: 'favorite',
      label: 'Wishlist',
      sub: 'Saved items',
      path: '/wishlist',
    },
    {
      icon: 'local_offer',
      label: 'Offers',
      sub: 'Coupons and deals',
      path: '/offers',
    },
    {
      icon: 'account_balance_wallet',
      label: 'Wallet',
      sub: 'Balance and payment options',
      path: '/wallet',
    },
    {
      icon: 'group_add',
      label: 'Referrals',
      sub: 'Invite friends and rewards',
      path: '/referral',
    },
    {
      icon: 'notifications',
      label: 'Notifications',
      sub: 'Order and account alerts',
      path: '/notifications',
    },
    {
      icon: 'support_agent',
      label: 'Help & Support',
      sub: 'Get help with orders',
      path: '/help',
    },
    {
      icon: 'sms_failed',
      label: 'Issues',
      sub: 'Your support tickets',
      path: '/issues',
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
