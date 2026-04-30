import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AlertService, ApiService, AppCurrencyPipe, LocationService, Order, Product, Vendor } from '@shared/public-api';

@Component({
  selector: 'app-shop-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './shop-detail.component.html',
  styleUrl: './shop-detail.component.scss'
})
export class ShopDetailComponent implements OnInit {
  api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private alerts = inject(AlertService);

  vendor = signal<Vendor | null>(null);
  products = signal<Product[]>([]);
  loading = signal(true);
  showInfo = signal(false);
  showSearch = signal(false);
  addingId = signal<string | null>(null);

  searchQuery = '';
  filterRating = false;
  categoryOpenState = signal<Record<string, boolean>>({});
  vendorOrders = signal<Order[]>([]);

  cartQty = signal<Record<string, number>>({});
  cartItemId: Record<string, string> = {};
  cartVendorId = signal<string | null>(null);
  cartVendorName = signal('');
  pendingAdd = signal<Product | null>(null);
  showReplaceDialog = signal(false);
  clearing = signal(false);

  filteredProducts = computed(() => {
    let list = this.products();
    const q = this.searchQuery.toLowerCase().trim();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    if (this.filterRating) list = list.filter(p => p.average_rating >= 4.0);
    return list;
  });

  categorySections = computed(() => {
    const groups = new Map<string, { key: string; title: string; items: Product[] }>();

    for (const product of this.filteredProducts()) {
      const title = product.category?.name?.trim() || 'More from this store';
      const key = product.category?.id || title.toLowerCase().replace(/\s+/g, '-');
      if (!groups.has(key)) {
        groups.set(key, { key, title, items: [] });
      }
      groups.get(key)!.items.push(product);
    }

    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
  });

  recentStorePicks = computed(() => {
    const vendorId = this.vendor()?.id;
    if (!vendorId) return [];

    const orderedIds = this.vendorOrders()
      .filter((order) => order.vendor === vendorId)
      .sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
      .flatMap((order) => order.items.map((item) => item.product))
      .filter((productId): productId is string => !!productId);

    const seen = new Set<string>();
    const rankedIds: string[] = [];
    for (const productId of orderedIds) {
      if (!seen.has(productId)) {
        seen.add(productId);
        rankedIds.push(productId);
      }
    }

    const available = new Map(this.products().map((product) => [product.id, product]));
    return rankedIds
      .map((productId) => available.get(productId))
      .filter((product): product is Product => !!product)
      .slice(0, 8);
  });

