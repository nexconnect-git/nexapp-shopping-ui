import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, DashboardStats, AuthService, ToastService, Product, VendorOperationsSummary } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  auth = inject(AuthService);

  stats = signal<DashboardStats | null>(null);
  ops = signal<VendorOperationsSummary | null>(null);
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

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      this.api.getVendorDashboard().subscribe({
        next: (s) => { this.stats.set(s); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
      this.api.getVendorOperationsSummary().subscribe({
        next: (summary) => this.ops.set(summary),
        error: () => {}
      });
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ── Store toggle ──────────────────────────────────────────────────────────

  toggleStore() {
    const current = this.stats()?.is_open;
    if (current) {
      // Close immediately
      this.storeToggling.set(true);
      this.api.setStoreStatus(false).subscribe({
        next: (r) => {
          this.stats.update(s => s ? { ...s, is_open: false } : s);
          this.storeToggling.set(false);
          this.toast.show('Store is now closed.', 'info');
        },
        error: () => { this.storeToggling.set(false); this.toast.show('Failed to update store status.', 'error'); }
      });
    } else {
      // Open flow — show modal to pick closing time first
      this.showStoreModal.set(true);
    }
  }

  confirmOpenStore() {
    if (!this.closingTime) {
      this.toast.show('Please enter a closing time.', 'error'); return;
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
        this.stats.update(s => s ? { ...s, is_open: true, closing_time: r.closing_time } : s);
        this.storeToggling.set(false);
        this.showStoreModal.set(false);
        this.showStockModal.set(false);
        this.toast.show('Store is now online!', 'success');
      },
      error: () => { this.storeToggling.set(false); this.toast.show('Failed to open store.', 'error'); }
    });
  }

  // ── Stock check modal ─────────────────────────────────────────────────────

  private _openStockModal() {
    const products = (this.stats()?.low_stock_products || []) as Product[];
    // Include ALL products if mode=new, or just load from vendor products
    this.api.getVendorProducts().subscribe({
      next: (r) => {
        const all: Product[] = r.results || r;
        this.stockProducts.set(all.map(p => ({ ...p, newStock: p.stock })));
        this.stockMode = 'previous';
        this._checkWarnings();
        this.showStockModal.set(true);
      },
      error: () => {
        // Still proceed without stock check if fetch fails
        this.toast.show('Could not load products, proceeding anyway.', 'info');
        this._goOnline();
      }
    });
  }

  onStockModeChange() {
    if (this.stockMode === 'new') {
      // Reset all stocks to 0 for vendor to enter fresh quantities
      this.stockProducts.update(ps => ps.map(p => ({ ...p, newStock: 0 })));
    } else {
      // Restore current stock values
      this.stockProducts.update(ps => ps.map(p => ({ ...p, newStock: p.stock })));
    }
    this._checkWarnings();
  }

  onStockInput() { this._checkWarnings(); }

  private _checkWarnings() {
    const hasWarn = this.stockProducts().some(
      p => p.low_stock_threshold > 0 && p.newStock <= p.low_stock_threshold
    );
    this.stockHasWarnings.set(hasWarn);
  }

  submitStock() {
    if (this.stockHasWarnings()) { return; }
    this.stockSubmitting.set(true);
    const updates = this.stockProducts().map(p => ({ id: p.id, stock: p.newStock }));
    this.api.bulkUpdateVendorStock(updates).subscribe({
      next: () => {
        this.stockSubmitting.set(false);
        this._goOnline();
      },
      error: () => {
        this.stockSubmitting.set(false);
        this.toast.show('Failed to update stock.', 'error');
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  viewOrder(orderId: string) {
    this.router.navigate(['/orders', orderId]);
  }

  isLowStock(p: Product & { newStock: number }): boolean {
    return p.low_stock_threshold > 0 && p.newStock <= p.low_stock_threshold;
  }
}
