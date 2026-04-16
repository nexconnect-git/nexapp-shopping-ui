import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe, DatePipe],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss'
})
export class WalletComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  transactions = signal<any[]>([]);

  // We can fetch the wallet_balance directly from vendor profile or calculate it
  walletBalance = signal<number>(0);

  ngOnInit() {
    this.loadProfile();
    this.loadTransactions();
  }

  loadProfile() {
    this.api.getVendorProfile().subscribe({
      next: (profile: any) => {
        // Assume wallet_balance is returned
        this.walletBalance.set(profile.wallet_balance || 0);
      }
    });
  }

  loadTransactions() {
    this.loading.set(true);
    this.api.getVendorWalletTransactions().subscribe({
      next: (res: any) => {
        this.transactions.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load wallet transactions.', 'error');
        this.loading.set(false);
      }
    });
  }

  formatTransactionType(type: string): string {
    const map: any = {
      'credit': 'Credit',
      'debit': 'Debit'
    };
    return map[type] || type;
  }

  getTypeClass(type: string): string {
    return type === 'credit' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  }
}
