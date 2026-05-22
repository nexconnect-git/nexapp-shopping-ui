import { Component, signal } from '@angular/core';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { AppStateService } from '../../services/app-state.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

declare const Razorpay: any;

@Component({
  standalone: true,
  imports: [BreadcrumbsComponent, AppCurrencyPipe],
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
})
export class WalletComponent {
  balance = signal(0);
  transactions = signal<
    Array<{ icon: string; title: string; date: string; amount: number }>
  >([]);
  topUpLoading = signal(false);

  constructor(
    private api: ApiService,
    private state: AppStateService,
  ) {
    this.load();
  }

  load(): void {
    this.api.getWallet().subscribe({
      next: (wallet) => {
        this.balance.set(Number(wallet.balance || wallet.amount || 0));
        const txns = wallet.transactions || wallet.recent_transactions || [];
        this.transactions.set(
          txns.map((txn: any) => ({
            icon: Number(txn.amount || 0) >= 0 ? '+' : '-',
            title: txn.description || txn.type || 'Wallet transaction',
            date: txn.created_at
              ? new Date(txn.created_at).toLocaleString()
              : '',
            amount: Number(txn.amount || 0),
          })),
        );
      },
      error: () => {
        this.balance.set(0);
        this.transactions.set([]);
      },
    });
  }

  addMoney(amount = 500): void {
    this.topUpLoading.set(true);
    this.api.initiateWalletTopUp(amount).subscribe({
      next: (order) => {
        this.topUpLoading.set(false);
        this.openRazorpay(order, amount);
      },
      error: (error) => {
        this.topUpLoading.set(false);
        this.state.showToast(
          error?.error?.detail || 'Could not start wallet top-up',
        );
      },
    });
  }

  viewAllTransactions(): void {
    this.state.showToast('Showing recent wallet transactions');
  }

  manageMembership(): void {
    this.state.showToast(
      'Membership details are not available from the server yet',
    );
  }

  private openRazorpay(order: any, amount: number): void {
    this.loadRazorpayScript()
      .then(() => {
        const checkout = new Razorpay({
          key: order.key_id || order.razorpay_key_id || '',
          amount: order.amount,
          currency: order.currency,
          name: 'FlashDrop',
          description: 'Wallet Top-up',
          order_id: order.razorpay_order_id,
          handler: (response: any) =>
            this.verifyTopUp(response, order.razorpay_order_id, amount),
          modal: { ondismiss: () => this.state.showToast('Top-up cancelled') },
          theme: { color: '#13a35b' },
        });
        checkout.open();
      })
      .catch(() => this.state.showToast('Payment provider is not available'));
  }

  private verifyTopUp(response: any, orderId: string, amount: number): void {
    this.topUpLoading.set(true);
    this.api
      .verifyWalletTopUp({
        razorpay_order_id: orderId,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        amount,
      })
      .subscribe({
        next: (wallet) => {
          this.topUpLoading.set(false);
          this.balance.set(Number(wallet.balance ?? this.balance()));
          this.load();
          this.state.showToast('Wallet topped up successfully');
        },
        error: (error) => {
          this.topUpLoading.set(false);
          this.state.showToast(
            error?.error?.detail || 'Payment verification failed',
          );
        },
      });
  }

  private loadRazorpayScript(): Promise<void> {
    if (typeof Razorpay !== 'undefined') return Promise.resolve();
    if (typeof document === 'undefined') return Promise.reject();
    const existing = document.getElementById('razorpay-checkout-js');
    if (existing) {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (typeof Razorpay !== 'undefined') {
            window.clearInterval(timer);
            resolve();
          } else if (Date.now() - startedAt > 10000) {
            window.clearInterval(timer);
            reject();
          }
        }, 80);
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }
}