  mostBoughtStorePicks = computed(() => {
    const vendorId = this.vendor()?.id;
    if (!vendorId) return [];

    const counts = new Map<string, number>();
    for (const order of this.vendorOrders().filter((entry) => entry.vendor === vendorId)) {
      for (const item of order.items) {
        if (item.product) {
          counts.set(item.product, (counts.get(item.product) || 0) + item.quantity);
        }
      }
    }

    const available = new Map(this.products().map((product) => [product.id, product]));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([productId]) => available.get(productId))
      .filter((product): product is Product => !!product)
      .slice(0, 8);
  });

  hasStoreHistory = computed(() => this.vendorOrders().length > 0);

  totalCartItems = computed(() =>
    Object.values(this.cartQty()).reduce((s, q) => s + q, 0)
  );

  totalCartAmount = computed(() => {
    const qty = this.cartQty();
    return this.products().reduce((sum, p) => sum + (qty[p.id] || 0) * Number(p.price), 0);
  });

  readonly storeIsOpen = computed(() => {
    const currentVendor = this.vendor();
    return currentVendor ? (currentVendor.is_open_now ?? currentVendor.is_open) : false;
  });

  readonly availabilityNote = computed(() => {
    const currentVendor = this.vendor();
    return currentVendor?.availability_note || '';
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    const location = this.locationService.location();
    this.api.getVendor(id, location ? {
      lat: location.lat,
      lng: location.lng,
      state: location.state,
      city: location.city,
      postal_code: location.postalCode,
    } : undefined).subscribe({
      next: (v) => {
        this.vendor.set(v);
        this.products.set(v.products || []);
        this.seedCategoryOpenState(v.products || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.syncCart();
    this.loadVendorOrderHistory(id);
  }

  private seedCategoryOpenState(products: Product[]) {
    const nextState: Record<string, boolean> = {};
    for (const product of products) {
      const key = product.category?.id || (product.category?.name?.toLowerCase().replace(/\s+/g, '-') || 'more-from-this-store');
      if (!(key in nextState)) {
        nextState[key] = true;
      }
    }
    this.categoryOpenState.set(nextState);
  }

  private loadVendorOrderHistory(vendorId: string) {
    this.api.getOrders().subscribe({
      next: (response) => {
        const allOrders = (response.results || response) as Order[];
        const relevant = allOrders.filter((order) =>
          order.vendor === vendorId && !['cancelled'].includes(order.status),
        );
        this.vendorOrders.set(relevant);
      },
      error: () => this.vendorOrders.set([]),
    });
  }

  syncCart() {
    this.api.getCart().subscribe({
      next: (cart) => {
        const qty: Record<string, number> = {};
        const items = cart.items || [];
        for (const item of items) {
          qty[item.product.id] = item.quantity;
          this.cartItemId[item.product.id] = item.id;
        }
        this.cartQty.set(qty);
        if (items.length > 0) {
          this.cartVendorId.set(items[0].product.vendor);
          this.cartVendorName.set(items[0].product.vendor_name || 'another store');
        } else {
          this.cartVendorId.set(null);
          this.cartVendorName.set('');
        }
      }
    });
  }

  getQty(productId: string): number {
    return this.cartQty()[productId] || 0;
  }

  add(product: Product) {
    if (this.addingId()) return;
    if (!this.storeIsOpen()) {
      this.alerts.warning(this.availabilityNote() || 'This shop is closed right now.', 'Shop is closed');
      return;
    }
    const cartVendor = this.cartVendorId();
    const myVendorId = this.vendor()?.id;
    if (cartVendor && cartVendor !== myVendorId) {
      this.pendingAdd.set(product);
      this.showReplaceDialog.set(true);
      return;
    }
    this.doAdd(product);
  }

  doAdd(product: Product) {
    this.addingId.set(product.id);
    this.api.addToCart(product.id, 1).subscribe({
      next: () => {
        this.addingId.set(null);
        this.syncCart();
        this.api.refreshCartCount();
      },
      error: () => this.addingId.set(null)
    });
  }

  confirmReplace() {
    const product = this.pendingAdd();
    if (!product) return;
    this.showReplaceDialog.set(false);
    this.clearing.set(true);
    this.api.clearCart().subscribe({
      next: () => {
        this.cartQty.set({});
        this.cartItemId = {};
        this.cartVendorId.set(null);
        this.cartVendorName.set('');
        this.clearing.set(false);
        this.api.refreshCartCount();
        this.doAdd(product);
        this.pendingAdd.set(null);
      },
      error: () => this.clearing.set(false)
    });
  }

  cancelReplace() {
    this.pendingAdd.set(null);
    this.showReplaceDialog.set(false);
  }

  increment(product: Product) {
    const itemId = this.cartItemId[product.id];
    if (!itemId) { this.add(product); return; }
    const next = this.getQty(product.id) + 1;
    this.api.updateCartItem(itemId, next).subscribe({
      next: () => { this.syncCart(); this.api.refreshCartCount(); }
    });
  }

  decrement(product: Product) {
    const itemId = this.cartItemId[product.id];
    if (!itemId) return;
    const current = this.getQty(product.id);
    const obs = current <= 1
      ? this.api.removeCartItem(itemId)
      : this.api.updateCartItem(itemId, current - 1);
    obs.subscribe({ next: () => { this.syncCart(); this.api.refreshCartCount(); } });
  }

  toggleInfo() { this.showInfo.update(v => !v); }
  toggleSearch() { this.showSearch.update(v => !v); if (!this.showSearch()) this.searchQuery = ''; }
  toggleCategory(sectionKey: string) {
    this.categoryOpenState.update((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  }
  isCategoryOpen(sectionKey: string) {
    return this.categoryOpenState()[sectionKey] ?? true;
  }
  productDisplayName(product: Product) {
    return product.name?.trim() || product.catalog_product?.name || 'Store item';
  }
  productMeta(product: Product) {
    return [product.brand, product.weight || product.unit, product.category?.name]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .slice(0, 3);
  }
  shouldShowDescription(product: Product) {
    const description = (product.description || '').trim();
    if (!description) return false;
    const genericPhrases = [
      'vendor controls price',
      'store-specific handling details',
      'availability, and store-specific handling details',
    ];
    const lowered = description.toLowerCase();
    return description.length <= 120 && !genericPhrases.some((phrase) => lowered.includes(phrase));
  }
  goToCart() { this.router.navigate(['/cart']); }
  goBack() { window.history.back(); }
}
