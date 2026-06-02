import { Location } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomSelectComponent } from '@shared/lib/components/custom-select/custom-select.component';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { categoryIconFor } from '../../shared/category-icons';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbsComponent,
    ProductCardComponent,
    CustomSelectComponent,
  ],
  templateUrl: './store-detail.component.html',
  styleUrls: ['./store-detail.component.scss'],
})
export class StoreDetailComponent {
  activeCategory = signal('All');
  storeQuery = signal('');
  sortBy = signal('Sort: Relevance');

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
    public content: CustomerContentConfigService,
  ) {
    const initialSearch = this.route.snapshot.queryParamMap.get('q');
    if (initialSearch) this.storeQuery.set(initialSearch);
    effect(() => {
      const storeId = this.route.snapshot.paramMap.get('id') || this.store().id;
      const address = this.state.activeAddress();
      if (!storeId) return;
      this.catalog.loadStoreProducts(storeId, {
        ...this.addressQuery(address),
        ...this.storeProductQuery(),
      });
    });
  }

  store = computed(() =>
    this.catalog.getStore(this.route.snapshot.paramMap.get('id')),
  );
  storeOfferPromo = computed(() => {
    const store = this.store();
    if (store.offer) {
      return {
        eyebrow: 'Running offer',
        title: store.offer,
        subtitle:
          'Vendor offer eligibility is validated with your cart at checkout.',
        icon: 'local_offer',
      };
    }
    const fallback = this.content.ads().storeDetail[0];
    return {
      eyebrow: fallback?.eyebrow || 'Store offer',
      title: fallback?.title || 'Live vendor deals',
      subtitle:
        fallback?.subtitle || 'Final discounts are confirmed at checkout.',
      icon: fallback?.icon || 'sell',
    };
  });
  storeUnavailableReason = computed(() => {
    const raw = (this.store().raw as any) || {};
    if (raw?.is_serviceable === false) {
      return raw?.serviceability_error || 'This store is not serviceable for your selected location.';
    }
    if ((raw?.is_open_now ?? raw?.is_open) === false) {
      return this.closingLabel() || 'This store is currently closed.';
    }
    if (raw?.is_accepting_orders === false) {
      return 'This store is temporarily not accepting orders.';
    }
    return '';
  });
  canOrderFromStore = computed(() => !this.storeUnavailableReason());

  availableStoreProducts = computed(() => {
    if (!this.canOrderFromStore()) return [];
    const store = this.store();
    return this.catalog
      .productsByStore(store.id)
      .filter((product) => this.isProductAvailable(product));
  });

  categories = computed(() => {
    const serverCategories = ((this.store().raw as any)?.available_categories ||
      []) as Array<{ name?: string }>;
    if (serverCategories.length) {
      const unique = new Set<string>();
      const labels = (serverCategories
        .map((category) => category.name)
        .filter(Boolean) as string[])
        .map((label) => this.normalizeLabel(label))
        .filter((label) => {
          if (!label || unique.has(label.toLowerCase())) return false;
          unique.add(label.toLowerCase());
          return true;
        });
      return ['All', ...labels];
    }
    const names = new Set<string>();
    this.availableStoreProducts()
      .map((product) => this.normalizeLabel(product.category || ''))
      .filter(Boolean)
      .forEach((label) => names.add(label));
    return ['All', ...names];
  });
  isOpen = computed(
    () => this.store().raw?.is_open_now ?? this.store().raw?.is_open,
  );
  closingLabel = computed(() =>
    this.store().raw?.closing_time
      ? `Closes at ${this.store().raw?.closing_time}`
      : this.store().raw?.availability_note || '',
  );
  filteringCategories = computed(() =>
    this.catalog.isStoreProductsLoading(this.store().id),
  );

  groupedProducts = computed(() => {
    const all = this.availableStoreProducts();
    const groups = new Map<string, typeof all>();
    for (const product of all) {
      const name = product.category || 'Products';
      groups.set(name, [...(groups.get(name) || []), product]);
    }
    return [...groups.entries()].map(([name, items]) => ({
      name,
      items: items.slice(0, 12),
    }));
  });
  stockSummary = computed(() => {
    const all = this.catalog.productsByStore(this.store().id);
    const available = all.filter((product) => this.isProductAvailable(product));
    const lowStock = available.filter((product) => {
      const raw = (product.raw as any) || {};
      const stock = Number(raw?.stock ?? 0);
      const threshold = Number(raw?.low_stock_threshold ?? 5);
      return Number.isFinite(stock) && stock > 0 && stock <= threshold;
    });
    return {
      total: all.length,
      available: available.length,
      lowStock: lowStock.length,
    };
  });
  inventoryDeliveryPromise = computed(() => {
    const eta = this.store().eta?.trim();
    if (eta) return `Delivery in ${eta}`;
    return 'Delivery promise confirmed at checkout';
  });

  clearStoreSearch(): void {
    this.storeQuery.set('');
    this.activeCategory.set('All');
  }

  setStoreQuery(value: string): void {
    this.storeQuery.set(value);
  }

  setSortBy(value: string): void {
    this.sortBy.set(value);
  }

  setCategory(category: string): void {
    this.activeCategory.set(category);
  }

  followStore(): void {
    this.state.showToast(`${this.store().name} added to your favorites`);
  }

  shareStore(): void {
    const store = this.store();
    const url = `${location.origin}/store/${store.id}`;
    if (navigator.share) {
      navigator
        .share({
          title: store.name,
          text: `Shop ${store.name} on Nextou`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      this.state.showToast('Store link copied');
    }
  }

  showAllInGroup(groupName: string): void {
    this.activeCategory.set(groupName);
    this.state.showToast(`Showing ${groupName}`);
  }

  icon(cat: string): string {
    return categoryIconFor(
      this.catalog.categories().find((category) => category.label === cat) ||
        cat,
    );
  }

  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl('/stores');
  }

  changeLocation(): void {
    this.ui.openLocation();
  }

  private isProductAvailable(product: any): boolean {
    const raw = product?.raw || product || {};
    if (raw.is_available === false || raw.in_stock === false) return false;
    if (raw.status && raw.status !== 'active') return false;
    if (raw.approval_status && raw.approval_status !== 'approved') return false;
    const stock = Number(raw.stock);
    return !Number.isFinite(stock) || stock > 0;
  }

  private addressQuery(
    address: ReturnType<AppStateService['activeAddress']>,
  ): Record<string, any> {
    if (!address) return {};
    const params: Record<string, any> = {
      state: address.state || '',
      city: address.city || '',
      postal_code: address.pincode || '',
    };
    if (address.latitude != null && address.longitude != null) {
      params['lat'] = Number(address.latitude);
      params['lng'] = Number(address.longitude);
    }
    return params;
  }

  private storeProductQuery(): Record<string, any> {
    const params: Record<string, any> = {};
    const query = this.storeQuery().trim();
    const category = this.activeCategory();
    if (query) params['product_search'] = query;
    if (category && category !== 'All') params['product_category'] = category;
    if (this.sortBy() === 'Sort: Price Low to High')
      params['product_sort'] = 'price_asc';
    if (this.sortBy() === 'Sort: Rating') params['product_sort'] = 'rating';
    return params;
  }

  private normalizeLabel(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
