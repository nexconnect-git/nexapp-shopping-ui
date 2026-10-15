import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';

@Component({
  standalone: true,
  imports: [RouterLink, BreadcrumbsComponent, CustomerIconComponent, ProductCardComponent, CustomerStateComponent],
  templateUrl: './store-detail.component.html',
  styleUrls: ['./store-detail.component.scss'],
})
export class StoreDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly catalog = inject(CatalogService);
  readonly state = inject(AppStateService);
  readonly ui = inject(UiService);
  private readonly routeParams = toSignal(this.route.paramMap);
  private readonly sortControl = viewChild<ElementRef<HTMLSelectElement>>('sortControl');
  readonly activeCategory = signal('All');
  readonly storeQuery = signal('');
  readonly sortBy = signal('relevance');
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.storeQuery.set(params.get('q') || '');
      this.activeCategory.set(params.get('category') || 'All');
      const sort = params.get('sort') || 'relevance';
      this.sortBy.set(['relevance', 'price_asc', 'price_desc', 'rating'].includes(sort) ? sort : 'relevance');
    });
    effect(() => {
      const storeId = this.routeParams()?.get('id');
      if (storeId) this.catalog.loadStoreProducts(storeId, this.requestParams());
    });
  }
  readonly store = computed(() => this.catalog.getStoreDetail(this.routeParams()?.get('id') || ''));
  readonly storeLoaded = computed(() => Boolean(this.store().raw));
  readonly storeTitle = computed(() => this.storeLoaded() ? this.store().name : 'This store');
  readonly storeCategoryLabel = computed(() => this.store().category || '');
  readonly availability = computed(() => {
    const raw = this.store().raw;
    if (raw?.is_open === false) return 'closed';
    if (raw?.is_accepting_orders === false) return 'paused';
    if (raw?.is_open_now === false) return 'closed';
    if (raw?.is_serviceable === false) return 'area';
    if (this.state.deliveryUnavailable()) return 'area';
    return '';
  });
  readonly storeUnavailableReason = computed(() => {
    if (this.availability() === 'area') return this.store().raw?.serviceability_error || this.state.serviceability()?.message || 'This store cannot deliver to your current location. Choose another area or another store.';
    if (this.availability() === 'closed') return 'This store is closed right now. Ordering is unavailable until the store is open and accepting orders.';
    if (this.availability() === 'paused') return 'This store is open, but it has paused new orders. Existing orders are unaffected.';
    return '';
  });
  readonly availabilityLabel = computed(() => ({area: 'Outside delivery area', closed: 'Closed', paused: 'Intake paused', '': 'Accepting orders'}[this.availability()] || 'Accepting orders'));
  readonly availableStoreProducts = computed(() => this.catalog.productsForStoreDetail(this.store().id));
  readonly categories = computed(() => {
    const server = this.store().raw?.available_categories || [];
    const labels = server.length ? server.map(category => category.name) : this.availableStoreProducts().map(product => product.category);
    return ['All', ...new Set(labels.map(label => String(label || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
  });
  readonly filteringCategories = computed(() => this.catalog.isStoreProductsLoading(this.store().id));
  categoryImage(label: string): string { return this.catalog.categories().find(category => category.label === label)?.image || ''; }
  retry(): void { this.catalog.loadStoreProducts(this.store().id, this.requestParams()); }
  clearStoreSearch(): void { this.storeQuery.set(''); this.activeCategory.set('All'); this.sortBy.set('relevance'); this.sync(); }
  setStoreQuery(value: string): void { this.storeQuery.set(value); this.sync(); }
  setSortBy(value: string): void { this.sortBy.set(value); this.sync(); }
  setCategory(category: string): void { this.activeCategory.set(category); this.sync(); }
  focusSort(): void { this.sortControl()?.nativeElement.focus(); }
  shareStore(): void {
    const store = this.store();
    const url = `${location.origin}/store/${store.id}`;
    if (navigator.share) { void navigator.share({title: store.name, text: `Shop ${store.name} on Nextou`, url}).catch(() => {}); }
    else if (navigator.clipboard) { void navigator.clipboard.writeText(url).then(() => this.state.showToast('Store link copied')).catch(() => this.state.showToast('Could not copy store link')); }
    else this.state.showToast('Sharing is unavailable in this browser');
  }
  private sync(): void {
    void this.router.navigate([], {relativeTo: this.route, queryParams: {q: this.storeQuery() || null, category: this.activeCategory() === 'All' ? null : this.activeCategory(), sort: this.sortBy() === 'relevance' ? null : this.sortBy()}});
  }
  private requestParams(): Record<string, any> {
    return {...this.state.customerLocationQuery(), product_search: this.storeQuery().trim() || undefined, product_category: this.activeCategory() === 'All' ? undefined : this.activeCategory(), product_sort: this.sortBy()};
  }
}
