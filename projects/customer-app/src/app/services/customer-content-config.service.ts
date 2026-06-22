import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@shared/lib/tokens/api-url.token';
import { catchError, of } from 'rxjs';

export interface CustomerNavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  badge?: 'cart';
}

export interface CustomerFooterGroup {
  title: string;
  links: Array<{ label: string; route: string }>;
}

export interface CustomerQuickFilter {
  label: string;
  icon?: string;
  action: 'fast_delivery' | 'offers' | 'rating_4_plus' | 'under_budget';
}

export interface CustomerPromoCard {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  icon?: string;
  tone?: 'purple' | 'green' | 'orange' | 'red' | 'blue';
  template?: 'soft_card' | 'club_banner' | 'image_card';
  image?: string;
}

export interface CustomerContentConfig {
  navigation: {
    bottomNav: CustomerNavItem[];
    footerGroups: CustomerFooterGroup[];
  };
  home: {
    fallbackHero: {
      badge: string;
      title: string;
      subtitle: string;
      ctaLabel: string;
      ctaUrl: string;
      image: string;
    };
    sectionTitles: {
      topStores: string;
      recommended: string;
    };
    categoryPromoCopy: string;
    loadingCatalogTitle: string;
    loadingCatalogSubtitle: string;
    banners: CustomerPromoCard[];
    engagementBanners: CustomerPromoCard[];
  };
  ads: {
    home: CustomerPromoCard[];
    search: CustomerPromoCard[];
    storeListing: CustomerPromoCard[];
    storeDetail: CustomerPromoCard[];
  };
  search: {
    tabs: Array<'All' | 'Stores' | 'Products' | 'Categories'>;
    subtitle: string;
    emptyTitle: string;
    emptyFiltered: string;
    emptyDefault: string;
    clearFiltersLabel: string;
  };
  filters: {
    title: string;
    subtitle: string;
    deliveryTitle: string;
    sortTitle: string;
    offersTitle: string;
    categoriesTitle: string;
    priceTitle: string;
    resetLabel: string;
    applyLabel: string;
    sortOptions: string[];
    quickFilters: CustomerQuickFilter[];
  };
  cart: {
    miniCartTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyCta: string;
    browseCta: string;
    securePayment: string;
  };
  messages: {
    locationPrompt: string;
    loginPrompt: string;
  };
}

