import { AdminCanDirective } from '../../shared/admin-can.directive';
import { AdminAccessService } from '../../services/admin-access.service';
import { AdminLiveSocket, openAdminLiveSocket } from '../../services/admin-live-socket';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  API_BASE_URL,
  ApiService,
  AppCurrencyPipe,
  AuthService,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AdminCanDirective,CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  access=inject(AdminAccessService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private apiBaseUrl = inject(API_BASE_URL);

  stats = signal<any>(null);
  recentOrders = signal<any[]>([]);
  topVendors = signal<any[]>([]);
  loadingStats = signal(true);
  loadingOrders = signal(true);
  loadingVendors = signal(true);
  statsError = signal('');
  lastUpdated = signal<Date | null>(null);
  readonly today = new Date();
  ordersError = signal('');
  vendorsError = signal('');
  private sub?: Subscription;
  ws: AdminLiveSocket | null = null;

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
    { label: 'Awaiting fulfillment', key: 'awaiting_fulfillment', className: 'info' },
    { label: 'In transit', key: 'orders_delivering', className: 'transit' },
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
    this.sub = timer(0, 30000).subscribe(() => {if(!document.hidden){this.refreshTables();this.loadStatsHttp();}});
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
    this.statsError.set('');
    this.api.getAdminStats().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loadingStats.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.loadingStats.set(false);
        this.statsError.set('The overview could not be loaded. Please try again.');
      },
    });
  }

  connectWebSocket() {
    this.ws = openAdminLiveSocket(
      '/ws/admin/stats/',
      () => this.auth.getToken(),
      this.apiBaseUrl,
    );

    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      // WS updates overwrite HTTP result with fresh live data
      if (data.type === 'stats_update' && data.data) {
        this.stats.set(data.data);
        this.loadingStats.set(false);
        this.statsError.set('');
        this.lastUpdated.set(new Date());
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

    if(this.access.can('orders.view'))this.api
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

    if(this.access.can('vendors.view'))this.api
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
    if (key === 'awaiting_fulfillment') {
      return Math.max(0, this.statNumber('total_orders') - this.statNumber('pending_orders')
        - this.statNumber('orders_delivering') - this.statNumber('completed_orders') - this.statNumber('cancelled_orders'));
    }
    return Number(this.stats()?.[key] ?? 0);
  }

  openOrderCount(): number {
    return Math.max(0, this.statNumber('total_orders') - this.statNumber('completed_orders') - this.statNumber('cancelled_orders'));
  }

  orderFlowGradient(): string {
    const colors = ['#b79aee', '#7185ea', '#63bdd0', '#67b99a', '#e7a1ad'];
    let offset = 0;
    const stops = this.orderFlowItems.map((item, index) => {
      const start = offset;
      offset += this.flowPercent(this.statNumber(item.key));
      return `${colors[index]} ${start}% ${offset}%`;
    });
    return this.statNumber('total_orders') ? `conic-gradient(${stops.join(',')})` : '#e8ecf3';
  }

  flowPercent(value: number): number {
    return (value / (this.statNumber('total_orders') || 1)) * 100;
  }

  starsFor(r: number) {
    const f = Math.round(r);
    return '★'.repeat(f) + '☆'.repeat(5 - f);
  }
}
