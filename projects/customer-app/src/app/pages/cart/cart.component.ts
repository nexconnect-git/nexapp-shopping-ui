import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/lib/services/api.service';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    ProductCardComponent,
    AppCurrencyPipe,
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  Math = Math;
  cartStoreName = computed(() => {
    const first = this.state.cart()[0];
    return first?.storeName || 'Selected store';
  });
  cartStoreStatus = computed(() => {
    const first = this.state.cart()[0];
    const rawVendor = (first?.raw as any)?.vendor || {};
    const isOpen = (rawVendor?.is_open_now ?? rawVendor?.is_open) !== false;
    const acceptingOrders = rawVendor?.is_accepting_orders !== false;
    if (!isOpen) return 'Store currently closed';
    if (!acceptingOrders) return 'Temporarily not accepting orders';
    return 'Open and accepting orders';
  });
  hasMixedStoreItems = computed(() => {
    const stores = new Set(
      this.state
        .cart()
        .map((item) => item.storeId || item.storeName)
        .filter(Boolean),
    );
    return stores.size > 1;
  });
  constructor(
    private api: ApiService,
    public state: AppStateService,
    public catalog: CatalogService,
    public ui: UiService,
    public content: CustomerContentConfigService,
  ) {}

  saveForLater(productId: string): void {
    this.api.toggleWishlist(productId).subscribe({
      next: () => this.state.showToast('Saved to wishlist'),
      error: () => this.state.showToast('Could not save item'),
    });
  }

  applyCoupon(code: string): void {
    if (!code?.trim()) {
      this.state.showToast('Enter a coupon code');
      return;
    }
    this.state.applyCoupon(code);
  }
}
