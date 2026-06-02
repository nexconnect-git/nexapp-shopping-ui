import { Location } from '@angular/common';
import { Component, computed, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import {
  categoryFilterKey,
  categoryMatchesFilterKey,
} from '@nexconnect/customer-core';
import { buildProductFilterQuery } from '@nexconnect/customer-search';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbsComponent,
    ProductCardComponent,
  ],
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss'],
})
export class CategoryComponent implements OnDestroy {
  private readonly categoryKey = signal('');
  private readonly routeSub: Subscription;
  activeFilter = signal('All');
  sortBy = signal('Popularity');

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private state: AppStateService,
    public catalog: CatalogService,
  ) {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const key = this.normalize(params.get('id') || '');
      this.categoryKey.set(key);
      this.activeFilter.set('All');
      this.loadProductsForCategory(key);
    });
  }

  activeCategory = computed(() =>
    this.catalog
      .categories()
      .find((category) =>
        categoryMatchesFilterKey(category as any, this.categoryKey()),
      ),
  );
  title = computed(() => this.activeCategory()?.label ?? this.titleFromKey());
  allProducts = computed(() =>
    this.catalog.products().filter((product) =>
      categoryMatchesFilterKey(
        {
          id: product.raw?.category?.id || product.category,
          label: product.category,
          raw: { slug: product.raw?.category?.slug },
        } as any,
        this.categoryKey(),
      ),
    ),
  );
  categoryFilters = computed(() => {
    const labels = this.allProducts()
      .map((product) => product.category)
      .filter(Boolean);
    return ['All', ...Array.from(new Set(labels)).slice(0, 8)];
  });
  storeCount = computed(
    () =>
      new Set(
        this.visibleProducts()
          .map((product) => product.storeId || product.storeName)
          .filter(Boolean),
      ).size,
  );

  visibleProducts = computed(() => {
    let list = [...this.allProducts()];
    if (this.activeFilter() !== 'All')
      list = list.filter((product) => product.category === this.activeFilter());
    if (this.sortBy() === 'Price Low to High')
      list = [...list].sort((a, b) => a.price - b.price);
    if (this.sortBy() === 'Rating')
      list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  });

  headerIcon(): string {
    return this.filterIcon(this.title());
  }

  filterIcon(filter: string): string {
    const key = filter.toLowerCase();
    if (key === 'all') return 'apps';
    if (key.includes('fruit') || key.includes('veg')) return 'nutrition';
    if (key.includes('milk') || key.includes('dairy')) return 'local_drink';
    if (key.includes('snack')) return 'bakery_dining';
    if (key.includes('home')) return 'home';
    return 'category';
  }

  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl('/');
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  private loadProductsForCategory(categoryKey: string): void {
    const category = this.catalog
      .categories()
      .find((item) => categoryMatchesFilterKey(item as any, categoryKey));
    this.catalog.loadProducts(
      buildProductFilterQuery(
        {
          category: category?.raw?.slug || category?.id || categoryKey,
        },
        this.activeLocation(),
      ),
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

  private titleFromKey(): string {
    return this.categoryKey()
      .split('-')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ') || 'Category';
  }

  private normalize(value: string | null | undefined): string {
    return categoryFilterKey({ id: value || '', label: value || '' } as any);
  }
}
