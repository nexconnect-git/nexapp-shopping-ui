import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerCartApiService } from '../../services/customer-cart-api.service';

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
export class CartComponent implements OnInit {
  Math = Math;
  cartSuggestions = signal<any[]>([]);
  bestCoupon = signal<any | null>(null);
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
    public state: AppStateService,
    public catalog: CatalogService,
    public ui: UiService,
    public content: CustomerContentConfigService,
    private cartApi: CustomerCartApiService,
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
    this.loadBestCoupon();
  }

  applyCoupon(code: string): void {
    if (!code?.trim()) {
      this.state.showToast('Enter a coupon code');
      return;
    }
    this.state.applyCoupon(code);
  }

  applyBestCoupon(): void {
    const code = this.bestCoupon()?.best_coupon?.code;
    if (!code) {
      this.state.showToast('No eligible coupon found for this basket.');
      return;
    }
    this.state.applyCoupon(code);
  }

  checkout(): void {
    this.state.proceedToCheckout();
  }

  private loadSuggestions(): void {
    this.cartApi.getSuggestions().subscribe({
      next: (response) =>
        this.cartSuggestions.set(
          (
            response?.same_store_add_ons ||
            response?.frequently_bought_together ||
            []
          ).map((product: any) => this.catalog.mapProduct(product)),
        ),
      error: () => this.cartSuggestions.set([]),
    });
  }

  private loadBestCoupon(): void {
    this.cartApi.getBestCoupon().subscribe({
      next: (response) => this.bestCoupon.set(response || null),
      error: () => this.bestCoupon.set(null),
    });
  }
}
