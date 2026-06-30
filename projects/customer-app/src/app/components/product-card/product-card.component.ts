import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { Product } from '../../models';
import { CustomerCartFacade } from '../../services/facades/customer-cart.facade';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';

type ProductMeta = Record<string, unknown> & {
  stock?: number | string;
  available_quantity?: number | string;
  stock_state?: string;
  promise?: Record<string, unknown> & {
    eta_label?: string;
    delivery_label?: string;
    min_minutes?: number | string;
    max_minutes?: number | string;
  };
  low_stock_threshold?: number | string;
  is_available?: boolean;
  in_stock?: boolean;
  vendor?: Record<string, unknown> & {
    is_open_now?: boolean;
    is_open?: boolean;
    estimated_delivery_label?: string;
    eta_label?: string;
    delivery_time?: string | number;
  };
};

@Component({
  selector: 'fd-product-card',
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() compact = false;
  readonly placeholderImage = '/assets/placeholders/product.svg';

  constructor(
    public cart: CustomerCartFacade,
    private catalog: CatalogService,
    private state: AppStateService,
  ) {}

  productName(): string {
    return this.product?.name?.trim() || 'Product unavailable';
  }

  productUnit(): string {
    return this.product?.unit?.trim() || 'Unit details unavailable';
  }

  productPrice(): number {
    const price = Number(this.product?.price);
    return Number.isFinite(price) && price >= 0 ? price : 0;
  }

  showMrp(): boolean {
    const mrp = Number(this.product?.mrp);
    return Number.isFinite(mrp) && mrp > this.productPrice();
  }

  stockBadge(): { label: string; tone: 'success' | 'warning' | 'danger' } | null {
    const raw = (this.product?.raw || {}) as ProductMeta;
    const stock = Number(raw.available_quantity ?? raw.stock ?? 0);
    const lowStockThreshold = Number(raw?.low_stock_threshold ?? 5);
    const state = String(raw.stock_state || '').toLowerCase();
    const available =
      raw?.is_available !== false &&
      raw?.in_stock !== false &&
      !['out', 'out_of_stock', 'unavailable'].includes(state);
    if (!available || (Number.isFinite(stock) && stock <= 0)) {
      return { label: 'Out of stock', tone: 'danger' };
    }
    if (Number.isFinite(stock) && stock > 0 && stock <= lowStockThreshold) {
      return { label: `Only ${stock} left`, tone: 'warning' };
    }
    if (Number.isFinite(stock) && stock > 0) {
      return { label: 'In stock', tone: 'success' };
    }
    return null;
  }

  quantity(): number {
    return (
      this.cart
        .cart()
        .find(
          (item) =>
            item.id === this.product.id ||
            item.apiId === this.product.id ||
            item.id === this.product.apiId ||
            item.apiId === this.product.apiId,
        )?.quantity ??
      0
    );
  }

  deliveryBadge(): string {
    const raw = (this.product?.raw || {}) as ProductMeta;
    const vendor = raw.vendor || {};
    const promise = raw.promise || {};
    if (promise.eta_label || promise.delivery_label) {
      return String(promise.eta_label || promise.delivery_label);
    }
    if (promise.min_minutes || promise.max_minutes) {
      const min = promise.min_minutes || promise.max_minutes;
      const max = promise.max_minutes || promise.min_minutes;
      return min === max ? `${min} min` : `${min}-${max} min`;
    }
    const eta =
      vendor.estimated_delivery_label ||
      vendor.eta_label ||
      vendor.delivery_time ||
      '';
    return String(eta || 'Fast');
  }

  categoryLabel(): string {
    return this.product?.category || this.product?.storeName || 'Daily essential';
  }

  storeClosed(): boolean {
    const raw = (this.product?.raw || {}) as ProductMeta & Record<string, any>;
    const loadedStore = this.product?.storeId
      ? this.catalog.stores().find((store) => store.id === this.product.storeId)
      : null;
    const vendor = raw.vendor || raw['store'] || loadedStore?.raw;
    if (!vendor) return false;
    return (
      (vendor?.is_open_now ?? vendor?.is_open) === false ||
      vendor?.is_accepting_orders === false
    );
  }

  deliveryUnavailable(): boolean {
    return this.state.deliveryUnavailable();
  }

  isUnavailable(): boolean {
    const badge = this.stockBadge();
    return badge?.tone === 'danger';
  }

  unavailableLabel(): string {
    return 'Out of stock';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.placeholderImage)) return;
    img.src = this.placeholderImage;
  }
}
