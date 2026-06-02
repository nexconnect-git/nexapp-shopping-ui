import { Location } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import {
  categoryFilterKey,
  categoryMatchesFilterKey,
} from '@nexconnect/customer-core';
import { buildProductFilterQuery } from '@nexconnect/customer-search';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';

@Component({
  standalone: true,
  imports: [RouterLink, BreadcrumbsComponent, ProductCardComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
})
export class CategoriesComponent {
  readonly availabilityOptions = ['All', 'In stock', 'Instant delivery'];
  readonly sortOptions = [
    'Relevance',
    'Price: Low to High',
    'Price: High to Low',
    'Fastest Delivery',
  ];

  activeCategoryKey = signal('all');
  activeSubcategoryKey = signal('all');
  availabilityFilter = signal('All');
  sortBy = signal('Relevance');

  categories = computed(() =>
    this.catalog.categories().filter((category) => category.id !== 'all'),
  );
  activeCategory = computed(() =>
    this.categories().find((category) =>
      categoryMatchesFilterKey(category as any, this.activeCategoryKey()),
    ),
  );
  title = computed(() => this.activeCategory()?.label || 'All categories');
  categoryProducts = computed(() => {
    const active = this.activeCategoryKey();
    if (active === 'all') return this.catalog.topProducts();
    return this.catalog.products().filter((product) => {
      const rawCategory = product.raw?.category;
      return (
        categoryMatchesFilterKey(
          {
            id: product.raw?.category?.id || product.category,
            label: product.category,
            raw: {
              slug: rawCategory?.slug,
            },
          } as any,
          active,
        ) || categoryMatchesFilterKey(this.activeCategory() as any, active)
      );
    });
  });
  subcategoryChips = computed(() => {
    const chips = new Map<string, string>();
    const active = this.activeCategory();
    const rawChildren = [
      ...(((active?.raw as any)?.children as any[]) || []),
      ...(((active?.raw as any)?.subcategories as any[]) || []),
    ];

    rawChildren.forEach((child) => {
      const label = child?.label || child?.name || child?.title;
      const key = child?.slug || child?.id || label;
      if (label && key) chips.set(this.normalize(String(key)), String(label));
    });

    this.categoryProducts().forEach((product) => {
      const raw = product.raw as any;
      const label =
        raw?.subcategory?.name ||
        raw?.subcategory?.label ||
        raw?.sub_category?.name ||
        raw?.sub_category?.label ||
        raw?.category?.parent?.name ||
        '';
      const key =
        raw?.subcategory?.slug ||
        raw?.subcategory?.id ||
        raw?.sub_category?.slug ||
        raw?.sub_category?.id ||
        label;
      if (label && key && this.normalize(label) !== this.activeCategoryKey()) {
        chips.set(this.normalize(String(key)), String(label));
      }
    });

    return Array.from(chips, ([key, label]) => ({ key, label })).slice(0, 10);
  });
  filteredCategoryProducts = computed(() => {
    const subcategory = this.activeSubcategoryKey();
    const availability = this.availabilityFilter();
    const sortBy = this.sortBy();
    let products = [...this.categoryProducts()];

    if (subcategory !== 'all') {
      products = products.filter((product) =>
        this.productSubcategoryKeys(product).includes(subcategory),
      );
    }
    if (availability === 'In stock') {
      products = products.filter((product) => this.productInStock(product));
    }
    if (availability === 'Instant delivery') {
      products = products.filter((product) => this.productInstantEligible(product));
    }

    products.sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price;
      if (sortBy === 'Price: High to Low') return b.price - a.price;
      if (sortBy === 'Fastest Delivery')
        return this.etaMinutes(a) - this.etaMinutes(b);
      return this.relevanceScore(b) - this.relevanceScore(a);
    });
    return products;
  });
  matchingStoreCount = computed(
    () =>
      new Set(
        this.filteredCategoryProducts()
          .map((product) => product.storeId || product.storeName)
          .filter(Boolean),
      ).size,
  );
  serviceableStoreCount = computed(
    () =>
      this.catalog
        .stores()
        .filter((store) => (store.raw as any)?.is_serviceable !== false)
        .length,
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    public catalog: CatalogService,
    public state: AppStateService,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      const next = this.normalize(params.get('category') || 'all') || 'all';
      this.activeCategoryKey.set(next);
      this.activeSubcategoryKey.set('all');
      this.loadProductsForCategory(next);
    });
  }

  selectCategory(categoryKey: string): void {
    const key = this.normalize(categoryKey || 'all') || 'all';
    this.router.navigate(['/categories'], {
      queryParams: key === 'all' ? {} : { category: key },
    });
  }

  openCategory(categoryKey: string): void {
    const key = this.normalize(categoryKey || 'all') || 'all';
    if (key === 'all') {
      this.router.navigate(['/categories']);
      return;
    }
    this.router.navigate(['/category', key]);
  }

  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl('/');
  }

  selectSubcategory(subcategoryKey: string): void {
    this.activeSubcategoryKey.set(this.normalize(subcategoryKey || 'all') || 'all');
  }

  setAvailabilityFilter(filter: string): void {
    this.availabilityFilter.set(filter);
  }

  setSort(sort: string): void {
    this.sortBy.set(sort);
  }

  iconFor(label: string): string {
    const key = this.normalize(label);
    if (key.includes('fruit') || key.includes('veg')) return 'nutrition';
    if (key.includes('dairy') || key.includes('milk')) return 'local_drink';
    if (key.includes('bakery') || key.includes('bread')) return 'bakery_dining';
    if (key.includes('drink') || key.includes('beverage')) return 'local_cafe';
    if (key.includes('pharmacy') || key.includes('health'))
      return 'local_pharmacy';
    if (key.includes('home')) return 'home';
    return 'category';
  }

  private loadProductsForCategory(categoryKey: string): void {
    const category = this.categories().find((item) =>
      categoryMatchesFilterKey(item as any, categoryKey),
    );
    this.catalog.loadProducts(
      buildProductFilterQuery(
        {
          category:
            categoryKey === 'all'
              ? ''
              : category?.raw?.slug || category?.id || categoryKey,
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

  private productSubcategoryKeys(product: any): string[] {
    const raw = product.raw || {};
    return [
      raw?.subcategory?.slug,
      raw?.subcategory?.id,
      raw?.subcategory?.name,
      raw?.subcategory?.label,
      raw?.sub_category?.slug,
      raw?.sub_category?.id,
      raw?.sub_category?.name,
      raw?.sub_category?.label,
      raw?.category?.parent?.slug,
      raw?.category?.parent?.id,
      raw?.category?.parent?.name,
      product.category,
    ]
      .map((value) => this.normalize(value))
      .filter(Boolean);
  }

  private productInStock(product: any): boolean {
    const stock = Number(
      product.raw?.stock ??
        product.raw?.stock_qty ??
        product.raw?.available_stock ??
        product.raw?.quantity ??
        1,
    );
    return product.raw?.in_stock !== false && stock > 0;
  }

  private productInstantEligible(product: any): boolean {
    return product.raw?.is_serviceable !== false && this.etaMinutes(product) <= 45;
  }

  private etaMinutes(product: any): number {
    const eta = product.eta || product.storeEta || product.raw?.eta || '';
    const match = String(eta).match(/\d+/);
    return match ? Number(match[0]) : 999;
  }

  private relevanceScore(product: any): number {
    return (
      Number(product.raw?.total_orders || product.raw?.sold_count || 0) * 2 +
      Number(product.rating || product.raw?.average_rating || 0) * 10
    );
  }

  private normalize(value: string | null | undefined): string {
    return categoryFilterKey({ id: value || '', label: value || '' } as any);
  }
}
