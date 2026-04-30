import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AlertService, ApiService } from '@shared/public-api';

declare const Razorpay: any;

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss',
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  balance = signal<string>('0.00');
  transactions = signal<any[]>([]);
  loading = signal(true);

  topUpAmount = signal<number | null>(null);
  topUpLoading = signal(false);
  showTopUpForm = signal(false);

  ngOnInit() {
    this.loadWallet();
  }

  loadWallet() {
    this.loading.set(true);
    this.api.getWallet().subscribe({
      next: (data) => {
        this.balance.set(data.balance);
        this.transactions.set(data.transactions || []);
        this.loading.set(false);
      },
      error: () => {
        this.alerts.error('Failed to load wallet.');
        this.loading.set(false);
      },
    });
  }

  openTopUp() {
    this.topUpAmount.set(null);
    this.showTopUpForm.set(true);
  }

  cancelTopUp() {
    this.showTopUpForm.set(false);
    this.topUpAmount.set(null);
  }

  initiateTopUp() {
    const amount = this.topUpAmount();
    if (!amount || amount < 1) {
      this.alerts.error('Minimum top-up amount is ₹1.');
      return;
    }
    this.topUpLoading.set(true);
    this.api.initiateWalletTopUp(amount).subscribe({
      next: (order) => {
        this.topUpLoading.set(false);
        this.openRazorpay(order, amount);
      },
      error: (err) => {
        this.topUpLoading.set(false);
        this.alerts.error(err.error?.detail || 'Failed to initiate top-up.');
      },
    });
  }

  private openRazorpay(order: any, amount: number) {
    const options = {
      key: order.key_id || order.razorpay_key_id || '',
      amount: order.amount,
      currency: order.currency,
      name: 'NexConnect',
      description: 'Wallet Top-up',
      order_id: order.razorpay_order_id,
      handler: (response: any) => {
        this.verifyTopUp(response, order.razorpay_order_id, amount);
      },
      prefill: {},
      theme: { color: '#6C63FF' },
      modal: { ondismiss: () => this.alerts.warning('Top-up cancelled.', 'Top-up stopped') },
    };
    const rz = new Razorpay(options);
    rz.open();
  }

  private verifyTopUp(response: any, orderId: string, amount: number) {
    this.topUpLoading.set(true);
    this.api.verifyWalletTopUp({
      razorpay_order_id: orderId,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      amount,
    }).subscribe({
      next: (data) => {
        this.topUpLoading.set(false);
        this.balance.set(data.balance);
        this.showTopUpForm.set(false);
        this.alerts.success('Wallet topped up successfully!');
        this.loadWallet();
      },
      error: (err) => {
        this.topUpLoading.set(false);
        this.alerts.error(err.error?.detail || 'Payment verification failed.');
      },
    });
  }

  txIcon(source: string): string {
    const map: Record<string, string> = {
      topup: 'add_circle',
      refund: 'replay',
      order_payment: 'shopping_bag',
      admin: 'admin_panel_settings',
    };
    return map[source] || 'swap_horiz';
  }

  txSign(type: string): string {
    return type === 'credit' ? '+' : '-';
  }

  txClass(type: string): string {
    return type === 'credit' ? 'credit' : 'debit';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  hasTransactions(): boolean {
    return this.transactions().length > 0;
  }
}
