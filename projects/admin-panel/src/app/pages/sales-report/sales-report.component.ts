import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ApiService, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-report.component.html',
  styleUrl: './sales-report.component.scss'
})
export class SalesReportComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  stats   = signal<any>(null);

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.api.getAdminStats().subscribe({
      next: (res) => {
        // Normalise: accept both alias-key sets so the template always works
        // regardless of which key the backend returns first.
        const s = res ?? {};
        this.stats.set({
          total_vendors:           s.total_vendors           ?? s.vendors            ?? 0,
          total_products:          s.total_products          ?? s.products           ?? 0,
          total_customers:         s.total_customers         ?? s.customers          ?? 0,
          total_delivery_partners: s.total_delivery_partners ?? s.delivery_partners  ?? 0,
          total_orders:            s.total_orders            ?? s.orders             ?? 0,
          pending_orders:          s.pending_orders          ?? s.orders_placed      ?? 0,
          completed_orders:        s.completed_orders        ?? s.orders_delivered   ?? 0,
          cancelled_orders:        s.cancelled_orders        ?? s.orders_cancelled   ?? 0,
          total_revenue:           s.total_revenue           ?? 0,
        });
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load platform sales report.', 'error');
        this.loading.set(false);
      }
    });
  }
}