export const DEFAULT_CUSTOMER_CONTENT_CONFIG: CustomerContentConfig = {
  navigation: {
    bottomNav: [
      { label: 'Home', icon: 'home', route: '/', exact: true },
      { label: 'Stores', icon: 'storefront', route: '/stores' },
      { label: 'Search', icon: 'search', route: '/search' },
      { label: 'Cart', icon: 'shopping_cart', route: '/cart', badge: 'cart' },
      { label: 'Account', icon: 'person', route: '/account' },
    ],
    footerGroups: [
      {
        title: 'Shop',
        links: [
          { label: 'Explore', route: '/explore' },
          { label: 'Explore', route: '/explore' },
        ],
      },
      {
        title: 'Account',
        links: [
          { label: 'Orders', route: '/orders' },
          { label: 'Addresses', route: '/addresses' },
        ],
      },
    ],
  },
  home: {
    fallbackHero: {
      badge: 'Live now',
      title: 'Browse nearby stores',
      subtitle:
        'Live catalog, prices, and availability update from the server.',
      ctaLabel: 'Shop now',
      ctaUrl: '/explore',
      image: '',
    },
    sectionTitles: {
      topStores: 'Top Stores',
      recommended: 'Recommended for you',
    },
    categoryPromoCopy: 'Browse products from active stores',
    loadingCatalogTitle: 'Loading catalog',
    loadingCatalogSubtitle: 'Live store data will appear here',
    banners: [],
    engagementBanners: [],
  },
  ads: {
    home: [],
    search: [],
    storeListing: [],
    storeDetail: [],
  },
  search: {
    tabs: ['All', 'Stores', 'Products', 'Categories'],
    subtitle: 'Showing results near your selected location',
    emptyTitle: 'No matching results',
    emptyFiltered:
      'Your active filters may be hiding available items. Clear filters or try a different location.',
    emptyDefault: 'Try another search term or change your delivery location.',
    clearFiltersLabel: 'Clear filters',
  },
  filters: {
    title: 'Filters',
    subtitle: 'Refine stores and products',
    deliveryTitle: 'Delivery Speed',
    sortTitle: 'Sort By',
    offersTitle: 'Offers',
    categoriesTitle: 'Categories',
    priceTitle: 'Price Range',
    resetLabel: 'Reset',
    applyLabel: 'Apply Filters',
    sortOptions: ['Relevance', 'Rating', 'Delivery Time', 'Price Low to High'],
    quickFilters: [
      { label: 'Fast Delivery', icon: 'bolt', action: 'fast_delivery' },
      { label: 'Ratings 4+', icon: 'star', action: 'rating_4_plus' },
      { label: 'Under budget', action: 'under_budget' },
    ],
  },
  cart: {
    miniCartTitle: 'Mini Cart',
    emptyTitle: 'Your cart is empty',
    emptyDescription: 'Browse nearby stores and add fresh essentials.',
    emptyCta: 'Explore products',
    browseCta: 'Browse products',
    securePayment: 'Safe and secure payments',
  },
  messages: {
    locationPrompt:
      'Set your delivery location to see available stores near you.',
    loginPrompt: 'Sign in to continue with your order.',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig<T>(base: T, incoming: Partial<T> | null | undefined): T {
  if (!isRecord(base) || !isRecord(incoming)) return (incoming ?? base) as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    const current = (base as Record<string, unknown>)[key];
    result[key] =
      isRecord(current) && isRecord(value)
        ? mergeConfig(current, value)
        : value;
  }
  return result as T;
}

function normalizeBottomNav(items: CustomerNavItem[]): CustomerNavItem[] {
  const removedRoutes = new Set([
    '/offers',
    '/wallet',
    '/wishlist',
    '/favorites',
    '/referral',
    '/help',
    '/issues',
    '/my-issues',
    '/notifications',
    '/payments',
    '/orders',
    '/categories',
  ]);
  const seenRoutes = new Set<string>();
  const nav = items.filter((item) => {
    if (removedRoutes.has(item.route) || seenRoutes.has(item.route)) return false;
    seenRoutes.add(item.route);
    return true;
  });
  const required: CustomerNavItem[] = [
    { label: 'Home', icon: 'home', route: '/', exact: true },
    { label: 'Stores', icon: 'storefront', route: '/stores' },
    { label: 'Search', icon: 'search', route: '/search' },
    { label: 'Cart', icon: 'shopping_cart', route: '/cart', badge: 'cart' },
    { label: 'Account', icon: 'person', route: '/account' },
  ];
  for (const item of required) {
    if (!seenRoutes.has(item.route)) nav.push(item);
  }
  return nav.slice(0, 5);
}

@Injectable({ providedIn: 'root' })
export class CustomerContentConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly _config = signal<CustomerContentConfig>(
    DEFAULT_CUSTOMER_CONTENT_CONFIG,
  );

  readonly config = this._config.asReadonly();
  readonly bottomNav = computed(() =>
    normalizeBottomNav(this._config().navigation.bottomNav),
  );
  readonly footerGroups = computed(
    () => this._config().navigation.footerGroups,
  );
  readonly home = computed(() => this._config().home);
  readonly ads = computed(() => this._config().ads);
  readonly search = computed(() => this._config().search);
  readonly filters = computed(() => this._config().filters);
  readonly cart = computed(() => this._config().cart);
  readonly messages = computed(() => this._config().messages);

  load(): void {
    // Backend contract: GET /api/orders/customer-app/content-config/ returns
    // CustomerContentConfig. Future admin CMS work can persist these values
    // instead of returning the default server payload.
    this.http
      .get<Partial<CustomerContentConfig>>(
        `${this.baseUrl}/orders/customer-app/content-config/`,
      )
      .pipe(catchError(() => of(null)))
      .subscribe((config) => {
        this._config.set(mergeConfig(DEFAULT_CUSTOMER_CONTENT_CONFIG, config));
      });
  }
}
