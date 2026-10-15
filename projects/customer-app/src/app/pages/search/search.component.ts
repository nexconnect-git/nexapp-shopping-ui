import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
@Component({
  standalone: true,
  imports: [CustomerIconComponent,
    RouterLink,
    ProductCardComponent,
    StoreCardComponent,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnDestroy {
  readonly catalog = inject(CatalogService);
  readonly state = inject(AppStateService);
  readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly query = signal('');
  readonly category = signal('');
  readonly sort = signal('relevance');
  readonly inStock = signal(false);
  readonly offers = signal(false);
  readonly maxPrice = signal('');
  readonly rating = signal('');
  readonly deliveryTime = signal('');
  readonly minDiscount = signal('');
  readonly isBrowse = computed(() => !this.query() && !this.category() && !this.inStock() && !this.offers() && !this.maxPrice() && !this.rating() && !this.deliveryTime() && !this.minDiscount() && this.activeTab()==='All');
  readonly noResults = computed(() => !this.searchPending() && !this.catalog.productsLoading() && !this.catalog.exploreError() && !this.isBrowse() && !this.catalog.exploreResults().products.length && !this.catalog.exploreResults().stores.length && !this.catalog.exploreResults().categories.length);
  readonly resultLabel = computed(() => {
    const summary = this.catalog.exploreSummary();
    const type = this.activeTab() === 'Stores' ? 'store' : this.activeTab() === 'Categories' ? 'category' : 'product';
    const count = type === 'store' ? summary?.store_count : type === 'category' ? summary?.category_count : summary?.product_count;
    return count == null ? 'Checking results' : `${count} ${count === 1 ? type : type === 'category' ? 'categories' : type + 's'}`;
  });
  readonly searchPending = signal(true);
  readonly recent = signal<string[]>(this.readRecent());
  readonly activeTab = signal('All');
  readonly tabs = ['All', 'Stores', 'Products', 'Categories'];
  private timer?: ReturnType<typeof setTimeout>;
  private readonly subscriptions = new Subscription();
  constructor() {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((p) => {
        this.query.set(p.get('q') || '');
        this.category.set(
          p.get('category') ||
            this.route.snapshot.paramMap.get('categoryId') ||
            ''
        );
        this.sort.set(p.get('sort') || 'relevance');
        this.inStock.set(p.get('in_stock') === 'true');
        this.offers.set(p.get('offers') === 'true');
        this.maxPrice.set(p.get('max_price') || '');
        this.rating.set(p.get('rating') || '');
        this.deliveryTime.set(p.get('delivery_time') || '');
        this.minDiscount.set(p.get('min_discount') || '');
        this.activeTab.set(this.tabs.includes(p.get('tab') || '') ? p.get('tab')! : 'All');
      })
    );
    effect(() => {
      const params = this.params();
      clearTimeout(this.timer);
      this.searchPending.set(true);
      this.timer = setTimeout(() => {
        this.catalog.loadExplore(params);
        this.searchPending.set(false);
      }, 250);
    });
  }
  private params(): Record<string, any> {
    return {
      ...this.state.customerLocationQuery(),
      q: this.query(),
      category: this.category(),
      sort: this.sort(),
      in_stock: this.inStock(),
      offers: this.offers(),
      max_price: this.maxPrice() || undefined,
      rating: this.rating() || undefined,
      delivery_time: this.deliveryTime() || undefined,
      min_discount: this.minDiscount() || undefined,
    };
  }
  retry(): void {
    this.catalog.loadExplore(this.params());
  }
  search(event: Event): void {
    event.preventDefault();
    const query = this.query().trim();
    if (query) {
      const history = [
        query,
        ...this.recent().filter((item) => item !== query),
      ].slice(0, 8);
      this.recent.set(history);
      try {
        localStorage.setItem(
          'nextou.customer.recentSearches',
          JSON.stringify(history)
        );
      } catch {}
    }
    this.sync();
  }
  private readRecent(): string[] {
    try {
      return JSON.parse(
        localStorage.getItem('nextou.customer.recentSearches') || '[]'
      )
        .filter((item: any) => typeof item === 'string')
        .slice(0, 8);
    } catch {
      return [];
    }
  }
  clearRecent(): void {
    this.recent.set([]);
    try {
      localStorage.removeItem('nextou.customer.recentSearches');
    } catch {}
  }
  tabKey(event: KeyboardEvent, tab: string): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = this.tabs.indexOf(tab);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % this.tabs.length
        : event.key === 'ArrowLeft'
        ? (index + this.tabs.length - 1) % this.tabs.length
        : event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? this.tabs.length - 1
        : -1;
    if (next < 0) return;
    event.preventDefault();
    this.setTab(this.tabs[next]);
    const buttons = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]');
    buttons?.[next]?.focus();
  }
  setTab(tab: string): void {
    this.activeTab.set(tab);
    this.router.navigate([], {relativeTo:this.route, queryParams:{tab:tab==='All' ? null : tab},queryParamsHandling:'merge'});
  }
  toggleRating(): void { this.rating.set(this.rating() ? '' : '4.8'); this.sync(); }
  toggleQuick(): void { this.deliveryTime.set(this.deliveryTime() ? '' : '30'); this.sync(); }
  toggleDiscount(): void { this.minDiscount.set(this.minDiscount() ? '' : '15'); this.sync(); }
  clearFilters(clearQuery=false): void {
    this.category.set('');this.inStock.set(false);this.offers.set(false);this.maxPrice.set('');this.rating.set('');this.deliveryTime.set('');this.minDiscount.set('');this.sort.set('relevance');
    if(clearQuery) this.query.set('');
    this.sync();
  }
  sync(): void {
    this.router.navigate(['/explore'], {
      queryParams: {
        q: this.query() || null,
        category: this.category() || null,
        sort: this.sort(),
        in_stock: this.inStock() || null,
        offers: this.offers() || null,
        max_price: this.maxPrice() || null,
        rating: this.rating() || null,
        delivery_time: this.deliveryTime() || null,
        min_discount: this.minDiscount() || null,
        tab: this.activeTab()==='All' ? null : this.activeTab(),
      },
    });
  }
  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.subscriptions.unsubscribe();
  }
}
