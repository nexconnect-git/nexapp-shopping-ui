import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { effect } from '@angular/core';
import { BasketItemsComponent } from '../../components/basket-items/basket-items.component';
import { BasketSummaryComponent } from '../../components/basket-summary/basket-summary.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerCartApiService } from '../../services/customer-cart-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [CustomerIconComponent,BreadcrumbsComponent,DatePipe,NxModalShellComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    BasketItemsComponent,
    BasketSummaryComponent,
    ProductCardComponent,
    AppCurrencyPipe,
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent implements OnInit {
  Math = Math;
  readonly couponsOpen = signal(false);
  openCoupons(): void { if(!this.auth.isLoggedIn()){this.ui.openLogin();return;} this.couponsOpen.set(true); this.catalog.loadCoupons(); }
  cartSuggestions = signal<any[]>([]);
  bestCoupon = signal<any | null>(null);
  readonly suggestionsError = signal('');
  readonly bestCouponError = signal('');
  readonly stockChangedItem = computed(() => this.state.cart().find(item => {
    const stock = item.raw?.stock;
    return stock !== null && stock !== undefined && Number.isFinite(Number(stock)) &&
      Number(stock) >= 0 && item.quantity > Number(stock);
  }));
  useAvailableQuantity(): void {
    const item = this.stockChangedItem();
    if (item) this.state.updateQuantity(item.id, Math.floor(Number(item.raw?.stock)) - item.quantity);
  }
  private suggestionsRequest = 0;
  private bestCouponRequest = 0;
  retrySuggestions(): void { this.loadSuggestions(); }
  retryBestCoupon(): void { this.loadBestCoupon(); }
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
    return rawVendor?.is_open_now === true || rawVendor?.is_open === true
      ? 'Open and accepting orders'
      : 'Availability checked at checkout';
  });
  hasMixedStoreItems = computed(() => {
    const stores = new Set(
      this.state
        .cart()
        .map((item) => item.storeId || item.storeName)
        .filter(Boolean)
    );
    return stores.size > 1;
  });
  constructor(
    public state: AppStateService,
    public catalog: CatalogService,
    public ui: UiService,
    public content: CustomerContentConfigService,
    private cartApi: CustomerCartApiService,
    public auth: AuthService,
    private route: ActivatedRoute
  ) {
    effect(() => {
      this.auth.isLoggedIn();
      this.state
        .cart()
        .map((item) => `${item.id}:${item.quantity}`)
        .join('|');
      this.loadSuggestions();
      this.loadBestCoupon();
    });
  }
  clear(): void {
    this.ui
      .confirm({
        title: 'Clear your basket?',
        message: 'All current basket items will be removed.',
        confirmText: 'Clear basket',
        cancelText: 'Keep shopping',
        tone: 'warning',
      })
      .then((yes) => {
        if (yes) this.state.clearCart();
      });
  }

  ngOnInit(): void {
    this.state.loadCart();
    if(this.route.snapshot.queryParamMap.get("coupons") === "1") this.openCoupons();
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
    const request = ++this.suggestionsRequest;
    const sessionVersion = this.auth.sessionVersion;
    this.suggestionsError.set('');
    if (!this.canLoadCartEnhancements()) { this.cartSuggestions.set([]); return; }
    this.cartApi.getSuggestions().subscribe({
      next: response => {
        if(request !== this.suggestionsRequest || sessionVersion !== this.auth.sessionVersion) return;
        this.cartSuggestions.set((response?.same_store_add_ons || response?.frequently_bought_together || []).map((product: any) => this.catalog.mapProduct(product)));
      },
      error: () => { if(request === this.suggestionsRequest && sessionVersion === this.auth.sessionVersion) this.suggestionsError.set('Same-store suggestions could not refresh. Try again.'); },
    });
  }

  private loadBestCoupon(): void {
    const request = ++this.bestCouponRequest;
    const sessionVersion = this.auth.sessionVersion;
    this.bestCouponError.set('');
    if (!this.canLoadCartEnhancements()) { this.bestCoupon.set(null); return; }
    this.cartApi.getBestCoupon().subscribe({
      next: response => { if(request === this.bestCouponRequest && sessionVersion === this.auth.sessionVersion) this.bestCoupon.set(response || null); },
      error: () => { if(request === this.bestCouponRequest && sessionVersion === this.auth.sessionVersion) this.bestCouponError.set('Coupon eligibility could not refresh. Try again.'); },
    });
  }

  private canLoadCartEnhancements(): boolean {
    return this.auth.isLoggedIn() && this.state.cart().length > 0;
  }
}
