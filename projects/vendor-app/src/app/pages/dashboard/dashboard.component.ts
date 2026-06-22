import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  VendorApi,
  AppCurrencyPipe,
  AuthService,
  DashboardStats,
  Product,
  ToastService,
  VendorOperationsSummary,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(VendorApi);
  private toast = inject(ToastService);
  private router = inject(Router);
  auth = inject(AuthService);

  stats = signal<DashboardStats | null>(null);
  ops = signal<VendorOperationsSummary | null>(null);
  storeSettings = signal<any | null>(null);
  loading = signal(true);
  private sub?: Subscription;

  // Store toggle
  storeToggling = signal(false);
  showStoreModal = signal(false);
  closingTime = '22:00';

  // Stock check modal
  showStockModal = signal(false);
  stockProducts = signal<(Product & { newStock: number })[]>([]);
  stockMode: 'new' | 'previous' = 'previous';
  stockSubmitting = signal(false);
  stockHasWarnings = signal(false);

  // Delete confirm modal
  deleteTarget = signal<Product | null>(null);
  deleting = signal(false);

  onboardingItems = computed(() => {
    const stats = this.stats();
    const settings = this.storeSettings();
    const totalProducts = Number(stats?.total_products || 0);
    const storeOpen = this.isStoreOpen();
    return [
      {
        label: 'Complete store profile',
        caption: 'Add your store name, phone, and business email.',
        done: !!(settings?.store_name && settings?.phone && settings?.email),
        route: '/store-settings',
      },
      {
        label: 'Add store location',
        caption: 'Set the exact pickup address and map pin for drivers.',
        done: !!(
          settings?.address &&
          settings?.city &&
          settings?.state &&
          settings?.postal_code &&
          settings?.latitude &&
          settings?.longitude
        ),
        route: '/store-settings',
      },
      {
        label: 'Set business hours',
        caption: 'Define opening and closing times for daily ordering.',
        done: !!(settings?.opening_time && settings?.closing_time),
        route: '/store-settings',
      },
      {
        label: 'Complete payout setup',
        caption:
          'Add bank and verification details when payout setup is available.',
        done: false,
        route: '/payouts',
      },
      {
        label: 'Add first product',
        caption: 'Create a sellable item from the shared catalog.',
        done: totalProducts > 0,
        route: '/products/new',
      },
      {
        label: 'Review inventory readiness',
        caption: 'Keep available products stocked and ready to sell.',
        done: totalProducts > 0 && Number(stats?.low_stock_count || 0) === 0,
        route: '/inventory',
      },
      {
        label: 'Open store for orders',
        caption: 'Go online only when profile, stock, and team are ready.',
        done: storeOpen && this.isAcceptingOrders(),
        route: '/',
      },
    ];
  });

  onboardingCompleteCount = computed(
    () => this.onboardingItems().filter((item) => item.done).length,
  );

  onboardingPercent = computed(() => {
    const total = this.onboardingItems().length || 1;
    return Math.round((this.onboardingCompleteCount() / total) * 100);
  });

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      this.api.getVendorDashboard().subscribe({
        next: (s) => {
          this.stats.set(s);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      this.api.getVendorOperationsSummary().subscribe({
        next: (summary) => this.ops.set(summary),
        error: () => {},
      });
      this.api.getVendorStoreSettings().subscribe({
        next: (settings) => this.storeSettings.set(settings),
        error: () => {},
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ── Store toggle ──────────────────────────────────────────────────────────

  toggleStore() {
    const current = this.stats()?.is_open;
    if (current) {
      // Close immediately
      this.storeToggling.set(true);
      this.api.setStoreStatus(false).subscribe({
        next: (r) => {
          this.stats.update((s) => (s ? { ...s, is_open: false } : s));
          this.ops.update((o) =>
            o
              ? {
                  ...o,
                  store: {
                    ...o.store,
                    is_open: false,
                    is_accepting_orders: false,
                  },
                }
              : o,
          );
          this.storeToggling.set(false);
          this.toast.show('Store is now closed.', 'info');
        },
        error: () => {
          this.storeToggling.set(false);
          this.toast.show('Failed to update store status.', 'error');
        },
      });
    } else {
      // Open flow — show modal to pick closing time first
      this.showStoreModal.set(true);
    }
  }

  confirmOpenStore() {
    if (!this.closingTime) {
      this.toast.show('Please enter a closing time.', 'error');
      return;
    }
    const requireStockCheck = this.stats()?.require_stock_check;
    if (requireStockCheck) {
      // Need stock check before going online
      this.showStoreModal.set(false);
      this._openStockModal();
    } else {
      this._goOnline();
    }
  }

  private _goOnline() {
    this.storeToggling.set(true);
    this.api.setStoreStatus(true, this.closingTime).subscribe({
      next: (r) => {
        this.stats.update((s) =>
          s ? { ...s, is_open: true, closing_time: r.closing_time } : s,
        );
        this.ops.update((o) =>
          o
            ? {
                ...o,
                store: {
                  ...o.store,
                  is_open: true,
                  is_accepting_orders: true,
                  closing_time: r.closing_time,
                },
              }
            : o,
        );
        this.storeToggling.set(false);
        this.showStoreModal.set(false);
        this.showStockModal.set(false);
        this.toast.show('Store is now online!', 'success');
      },
      error: () => {
        this.storeToggling.set(false);
        this.toast.show('Failed to open store.', 'error');
      },
    });
  }

  // ── Stock check modal ─────────────────────────────────────────────────────

  private _openStockModal() {
    const products = (this.stats()?.low_stock_products || []) as Product[];
    // Include ALL products if mode=new, or just load from vendor products
    this.api.getVendorProducts().subscribe({
      next: (r) => {
        const all: Product[] = r.results || r;
        this.stockProducts.set(all.map((p) => ({ ...p, newStock: p.stock })));
        this.stockMode = 'previous';
        this._checkWarnings();
        this.showStockModal.set(true);
      },
      error: () => {
        this.showStoreModal.set(true);
        this.showStockModal.set(false);
        this.storeToggling.set(false);
        this.toast.show(
          'Could not load products for the required stock check. Retry before opening the store.',
          'error',
        );
      },
    });
  }

  onStockModeChange() {
    if (this.stockMode === 'new') {
      // Reset all stocks to 0 for vendor to enter fresh quantities
      this.stockProducts.update((ps) => ps.map((p) => ({ ...p, newStock: 0 })));
    } else {
      // Restore current stock values
      this.stockProducts.update((ps) =>
        ps.map((p) => ({ ...p, newStock: p.stock })),
      );
    }
    this._checkWarnings();
  }

  onStockInput() {
    this._checkWarnings();
  }

  private _checkWarnings() {
    const hasWarn = this.stockProducts().some(
      (p) => p.low_stock_threshold > 0 && p.newStock <= p.low_stock_threshold,
    );
    this.stockHasWarnings.set(hasWarn);
  }

  submitStock() {
    if (this.stockHasWarnings()) {
      return;
    }
    this.stockSubmitting.set(true);
    const updates = this.stockProducts().map((p) => ({
      id: p.id,
      stock: p.newStock,
    }));
    this.api.bulkUpdateVendorStock(updates).subscribe({
      next: () => {
        this.stockSubmitting.set(false);
        this._goOnline();
      },
      error: () => {
        this.stockSubmitting.set(false);
        this.toast.show('Failed to update stock.', 'error');
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  viewOrder(orderId: string) {
    this.router.navigate(['/orders', orderId]);
  }

  isLowStock(p: Product & { newStock: number }): boolean {
    return p.low_stock_threshold > 0 && p.newStock <= p.low_stock_threshold;
  }

  isStoreOpen(): boolean {
    return !!this.stats()?.is_open;
  }

  isAcceptingOrders(): boolean {
    return this.isStoreOpen() && !!this.ops()?.store?.is_accepting_orders;
  }

  storeModeTitle(): string {
    if (this.isAcceptingOrders()) return 'Accepting orders';
    if (this.isStoreOpen()) return 'Not accepting orders';
    return 'Closed right now';
  }

  storeModeCaption(): string {
    if (this.isAcceptingOrders() && this.stats()?.closing_time) {
      return `Taking orders until ${this.stats()!.closing_time}`;
    }
    if (this.isStoreOpen())
      return 'Store is online, but order intake is paused.';
    return 'Open when stock and team are ready.';
  }
}
