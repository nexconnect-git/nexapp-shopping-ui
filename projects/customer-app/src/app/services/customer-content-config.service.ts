import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@shared/public-api';
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
  offers: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyCta: string;
    shopBanners: CustomerPromoCard[];
  };
  referral: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    codeTitle: string;
    rewardsTitle: string;
    rewardsSubtitle: string;
    unavailableCode: string;
    copiedMessage: string;
  };
  help: {
    title: string;
    subtitle: string;
    formLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    replyPlaceholder: string;
    submitLabel: string;
    submittingLabel: string;
    sendLabel: string;
    sendingLabel: string;
    ratingTitle: string;
    ratingPositive: string;
    ratingNegative: string;
    faqTitle: string;
    fallbackTopics: string[];
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
      { label: 'Search', icon: 'search', route: '/search' },
      { label: 'Stores', icon: 'storefront', route: '/stores' },
      { label: 'Cart', icon: 'shopping_cart', route: '/cart', badge: 'cart' },
      { label: 'Orders', icon: 'receipt_long', route: '/orders' },
      { label: 'Account', icon: 'person', route: '/profile' },
    ],
    footerGroups: [
      {
        title: 'Shop',
        links: [
          { label: 'Stores', route: '/stores' },
          { label: 'Offers', route: '/offers' },
          { label: 'Search', route: '/search' },
        ],
      },
      {
        title: 'Account',
        links: [
          { label: 'Orders', route: '/orders' },
          { label: 'Addresses', route: '/addresses' },
          { label: 'Wallet', route: '/wallet' },
        ],
      },
      {
        title: 'Support',
        links: [
          { label: 'Help', route: '/help' },
          { label: 'My Issues', route: '/issues' },
          { label: 'Referral', route: '/referral' },
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
      ctaUrl: '/stores',
      image: '',
    },
    sectionTitles: {
      topStores: 'Top Stores',
      recommended: 'Recommended for you',
    },
    categoryPromoCopy: 'Browse products from active stores',
    loadingCatalogTitle: 'Loading catalog',
    loadingCatalogSubtitle: 'Live store data will appear here',
    banners: [
      {
        id: 'fresh-start',
        eyebrow: 'Quick basket',
        title: 'Fresh essentials in minutes',
        subtitle:
          'Browse active stores, live stock, and nearby deals from one clean mobile flow.',
        ctaLabel: 'Start shopping',
        ctaUrl: '/search',
        icon: 'bolt',
        tone: 'purple',
      },
      {
        id: 'weekly-deals',
        eyebrow: 'Live offers',
        title: 'Deals from stores near you',
        subtitle:
          'Find free delivery, flat discounts, and bundle offers when vendors publish them.',
        ctaLabel: 'View offers',
        ctaUrl: '/offers',
        icon: 'local_offer',
        tone: 'orange',
      },
    ],
    engagementBanners: [
      {
        id: 'nextou-club',
        eyebrow: 'Nextou Club',
        title: 'Save more on repeat orders',
        subtitle:
          'Order again, collect offers, and keep your everyday essentials close.',
        ctaLabel: 'Explore rewards',
        ctaUrl: '/wallet',
        icon: 'workspace_premium',
        tone: 'green',
      },
    ],
  },
  ads: {
    home: [
      {
        id: 'home-ad-grocery',
        eyebrow: 'Today only',
        title: 'Top picks for your kitchen',
        subtitle: 'Curated products from live vendor catalogs.',
        ctaLabel: 'Shop picks',
        ctaUrl: '/search?q=grocery',
        icon: 'shopping_basket',
        tone: 'purple',
      },
      {
        id: 'home-ad-offers',
        eyebrow: 'Store promos',
        title: 'Free delivery and fresh deals',
        subtitle: 'Offers appear as vendors publish them.',
        ctaLabel: 'See stores',
        ctaUrl: '/stores',
        icon: 'delivery_truck_speed',
        tone: 'green',
      },
    ],
    search: [
      {
        id: 'search-ad',
        eyebrow: 'Tip',
        title: 'Use filters to find faster delivery',
        subtitle: 'Sort by rating, delivery time, category, or price.',
        ctaLabel: 'Open filters',
        ctaUrl: '',
        icon: 'tune',
        tone: 'blue',
      },
    ],
    storeListing: [
      {
        id: 'store-listing-offers',
        eyebrow: 'Running offers',
        title: 'Shop vendor deals near you',
        subtitle: 'Look for offer badges on store cards before checkout.',
        ctaLabel: 'Browse stores',
        ctaUrl: '/stores',
        icon: 'local_offer',
        tone: 'orange',
      },
    ],
    storeDetail: [
      {
        id: 'store-detail-offer',
        eyebrow: 'Store offer',
        title: 'Add more to unlock vendor deals',
        subtitle:
          'Final discounts and delivery estimates are confirmed at checkout.',
        ctaLabel: 'Add products',
        ctaUrl: '',
        icon: 'sell',
        tone: 'purple',
      },
    ],
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
      { label: 'Offers', icon: 'local_offer', action: 'offers' },
      { label: 'Ratings 4+', icon: 'star', action: 'rating_4_plus' },
      { label: 'Under budget', action: 'under_budget' },
    ],
  },
  cart: {
    miniCartTitle: 'Mini Cart',
    emptyTitle: 'Your cart is empty',
    emptyDescription: 'Browse nearby stores and add fresh essentials.',
    emptyCta: 'Browse Stores',
    browseCta: 'Browse products',
    securePayment: 'Safe and secure payments',
  },
  offers: {
    title: 'Offers & Coupons',
    subtitle: 'Live coupons from the active catalog',
    emptyTitle: 'No active coupons right now',
    emptyDescription:
      'Available offers will appear here as soon as the catalog has active coupons.',
    emptyCta: 'Browse stores',
    shopBanners: [
      {
        id: 'coupon-strip',
        eyebrow: 'Collect deals',
        title: 'Vendor offers update live',
        subtitle:
          'Coupon availability depends on your selected store, address, and cart value.',
        ctaLabel: 'Browse stores',
        ctaUrl: '/stores',
        icon: 'redeem',
        tone: 'purple',
      },
    ],
  },
  referral: {
    title: 'Refer and Earn',
    subtitle: 'For every friend who places their first Nextou order.',
    ctaLabel: 'Copy referral link',
    codeTitle: 'Your Referral Code',
    rewardsTitle: 'Your Rewards',
    rewardsSubtitle: 'Total Earned',
    unavailableCode: 'Referral code is not available',
    copiedMessage: 'Referral code copied',
  },
  help: {
    title: 'Order Help',
    subtitle: 'Tell us what went wrong with your order.',
    formLabel: 'Need Help?',
    messageLabel: 'Tell us more',
    messagePlaceholder: 'Describe the issue, item name, and what went wrong...',
    replyPlaceholder: 'Write your reply to support...',
    submitLabel: 'Submit',
    submittingLabel: 'Submitting...',
    sendLabel: 'Send Message',
    sendingLabel: 'Sending...',
    ratingTitle: 'Rate your experience',
    ratingPositive: 'Excellent',
    ratingNegative: 'Needs improvement',
    faqTitle: 'Common help topics',
    fallbackTopics: [
      'Order delayed',
      'Wrong or missing item',
      'Payment issue',
      'Refund status',
    ],
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
  const seenRoutes = new Set<string>();
  const nav = items
    .map((item) =>
      item.route === '/stores' || item.label.toLowerCase() === 'categories'
        ? {
            ...item,
            label: 'Stores',
            icon: item.icon === 'more_horiz' ? 'storefront' : item.icon,
            route: '/stores',
          }
        : item,
    )
    .filter((item) => {
      if (seenRoutes.has(item.route)) return false;
      seenRoutes.add(item.route);
      return true;
    });
  if (!nav.some((item) => item.route === '/stores')) {
    const cartIndex = nav.findIndex((item) => item.route === '/cart');
    const insertAt = cartIndex >= 0 ? cartIndex : Math.min(2, nav.length);
    nav.splice(insertAt, 0, {
      label: 'Stores',
      icon: 'storefront',
      route: '/stores',
    });
  }
  return nav;
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
  readonly offers = computed(() => this._config().offers);
  readonly referral = computed(() => this._config().referral);
  readonly help = computed(() => this._config().help);
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
