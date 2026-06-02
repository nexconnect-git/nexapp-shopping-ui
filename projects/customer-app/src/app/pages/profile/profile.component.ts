import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { ApiService } from '@shared/lib/services/api.service';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { CurrencyService } from '@shared/lib/services/currency.service';
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
      label: 'My Orders',
      sub: 'View your order history',
      path: '/orders',
    },
    {
      icon: 'favorite',
      label: 'Wishlist',
      sub: 'Items you saved for later',
      path: '/wishlist',
    },
    {
      icon: 'local_offer',
      label: 'Offers',
      sub: 'Available offers and coupons',
      path: '/offers',
    },
    {
      icon: 'support_agent',
      label: 'Help & Support',
      sub: 'Get help and contact support',
      path: '/help',
    },
  ];

  walletBalance = signal(0);
  walletActivity = signal<
    Array<{ icon: string; title: string; sub: string; amount: string }>
  >([]);
  rewardAmount = signal(0);
  totalOrders = computed(
    () =>
      this.orders.orders().length ||
      this.auth.currentUser()?.ordersDelivered ||
      0,
  );
  activities = computed(() => {
    const orderActivity = this.orders
      .orders()
      .slice(0, 3)
      .map((order) => ({
        icon: order.status === 'Delivered' ? 'local_shipping' : 'shopping_bag',
        title:
          order.status === 'Delivered' ? 'Order Delivered' : 'Order Placed',
        sub: [order.date, order.time].filter(Boolean).join(', '),
        amount: this.currency.format(order.amount),
      }));
    return [...orderActivity, ...this.walletActivity()].slice(0, 4);
  });

  constructor(
    public ui: UiService,
    public state: AppStateService,
    public auth: AuthService,
    public orders: OrderService,
    private api: ApiService,
    private currency: CurrencyService,
    private router: Router,
  ) {
    this.loadWallet();
    this.loadReferral();
  }

  editAddress(): void {
    this.ui.openEdit('address');
  }

  manageMembership(): void {
    this.state.showToast('Nextou One membership management is coming soon');
  }

  editProfile(): void {
    this.ui.openEdit('profile');
  }

  viewActivity(): void {
    this.router.navigate(['/orders']);
  }

  private loadWallet(): void {
    this.api.getWallet().subscribe({
      next: (wallet) => {
        this.walletBalance.set(Number(wallet.balance || wallet.amount || 0));
        const txns = wallet.transactions || wallet.recent_transactions || [];
        this.walletActivity.set(
          txns.slice(0, 4).map((txn: any) => {
            const amount = Number(txn.amount || 0);
            return {
              icon: 'account_balance_wallet',
              title: txn.description || txn.type || 'Wallet transaction',
              sub: txn.created_at
                ? new Date(txn.created_at).toLocaleString()
                : '',
              amount: `${amount >= 0 ? '+' : ''}${this.currency.format(amount)}`,
            };
          }),
        );
      },
      error: () => {
        this.walletBalance.set(0);
        this.walletActivity.set([]);
      },
    });
  }

  private loadReferral(): void {
    this.api.getReferral().subscribe({
      next: (referral) =>
        this.rewardAmount.set(
          Number(
            referral.total_earned ||
              referral.reward_balance ||
              referral.rewards ||
              0,
          ),
        ),
      error: () => this.rewardAmount.set(0),
    });
  }
}
