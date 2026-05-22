import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  ToastService,
  VendorAnalytics,
} from '@shared/public-api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe],
  templateUrl: './sales-report.component.html',
  styleUrl: './sales-report.component.scss',
})
export class SalesReportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);

  stats = signal<VendorAnalytics | null>(null);
  dateRange = signal('30'); // days

  // Settlement summary metrics
  totalSettled = signal(0);
  pendingSettled = signal(0);
  failedSettled = signal(0);

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    forkJoin({
      stats: this.api.getVendorAnalytics({ days: this.dateRange() }),
      payouts: this.api.getVendorPayouts(),
    }).subscribe({
      next: (res: any) => {
        this.stats.set(res.stats);

        let settled = 0;
        let pending = 0;
        let failed = 0;

        const allPayouts = res.payouts.results || res.payouts || [];
        for (const p of allPayouts) {
          const amt = parseFloat(p.net_payout || 0);
          if (p.status === 'paid' || p.status === 'verified') {
            settled += amt;
          } else if (p.status === 'failed') {
            failed += amt;
          } else {
            // all other states (pending_approval, scheduled, pending_verify) are pending
            pending += amt;
          }
        }

        this.totalSettled.set(settled);
        this.pendingSettled.set(pending);
        this.failedSettled.set(failed);

        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load sales report.', 'error');
        this.loading.set(false);
      },
    });
  }

  onRangeChange() {
    this.loadStats();
  }

  mathMax(a: number, b: number): number {
    return Math.max(a, b);
  }

  exportCsv() {
    const stats = this.stats();
    if (!stats) return;
    const rows = [
      ['Metric', 'Value'],
      ['Period', stats.period_label],
      ['Total revenue', stats.total_revenue],
      ['Total orders', stats.total_orders],
      ['Delivered orders', stats.delivered_orders],
      ['Average order value', stats.average_order_value],
      ['Repeat customers', stats.repeat_customers],
      ['Coupon revenue influenced', stats.coupon_contribution?.revenue || 0],
      ['Coupon uses', stats.coupon_contribution?.usage_count || 0],
      ['Low stock products', stats.low_stock_impact?.low_stock_count || 0],
      [],
      ['Top product', 'Units sold', 'Revenue'],
      ...stats.top_products.map((p) => [p.name, p.total_sold, p.revenue]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-growth-${this.dateRange()}-days.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
