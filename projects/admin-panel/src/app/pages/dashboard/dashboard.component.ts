import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  stats = signal<any>(null);
  recentOrders = signal<any[]>([]);
  topVendors = signal<any[]>([]);
  loadingStats = signal(true);
  loadingOrders = signal(true);
  loadingVendors = signal(true);
  ordersError = signal('');
  vendorsError = signal('');
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 30000).subscribe(() => this.refresh());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  refresh() {
    this.loadingStats.set(true);
    this.loadingOrders.set(true);
    this.loadingVendors.set(true);
    this.ordersError.set('');
    this.vendorsError.set('');

    this.api.getAdminStats().subscribe({
      next: (s) => { this.stats.set(s); this.loadingStats.set(false); },
      error: () => this.loadingStats.set(false),
    });

    this.api.getAdminOrders({ page_size: 5, ordering: '-placed_at' }).subscribe({
      next: (r) => {
        this.recentOrders.set((r.results ?? r).slice(0, 5));
        this.loadingOrders.set(false);
      },
      error: (e) => {
        this.loadingOrders.set(false);
        this.ordersError.set(e?.error?.detail || 'Failed to load transactions');
      },
    });

    this.api.getAdminVendors({ status: 'approved', ordering: '-average_rating', page_size: 5 }).subscribe({
      next: (r) => {
        this.topVendors.set((r.results ?? r).slice(0, 5));
        this.loadingVendors.set(false);
      },
      error: (e) => {
        this.loadingVendors.set(false);
        this.vendorsError.set(e?.error?.detail || 'Failed to load vendors');
      },
    });
  }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
