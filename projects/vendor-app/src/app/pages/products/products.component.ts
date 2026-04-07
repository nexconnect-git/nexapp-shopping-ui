import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, Product, ToastService } from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
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
  private reloadSub?: Subscription;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.deleteTarget()) this.load();
    });
  }

  ngOnDestroy() { this.reloadSub?.unsubscribe(); }

  manualReload() { this.load(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  load() {
    this.loading.set(true);
    this.api.getVendorProducts().subscribe({
      next: (r) => {
        this.products.set(r.results || r);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => { this.loading.set(false); this.toast.show('Failed to load products.', 'error'); }
    });
  }

  isLowStock(product: Product): boolean {
    return product.low_stock_threshold > 0 && product.stock <= product.low_stock_threshold;
  }

  confirmDelete(product: Product) {
    this.deleteTarget.set(product);
  }

  cancelDelete() {
    this.deleteTarget.set(null);
  }

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
