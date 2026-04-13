import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Product, ToastService } from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  products = signal<Product[]>([]);
  loading = signal(true);
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  deleteTarget = signal<Product | null>(null);
  deleting = signal(false);

  // Pagination
  page = signal(1);
  total = signal(0);
  totalPages = signal(1);
  readonly pageSize = 20;
  Math = Math;

  search = '';
  private searchTimer: any;
  private reloadSub?: Subscription;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.deleteTarget()) this.load();
    });
  }

  ngOnDestroy() { this.reloadSub?.unsubscribe(); }

  manualReload() { this.page.set(1); this.load(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    this.api.getVendorProducts(params).subscribe({
      next: (r) => {
        this.products.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || (r.results || r).length) / this.pageSize) || 1);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => { this.loading.set(false); this.toast.show('Failed to load products.', 'error'); }
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
      this.load();
    }
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) range.push(i);
    return range;
  }

  isLowStock(product: Product): boolean {
    return product.low_stock_threshold > 0 && product.stock <= product.low_stock_threshold;
  }

  confirmDelete(product: Product) { this.deleteTarget.set(product); }
  cancelDelete() { this.deleteTarget.set(null); }

  doDelete() {
    const p = this.deleteTarget();
    if (!p) return;
    this.deleting.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.show(`"${p.name}" deleted.`, 'success');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.show('Failed to delete product.', 'error');
      }
    });
  }
}
