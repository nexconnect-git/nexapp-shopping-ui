import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, AppCurrencyPipe],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);

  payments = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);

  methodFilter = '';
  verifiedFilter = '';
  search = '';
  private searchTimer: any;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.methodFilter) params.method = this.methodFilter;
    if (this.verifiedFilter !== '') params.verified = this.verifiedFilter;
    if (this.search.trim()) params.search = this.search.trim();
    this.api.getAdminPayments(params).subscribe({
      next: (r) => {
        this.payments.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  applyFilters() { this.page.set(1); this.load(); }

  setPage(p: number) { this.page.set(p); this.load(); }

  paymentMethodLabel(m: string): string {
    return m === 'razorpay' ? 'Razorpay' : 'Cash on Delivery';
  }

  statusLabel(p: any): string {
    if (p.status === 'cancelled') return 'Cancelled';
    if (p.payment_method === 'cod') return 'COD';
    if (p.is_payment_verified) return 'Paid';
    return 'Pending';
  }

  statusClass(p: any): string {
    if (p.status === 'cancelled') return 'badge-cancelled';
    if (p.payment_method === 'cod') return 'badge-cod';
    if (p.is_payment_verified) return 'badge-paid';
    return 'badge-pending';
  }

  get totalRevenue(): number {
    return this.payments().filter(p => p.is_payment_verified || p.payment_method === 'cod')
      .reduce((sum, p) => sum + Number(p.total || 0), 0);
  }

  get razorpayRevenue(): number {
    return this.payments().filter(p => p.is_payment_verified && p.payment_method === 'razorpay')
      .reduce((sum, p) => sum + Number(p.total || 0), 0);
  }

  get pendingCount(): number {
    return this.payments().filter(p => p.payment_method === 'razorpay' && !p.is_payment_verified && p.status !== 'cancelled').length;
  }
}
