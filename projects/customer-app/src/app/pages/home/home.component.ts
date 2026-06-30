import { Component, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { UiService } from '../../services/ui.service';
import { categoryIconFor } from '../../shared/category-icons';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import {
  CustomerContentConfigService,
  type CustomerPromoCard,
} from '../../services/customer-content-config.service';
import {
  MobileQuickAction,
  MobileQuickActionGridComponent,
} from '../../mobile-ui/mobile-quick-action-grid/mobile-quick-action-grid.component';
import { MobileProductRowComponent } from '../../mobile-ui/mobile-product-row/mobile-product-row.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    ProductCardComponent,
    StoreCardComponent,
    MobileQuickActionGridComponent,
    MobileProductRowComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly defaultLocationLabel = 'Select location';

  private hasSelectedLocation = computed(() => {
    const selectedAddress = this.state.activeAddress();
    if (selectedAddress?.id) return true;
    const locationText = String(this.state.location() || '').trim();
    return !!locationText && locationText !== this.defaultLocationLabel;
  });
  hasLocation = computed(() => this.hasSelectedLocation());
  deliveryUnavailable = computed(
    () =>
      this.hasSelectedLocation() &&
      this.state.serviceability()?.is_serviceable === false,
  );
  serviceableStores = computed(() =>
    this.deliveryUnavailable()
      ? []
      : this.catalog
          .stores()
          .filter((store) => (store.raw as any)?.is_serviceable !== false),
  );
  serviceableStoreIds = computed(
    () => new Set(this.serviceableStores().map((store) => store.id)),
  );
  private homeProductPool = computed(() =>
    this.deliveryUnavailable()
      ? []
      : (
      this.catalog.products().length
        ? this.catalog.products()
        : this.catalog.topProducts()
    ).filter((product) => this.isServiceableProduct(product)),
  );
  noServiceableStores = computed(
    () =>
      this.hasSelectedLocation() &&
      (this.deliveryUnavailable() ||
        (!this.catalog.storesLoading() && !this.serviceableStores().length)),
  );
  homeProducts = computed(() =>
    this.deliveryUnavailable()
      ? []
      : this.catalog
          .topProducts()
          .filter(
            (product) =>
              !product.storeId ||
              this.serviceableStoreIds().has(product.storeId),
          )
          .slice(0, 8),
  );
  recentlyOrderedProducts = computed(() => {
    const buyAgain = this.catalog
      .buyAgainProducts()
      .filter((product) => this.isServiceableProduct(product));
    if (buyAgain.length) return buyAgain.slice(0, 6);
    const historyKeys = new Set(
      this.state
        .cart()
        .flatMap((item) => {
          const rawItem = item as any;
          return [
            rawItem.productId,
            rawItem.product_id,
            rawItem.id,
            rawItem.storeId,
            rawItem.store_id,
            item.category,
          ];
        })
        .map((value) => this.normalize(value))
        .filter(Boolean),
    );
    const pool = this.homeProductPool();
    const matches = pool.filter((product) =>
      [
        product.id,
        product.storeId,
        product.category,
        product.storeName,
        product.name,
      ].some((value) => historyKeys.has(this.normalize(value))),
    );
    return (matches.length ? matches : pool).slice(0, 6);
  });
  trendingProducts = computed(() =>
    [...this.homeProductPool()]
      .sort((a, b) => this.trendingScore(b) - this.trendingScore(a))
      .slice(0, 6),
  );
  newArrivalProducts = computed(() =>
    [...this.homeProductPool()]
      .sort((a, b) => this.productDateScore(b) - this.productDateScore(a))
      .slice(0, 6),
  );
  bestSellerProducts = computed(() =>
    [...this.homeProductPool()]
      .sort((a, b) => this.salesScore(b) - this.salesScore(a))
      .slice(0, 6),
  );
  flashDealProducts = computed(() =>
    this.homeProductPool()
      .filter((product) => {
        const mrp = Number(product.mrp || 0);
        const price = Number(product.price || 0);
        return !!product.discount || (mrp > 0 && price > 0 && mrp > price);
      })
      .slice(0, 8),
  );
  heroBanner = computed(() => this.catalog.banners()[0] || null);
  heroStore = computed(
    () =>
      this.serviceableStores()[0] ||
      this.catalog.featuredStores()[0] ||
      this.catalog.stores()[0] ||
      null,
  );
  heroImage = computed(
    () =>
      this.catalog.homeHero()?.image ||
      this.heroBanner()?.image ||
      this.heroStore()?.hero ||
      this.catalog.topProducts()[0]?.image ||
      this.content.home().fallbackHero.image ||
      '/assets/placeholders/product.svg',
  );
  heroBackground = computed(() => this.heroBanner()?.bgGradient || null);
  heroTitle = computed(
    () =>
      this.catalog.homeHero()?.title ||
      this.heroBanner()?.title ||
      this.content.home().fallbackHero.title,
  );
  heroSubtitle = computed(() => {
    const apiSubtitle = this.catalog.homeHero()?.subtitle;
    if (apiSubtitle) return apiSubtitle;
    const bannerSubtitle = this.heroBanner()?.subtitle;
    if (bannerSubtitle) {
      return bannerSubtitle;
    }
    const store = this.heroStore();
    return store
      ? `Fresh ${store.category || 'daily essentials'} from ${store.name}`
      : this.content.home().fallbackHero.subtitle;
  });
  heroBadge = computed(
    () =>
      this.catalog.homeHero()?.badge ||
      this.heroBanner()?.badgeText ||
      this.heroStore()?.eta ||
      this.content.home().fallbackHero.badge,
  );
  heroCtaLabel = computed(
    () =>
      this.catalog.homeHero()?.cta_label ||
      this.heroBanner()?.ctaLabel || this.content.home().fallbackHero.ctaLabel,
  );
  heroCtaUrl = computed(
    () =>
      this.catalog.homeHero()?.cta_url ||
      this.heroBanner()?.ctaUrl ||
      this.content.home().fallbackHero.ctaUrl,
  );
  promoCoupons = computed(() =>
    this.deliveryUnavailable() ? [] : this.catalog.topCoupons().slice(0, 2),
  );
  promoCategories = computed(() =>
    this.rankCategoriesByHistory(
      this.catalog.categories().filter((category) => category.id !== 'all'),
    ).slice(0, 2),
  );
  mobileCategories = computed(() =>
    this.rankCategoriesByHistory(
      this.catalog.categories().filter((category) => category.id !== 'all'),
    ).slice(0, 6),
  );
  homePromos = computed<CustomerPromoCard[]>(() => {
    if (this.deliveryUnavailable()) return [];
    const liveBanners = this.catalog
      .banners()
      .slice(1, 3)
      .map((banner) => ({
        id: banner.id,
        eyebrow: banner.badgeText,
        title: banner.title,
        subtitle: banner.subtitle,
        ctaLabel: banner.ctaLabel,
        ctaUrl: banner.ctaUrl,
        icon: 'campaign',
        tone: 'purple' as const,
        template: 'soft_card' as const,
        image: banner.image || undefined,
      }));

    if (liveBanners.length) {
      return liveBanners;
    }

    const contentPromos = this.content.ads().home;
    return contentPromos;
  });
  engagementBanner = computed(
    () => this.content.home().engagementBanners[0] || null,
  );
  readonly quickActions = computed<MobileQuickAction[]>(() => [
    {
      id: 'deals',
      label: 'Nearby deals',
      icon: 'local_offer',
      route: '/explore',
    },
    {
      id: 'nearby',
      label: 'Nearby shops',
      icon: 'storefront',
      route: '/explore',
    },
    {
      id: 'essentials',
      label: 'Daily essentials',
      icon: 'inventory_2',
      route: '/explore',
    },
    {
      id: 'recommended',
      label: 'Recommended',
      icon: 'favorite',
      route: '/explore',
    },
  ]);
  constructor(
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
    public content: CustomerContentConfigService,
    private router: Router,
  ) {}

  categoryIcon(category: unknown): string {
    return categoryIconFor(category as any);
  }

  routePath(url: string | null | undefined): string {
    return this._splitUrl(url).path;
  }

  routeQuery(url: string | null | undefined): Record<string, string> | null {
    return this._splitUrl(url).query;
  }

  openCategory(categoryId: string): void {
    const id = String(categoryId || '').trim();
    this.router.navigate(['/explore'], {
      queryParams: id && id !== 'all' ? { category: id } : {},
    });
  }

  openProduct(productId: string): void {
    if (!productId) return;
    this.router.navigate(['/product', productId]);
  }

  openLocationPicker(): void {
    this.ui.openLocation();
  }

  private _splitUrl(url: string | null | undefined): {
    path: string;
    query: Record<string, string> | null;
  } {
    const safeUrl = (url || '/explore').trim() || '/explore';
    const [path, queryString] = safeUrl.split('?', 2);
    const normalizedPath = [
      '/offers',
      '/wallet',
      '/wishlist',
      '/favorites',
      '/referral',
      '/help',
      '/issues',
      '/my-issues',
      '/payments',
    ].includes(path)
      ? '/explore'
      : path;
    const query: Record<string, string> = {};
    new URLSearchParams(queryString || '').forEach((value, key) => {
      query[key] = value;
    });
    return {
      path: normalizedPath || '/explore',
      query: Object.keys(query).length ? query : null,
    };
  }

  private rankCategoriesByHistory<T extends { label?: string }>(
    categories: T[],
  ): T[] {
    const preferred = new Set(
      this.state
        .cart()
        .map((item) => this.normalize(item.category))
        .filter(Boolean),
    );
    return [...categories].sort((a, b) => {
      const aPreferred = preferred.has(this.normalize(a.label));
      const bPreferred = preferred.has(this.normalize(b.label));
      if (aPreferred === bPreferred)
        return String(a.label || '').localeCompare(String(b.label || ''));
      return aPreferred ? -1 : 1;
    });
  }

  private isServiceableProduct(product: { storeId?: string | null; raw?: any }): boolean {
    const vendor = product.raw?.vendor || product.raw?.store;
    const openForShopping = vendor
      ? (vendor?.is_open_now ?? vendor?.is_open) !== false &&
        vendor?.is_accepting_orders !== false
      : true;
    return (
      openForShopping &&
      (!product.storeId || this.serviceableStoreIds().has(product.storeId))
    );
  }

  private trendingScore(product: any): number {
    return (
      this.salesScore(product) * 2 +
      this.numberFrom(product.rating ?? product.raw?.average_rating) * 10 +
      this.numberFrom(product.raw?.review_count ?? product.raw?.ratings_count)
    );
  }

  private salesScore(product: any): number {
    return this.numberFrom(
      product.raw?.total_orders ??
        product.raw?.sold_count ??
        product.raw?.order_count ??
        product.raw?.orders_count ??
        0,
    );
  }

  private productDateScore(product: any): number {
    const value =
      product.raw?.created_at ||
      product.raw?.updated_at ||
      product.raw?.listed_at ||
      '';
    const timestamp = Date.parse(String(value));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private numberFrom(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
