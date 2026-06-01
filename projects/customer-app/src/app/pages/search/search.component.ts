import { Location } from '@angular/common';
import { Component, computed, effect, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { buildStoreSelectionTarget } from '@nexconnect/customer-search';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppCurrencyPipe, CustomSelectComponent } from '@shared/public-api';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import {
  CustomerContentConfigService,
  CustomerPromoCard,
  CustomerQuickFilter,
} from '../../services/customer-content-config.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbsComponent,
    ProductCardComponent,
    StoreCardComponent,
    AppCurrencyPipe,
    CustomSelectComponent,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnDestroy {
  query = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  activeTab = signal<'All' | 'Stores' | 'Products' | 'Categories'>('All');
  sortBy = signal(
    `Sort by: ${this.content.filters().sortOptions[0] || 'Relevance'}`,
  );
  activeFilters = signal<string[]>([]);
  tabs = computed(() => this.content.search().tabs);
  searchPromo = computed(() => this.content.ads().search[0] || null);
  hasQuery = computed(() => !!this.query().trim());
  recommendedCategories = computed(() => {
    const categories = this.catalog
      .categories()
      .filter((category) => category.id !== 'all');
    const preferred = new Set(
      this.state
        .cart()
        .map((item) => this.normalizeKey(item.category))
        .filter(Boolean),
    );
    return [...categories]
      .sort((a, b) => {
        const aPreferred = preferred.has(this.normalizeKey(a.label));
        const bPreferred = preferred.has(this.normalizeKey(b.label));
        if (aPreferred === bPreferred) return a.label.localeCompare(b.label);
        return aPreferred ? -1 : 1;
      })
      .slice(0, 8);
  });
  private readonly routeSub: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
    public content: CustomerContentConfigService,
  ) {
    effect(() => this.catalog.refreshSearch(this.query()));
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      const next = params.get('q') ?? '';
      if (next !== this.query()) this.query.set(next);
    });
  }

  results = computed(() => this.catalog.search(this.query()));
  noVisibleResults = computed(
    () =>
      !this.catalog.productsLoading() &&
      !this.catalog.storesLoading() &&
      this.count(this.activeTab()) === 0,
  );

  count(tab: string): number {
    const r = this.results();
    if (tab === 'Stores') return r.stores.length;
    if (tab === 'Products') return r.products.length;
    if (tab === 'Categories') return r.categories.length;
    return r.stores.length + r.products.length + r.categories.length;
  }

  applyQuickFilter(filter: CustomerQuickFilter): void {
    const label = filter.label;
    this.activeFilters.update((current) =>
      current.includes(label) ? current : [...current, label],
    );
    if (filter.action === 'offers') {
      this.updateQuery(this.query() ? `${this.query()} offers` : 'offers');
      this.syncUrl();
      return;
    }
    if (filter.action === 'fast_delivery') {
      this.activeTab.set('Stores');
      return;
    }
    if (filter.action === 'rating_4_plus') {
      this.activeTab.set('Stores');
      return;
    }
    if (filter.action === 'under_budget') {
      this.activeTab.set('Products');
    }
  }

  updateQuery(value: string): void {
    this.query.set(value);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    this.syncUrl();
  }

  clearSearch(): void {
    this.query.set('');
    this.syncUrl();
  }

  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl('/');
  }

  clearFilters(): void {
    this.activeFilters.set([]);
    this.activeTab.set('All');
  }

  setSort(value: string): void {
    this.sortBy.set(value);
  }

  handleSearchPromo(promo: CustomerPromoCard): void {
    if (promo.ctaUrl) {
      this.router.navigateByUrl(promo.ctaUrl);
      return;
    }
    this.ui.openFilter();
  }

  selectStore(event: Event, store: unknown): void {
    event.preventDefault();
    event.stopPropagation();
    const target = buildStoreSelectionTarget(store as any, {
      searchQuery: this.query(),
    });
    if (!target) return;
    this.router.navigate(['/store', target.storeId], {
      queryParams: target.searchQuery ? { q: target.searchQuery } : undefined,
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  private syncUrl(): void {
    const q = this.query().trim();
    this.query.set(q);
    this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }

  private normalizeKey(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
