import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  VendorAnalytics,
  VendorPayoutPage,
  VendorWorkspaceApi,
} from '@shared/public-api';
@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './sales-report.component.html',
  styleUrl: './sales-report.component.scss',
})
export class SalesReportComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private generation = 0;
  readonly stats = signal<VendorAnalytics | null>(null);
  readonly days = signal('30');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly finance = signal<VendorPayoutPage | null>(null);
  readonly financeLoading = signal(false);
  readonly financeError = signal('');
  readonly maximumMonthly = computed(() =>
    Math.max(
      1,
      ...(this.stats()?.monthly_data.map((month) => Number(month.revenue)) ||
        [])
    )
  );
  readonly maximumProduct = computed(() =>
    Math.max(
      1,
      ...(this.stats()?.top_products.map((product) =>
        Number(product.revenue)
      ) || [])
    )
  );
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        const days = params.get('days') || '30';
        this.days.set(['7', '30', '90', 'all'].includes(days) ? days : '30');
        this.loadStats();
      });
    this.loadFinance();
  }
  range(value: string): void {
    void this.router.navigate([], { queryParams: { days: value } });
  }
  loadStats(): void {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.api
      .analytics(this.days())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (stats) => {
          if (generation !== this.generation) return;
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: (failure) => {
          if (generation === this.generation) {
            this.loading.set(false);
            this.error.set(
              apiErrorMessage(failure, 'Sales analytics could not be loaded.')
            );
          }
        },
      });
  }
  loadFinance(): void {
    this.financeLoading.set(true);
    this.financeError.set('');
    this.api
      .payouts({ page: 1 })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (finance) => {
          this.finance.set(finance);
          this.financeLoading.set(false);
        },
        error: (failure) => {
          this.financeLoading.set(false);
          this.financeError.set(
            apiErrorMessage(failure, 'Settlement summary could not be loaded.')
          );
        },
      });
  }
  exportCsv(): void {
    const stats = this.stats();
    if (!stats || this.loading() || this.error()) return;
    const rows: unknown[][] = [
      ['Metric', 'Value'],
      ['Period', stats.period_label],
      ['Delivered revenue', stats.total_revenue],
      ['Placed orders', stats.total_orders],
      ['Delivered orders', stats.delivered_orders],
      ['Average delivered order', stats.average_order_value],
      ['Repeat customers', stats.repeat_customers],
      [
        'Coupon influenced delivered revenue',
        stats.coupon_contribution.revenue,
      ],
      ['Coupon discount', stats.coupon_contribution.discount],
      ['Coupon uses', stats.coupon_contribution.usage_count],
      ['Current low stock products', stats.low_stock_impact.low_stock_count],
      [],
      ['Product', 'Delivered units', 'Revenue'],
      ...stats.top_products.map((product) => [
        product.name,
        product.total_sold,
        product.revenue,
      ]),
      [],
      ['Month', 'Delivered revenue', 'Delivered orders'],
      ...stats.monthly_data.map((month) => [
        month.month,
        month.revenue,
        month.orders,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '');
            if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(',')
      )
      .join('\r\n');
    const url = URL.createObjectURL(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = `vendor-sales-${this.days()}-days.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
