import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  categoryFilterKey,
  categoryMatchesFilterKey,
} from '@nexconnect/customer-core';
import { buildProductFilterQuery } from '@nexconnect/customer-search';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomSelectComponent } from '@shared/lib/components/custom-select/custom-select.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    StoreCardComponent,
    CustomSelectComponent,
  ],
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss'],
})
export class StoresComponent {
  private activeCategoryKey = signal('all');

  active = computed(() => this.resolveCategoryLabel(this.activeCategoryKey()));
  filters = computed(() => [
    'All',
    ...this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .map((category) => category.label)
      .slice(0, 8),
  ]);
  sortBy = signal('Relevance');
  searchQuery = signal('');

  constructor(
    public catalog: CatalogService,
    public ui: UiService,
    private state: AppStateService,
    private route: ActivatedRoute,
    private router: Router,
    public content: CustomerContentConfigService,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      this.activeCategoryKey.set(
        this.normalize(params.get('category') || 'all') || 'all',
      );
      this.refreshBackendFilters();
    });
  }

  filteredStores = computed(() => {
    const query = this.normalizeSearch(this.searchQuery());
    const list = [...this.catalog.stores()].filter((store) => {
      if ((store.raw as any)?.is_serviceable === false) return false;
      if (!query) return true;
      const raw = store.raw as any;
      return [
        store.name,
        store.category,
        (store as any).offer,
        (store as any).location,
        raw?.store_name,
        raw?.city,
        raw?.state,
        raw?.address,
        raw?.category?.name,
      ]
        .map((value) => this.normalizeSearch(value))
        .some((value) => value.includes(query));
    });
    if (this.sortBy() === 'Rating') list.sort((a, b) => b.rating - a.rating);
    if (this.sortBy() === 'Delivery Time')
      list.sort((a, b) => parseInt(a.eta, 10) - parseInt(b.eta, 10));
    return list;
  });
  storePromos = computed(() => this.content.ads().storeListing);
  storePromo = computed(
    () =>
      this.storePromos()[0] || {
        title: 'Shop vendor deals near you',
        subtitle: 'Offers are confirmed at checkout.',
      },
  );

  setFilter(filter: string): void {
    const category = this.categoryKeyFromLabel(filter);
    this.router.navigate(['/stores'], {
      queryParams: category === 'all' ? {} : { category },
    });
  }

  setSort(sort: string): void {
    this.sortBy.set(sort);
    this.refreshBackendFilters();
  }

  setSearchQuery(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value || '');
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  loadMore(): void {
    this.catalog.loadMoreStores();
  }

  viewMap(): void {
    this.ui.openLocation();
    this.state.showToast(
      'Set your delivery location to refresh nearby stores.',
    );
  }

  filterIcon(filter: string): string {
    const key = filter.toLowerCase();
    if (key === 'all') return 'storefront';
    if (key.includes('grocery') || key.includes('food'))
      return 'shopping_basket';
    if (key.includes('pharmacy') || key.includes('health'))
      return 'local_pharmacy';
    if (key.includes('home')) return 'home';
    if (key.includes('fresh') || key.includes('veg')) return 'nutrition';
    return 'category';
  }

  private refreshBackendFilters(): void {
    const active = this.activeCategoryKey();
    const category = this.catalog
      .categories()
      .find((item) => this.categoryMatches(item, active));
    const sort =
      this.sortBy() === 'Rating'
        ? 'rating'
        : this.sortBy() === 'Delivery Time'
          ? 'distance'
          : 'relevance';
    this.catalog.loadStores(
      buildProductFilterQuery(
        {
          category:
            active === 'all'
              ? ''
              : category?.raw?.slug || category?.id || active,
          sort,
        },
        this.activeLocation(),
      ),
      { allowFallback: false },
    );
  }

  private activeLocation(): {
    latitude?: number;
    longitude?: number;
    state?: string;
    city?: string;
    postalCode?: string;
  } {
    const address = this.state.activeAddress();
    return buildCustomerLocationQuery({
      lat: address?.latitude ?? undefined,
      lng: address?.longitude ?? undefined,
      state: address?.state || undefined,
      city: address?.city || undefined,
      postal_code: address?.pincode || undefined,
    });
  }

  private categoryKeyFromLabel(label: string): string {
    if (label === 'All') return 'all';
    const category = this.catalog
      .categories()
      .find((item) => item.label === label);
    return category
      ? categoryFilterKey(category as any)
      : this.normalize(label);
  }

  private resolveCategoryLabel(key: string): string {
    if (key === 'all') return 'All';
    const category = this.catalog
      .categories()
      .find((item) => this.categoryMatches(item, key));
    return (
      category?.label ||
      key
        .split('-')
        .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
        .join(' ')
    );
  }

  private categoryMatches(
    category: { id?: string; label?: string; raw?: { slug?: string | null } },
    key: string,
  ): boolean {
    return categoryMatchesFilterKey(category as any, key);
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeSearch(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }
}
