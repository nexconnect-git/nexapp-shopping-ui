import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { Product } from '../../models';
import { AppStateService } from '../../services/app-state.service';

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

  constructor(public state: AppStateService) {}

  stockBadge(): { label: string; tone: 'success' | 'warning' | 'danger' } | null {
    const raw = (this.product?.raw as any) || {};
    const stock = Number(raw?.stock ?? this.product?.raw?.stock ?? 0);
    const lowStockThreshold = Number(raw?.low_stock_threshold ?? 5);
    const available = raw?.is_available !== false && raw?.in_stock !== false;
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
      this.state.cart().find((item) => item.id === this.product.id)?.quantity ??
      0
    );
  }

  storeClosed(): boolean {
    const vendor = (this.product?.raw as any)?.vendor;
    return vendor ? (vendor?.is_open_now ?? vendor?.is_open) === false : false;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.placeholderImage)) return;
    img.src = this.placeholderImage;
  }
}
