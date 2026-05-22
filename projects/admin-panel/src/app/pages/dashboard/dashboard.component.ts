import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  AppCurrencyPipe,
  AuthService,
  openAuthenticatedWebSocket,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  stats = signal<any>(null);
  recentOrders = signal<any[]>([]);
  topVendors = signal<any[]>([]);
  loadingStats = signal(true);
  loadingOrders = signal(true);
  loadingVendors = signal(true);
  ordersError = signal('');
  vendorsError = signal('');
  private sub?: Subscription;
  private ws: WebSocket | null = null;

  readonly heroActions = [
    {
      route: '/orders',
      icon: 'receipt_long',
      label: 'Live orders',
      primary: true,
    },
    {
      route: '/delivery-partners',
      icon: 'two_wheeler',
      label: 'Dispatch fleet',
      primary: false,
    },
  ];

  readonly orderFlowItems = [
    { label: 'Placed', key: 'pending_orders', className: 'warn' },
    { label: 'Preparing', key: 'preparing_orders', className: 'info' },
    { label: 'Completed', key: 'completed_orders', className: 'good' },
    { label: 'Cancelled', key: 'cancelled_orders', className: 'bad' },
  ];

  readonly actionQueueItems = [
    {
      route: '/vendors',
      icon: 'how_to_reg',
      statKey: 'pending_vendors',
      title: 'vendor reviews',
      description: 'KYC, store profile, and operational readiness',
    },
    {
      route: '/delivery-partners',
      icon: 'badge',
      statKey: 'pending_delivery_partners',
      title: 'partner approvals',
      description: 'Identity, vehicle, assets, and city coverage',
    },
    {
      route: '/issues',
      icon: 'report_problem',
      title: 'Customer exceptions',
      description:
        'Refunds, damaged goods, missing items, and delivery disputes',
    },
  ];

  ngOnInit() {
    // Fire HTTP immediately so the UI never hangs waiting for WS handshake
    this.loadStatsHttp();
    this.connectWebSocket();
    // Refresh tables independently every 30 seconds
    this.sub = timer(0, 30000).subscribe(() => this.refreshTables());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Immediate HTTP fallback — resolves before WS handshake completes. */
  loadStatsHttp() {
    this.api.getAdminStats().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loadingStats.set(false);
      },
      error: () => this.loadingStats.set(false),
    });
  }

  connectWebSocket() {
    this.ws = openAuthenticatedWebSocket(
      '/sa/ws/admin/stats/',
      this.auth.getToken(),
    );

    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      // WS updates overwrite HTTP result with fresh live data
      if (data.type === 'stats_update' && data.data) {
        this.stats.set(data.data);
        this.loadingStats.set(false);
      }
    };

    // WS error is no longer the sole fallback — HTTP already ran
    this.ws.onerror = () => {
      if (this.loadingStats()) {
        this.loadStatsHttp();
      }
    };
  }

  refreshTables() {
    this.ordersError.set('');
    this.vendorsError.set('');

    this.api
      .getAdminOrders({ page_size: 5, ordering: '-placed_at' })
      .subscribe({
        next: (r) => {
          this.recentOrders.set((r.results ?? r).slice(0, 5));
          this.loadingOrders.set(false);
        },
        error: (e) => {
          this.loadingOrders.set(false);
          this.ordersError.set(
            e?.error?.detail || 'Failed to load transactions',
          );
        },
      });

    this.api
      .getAdminVendors({
        status: 'approved',
        ordering: '-average_rating',
        page_size: 5,
      })
      .subscribe({
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

  statNumber(key: string): number {
    return Number(this.stats()?.[key] ?? 0);
  }

  openOrderCount(): number {
    return (
      this.statNumber('pending_orders') +
      this.statNumber('confirmed_orders') +
      this.statNumber('preparing_orders') +
      this.statNumber('ready_orders')
    );
  }

  flowPercent(value: number): number {
    return (value / (this.statNumber('total_orders') || 1)) * 100;
  }

  starsFor(r: number) {
    const f = Math.round(r);
    return '★'.repeat(f) + '☆'.repeat(5 - f);
  }
}
