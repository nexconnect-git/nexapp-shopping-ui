import { Component, OnDestroy, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { buildStoreSelectionTarget } from '@nexconnect/customer-search';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { RightRailComponent } from '../../components/right-rail/right-rail.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { AppCurrencyPipe } from '@shared/public-api';
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
    ProductCardComponent,
    RightRailComponent,
    BreadcrumbsComponent,
    AppCurrencyPipe,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnDestroy {
  query = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  activeTab = signal<'All' | 'Stores' | 'Products' | 'Categories'>('All');
  activeFilters = signal<string[]>([]);
  tabs = computed(() => this.content.search().tabs);
  searchPromo = computed(() => this.content.ads().search[0] || null);
  private readonly routeSub: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public catalog: CatalogService,
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

  clearFilters(): void {
    this.activeFilters.set([]);
    this.activeTab.set('All');
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
}
