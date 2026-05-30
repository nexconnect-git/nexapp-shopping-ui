import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Product, ToastService } from '@shared/public-api';

type InventoryFilter =
  | 'all'
  | 'low'
  | 'out'
  | 'paused'
  | 'missing_photo'
  | 'category_pending'
  | 'ready';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  products = signal<Product[]>([]);
  loading = signal(true);
  savingId = signal<string | null>(null);
  filter = signal<InventoryFilter>('all');
  stockDrafts = signal<Record<string, number>>({});
  rowErrors = signal<Record<string, string>>({});
  readonly productPlaceholderImage = '/assets/placeholders/product.svg';

  filters: Array<{ key: InventoryFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'low', label: 'Low stock' },
    { key: 'out', label: 'Out of stock' },
    { key: 'paused', label: 'Paused today' },
    { key: 'missing_photo', label: 'Missing photos' },
    { key: 'category_pending', label: 'Category pending' },
    { key: 'ready', label: 'Ready to sell' },
  ];

  filteredProducts = computed(() =>
    this.products().filter((product) => {
      switch (this.filter()) {
        case 'low':
          return this.isLowStock(product) && product.stock > 0;
        case 'out':
          return product.stock <= 0;
        case 'paused':
          return !product.is_available;
        case 'missing_photo':
          return (product.image_count ?? product.images?.length ?? 0) === 0;
        case 'category_pending':
          return (
            product.category_visibility === 'pending_review' ||
            product.category_visibility === 'missing'
          );
        case 'ready':
          return (
            product.visibility_status === 'ready_to_sell' &&
            product.stock > 0 &&
            product.is_available
          );
        default:
          return true;
      }
    }),
  );

  canBulkSaveVisible = computed(
    () => this.filteredProducts().length > 0 && !this.savingId(),
  );
  attentionCount = computed(
    () =>
      this.filteredProducts().filter(
        (product) =>
          this.isLowStock(product) ||
          product.stock <= 0 ||
          !product.is_available ||
          (product.image_count ?? product.images?.length ?? 0) === 0 ||
          product.visibility_status !== 'ready_to_sell',
      ).length,
  );

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getVendorProducts().subscribe({
      next: (r) => {
        const products = r.results || r;
        this.products.set(products);
        this.stockDrafts.set(
          Object.fromEntries(products.map((p: Product) => [p.id, p.stock])),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load inventory.', 'error');
      },
    });
  }

  setFilter(key: InventoryFilter) {
    this.filter.set(key);
  }

  filterLabel(): string {
    return (
      this.filters.find((item) => item.key === this.filter())?.label || 'All'
    );
  }

  setDraft(productId: string, value: string) {
    const numericValue = Number(value);
    this.stockDrafts.update((v) => ({ ...v, [productId]: numericValue }));
    this.rowErrors.update((errors) => {
      const next = { ...errors };
      if (Number.isNaN(numericValue) || numericValue < 0)
        next[productId] = 'Stock must be zero or more.';
      else delete next[productId];
      return next;
    });
  }

  saveStock(product: Product) {
    const stock = this.stockDrafts()[product.id] ?? product.stock;
    if (!this.validateStock(product.id, stock)) return;
    this.savingId.set(product.id);
    this.api.updateProductStock(product.id, { stock }).subscribe({
      next: (updated) => {
        this.products.update((list) =>
          list.map((p) =>
            p.id === product.id ? { ...p, ...updated, stock } : p,
          ),
        );
        this.savingId.set(null);
        this.toast.show('Stock updated.', 'success');
      },
      error: () => {
        this.savingId.set(null);
        this.toast.show('Stock update failed.', 'error');
      },
    });
  }

  toggleAvailable(product: Product) {
    this.savingId.set(product.id);
    this.api
      .patchProduct(product.id, { is_available: !product.is_available })
      .subscribe({
        next: (updated) => {
          this.products.update((list) =>
            list.map((p) => (p.id === product.id ? updated : p)),
          );
          this.savingId.set(null);
        },
        error: () => {
          this.savingId.set(null);
          this.toast.show('Availability update failed.', 'error');
        },
      });
  }

  bulkSaveVisible() {
    const invalid = this.filteredProducts().filter(
      (product) =>
        !this.validateStock(
          product.id,
          this.stockDrafts()[product.id] ?? product.stock,
        ),
    );
    if (invalid.length) {
      this.toast.show('Fix invalid stock values before bulk saving.', 'error');
      return;
    }
    const updates = this.filteredProducts().map((product) => ({
      id: product.id,
      stock: this.stockDrafts()[product.id] ?? product.stock,
    }));
    if (!updates.length) {
      this.toast.show(
        'No visible products to update. Add your first product to start managing inventory.',
        'info',
      );
      return;
    }
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        `Save stock for ${updates.length} visible product${updates.length === 1 ? '' : 's'}?`,
      );
    if (!confirmed) return;
    this.api.bulkUpdateVendorStock(updates).subscribe({
      next: () => {
        this.toast.show('Visible stock rows updated.', 'success');
        this.load();
      },
      error: () => this.toast.show('Bulk stock update failed.', 'error'),
    });
  }

  isLowStock(product: Product): boolean {
    return (
      product.low_stock_threshold > 0 &&
      product.stock <= product.low_stock_threshold
    );
  }

  productImage(product: Product): string {
    return product.primary_image || this.productPlaceholderImage;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src.includes(this.productPlaceholderImage)) return;
    img.src = this.productPlaceholderImage;
  }

  healthLabel(product: Product): string {
    if (product.visibility_status === 'ready_to_sell') return 'Ready to sell';
    return product.visibility_blockers?.join(', ') || 'Needs attention';
  }

  rowError(productId: string): string {
    return this.rowErrors()[productId] || '';
  }

  private validateStock(productId: string, stock: number): boolean {
    if (Number.isNaN(Number(stock)) || Number(stock) < 0) {
      this.rowErrors.update((errors) => ({
        ...errors,
        [productId]: 'Stock must be zero or more.',
      }));
      return false;
    }
    this.rowErrors.update((errors) => {
      const next = { ...errors };
      delete next[productId];
      return next;
    });
    return true;
  }
}
