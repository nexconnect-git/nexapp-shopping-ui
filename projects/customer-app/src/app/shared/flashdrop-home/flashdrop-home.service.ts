import { computed, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Product, Store } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { categoryIconFor } from '../category-icons';
import {
  FlashCategory,
  FlashHomeState,
  FlashProduct,
  FlashPromotion,
  FlashStore,
} from './flashdrop-home.models';

type FlashTab =
  | 'home'
  | 'search'
  | 'categories'
  | 'cart'
  | 'orders'
  | 'account';

@Injectable({ providedIn: 'root' })
export class FlashdropHomeService {
  readonly searchQuery = signal('');
  readonly activeCategoryId = signal('all');
  readonly selectedTab = signal<FlashTab>('home');
  readonly toast = signal('');

  readonly locationLabel = computed(
    () => this.state.location() || 'Set location',
  );
  readonly cartCount = computed(() => this.state.itemCount());

  readonly categories = computed<FlashCategory[]>(() => {
    const liveCategories = this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .slice(0, 5)
      .map((category) => ({
        id: category.id,
        name: category.label,
        icon: categoryIconFor(category),
        route: `/category/${category.id}`,
        source: category,
      }));

    return [
      { id: 'all', name: 'Grocery', icon: '🛒', route: '/stores' },
      ...liveCategories,
      { id: 'more', name: 'More', icon: '⋯', route: '/stores' },
    ].slice(0, 6);
  });

  readonly quickTiles = computed<FlashCategory[]>(() => [
    { id: 'deals', name: "Today's deals", icon: '🎁', route: '/offers' },
    { id: 'shops', name: 'Nearby shops', icon: '🏪', route: '/stores' },
    {
      id: 'daily',
      name: 'Daily essentials',
      icon: '🛍️',
      route: '/search?q=milk,bread,eggs',
    },
    { id: 'recommended', name: 'Recommended', icon: '⭐', route: '/search' },
  ]);

  readonly promotions = computed<FlashPromotion[]>(() => {
    const coupons = this.catalog
      .topCoupons()
      .slice(0, 2)
      .map((coupon, index) => ({
        id: coupon.id || coupon.code || `coupon-${index}`,
        title: coupon.badgeText || coupon.title || 'Fresh deal',
        subtitle: coupon.description || 'Live offer from nearby stores',
        code: coupon.code || undefined,
        icon: coupon.iconName?.includes('delivery') ? '🛵' : '🏷️',
        tone: (index === 1 ? 'green' : 'purple') as FlashPromotion['tone'],
      }));

    if (coupons.length) return coupons;

    const banners = this.catalog
      .banners()
      .slice(0, 2)
      .map((banner, index) => ({
        id: banner.id || `banner-${index}`,
        title: banner.badgeText || banner.title,
        subtitle: banner.subtitle,
        code: banner.ctaLabel,
        icon: index === 1 ? '🛵' : '🏷️',
        tone: (index === 1 ? 'green' : 'purple') as FlashPromotion['tone'],
      }));

    return banners.length
      ? banners
      : [
          {
            id: 'fresh-offers',
            title: 'Fresh offers',
            subtitle: 'Deals appear as stores publish them',
            code: 'LIVE',
            icon: '🎁',
            tone: 'purple',
          },
          {
            id: 'nearby-delivery',
            title: 'Fast delivery',
            subtitle: 'Shop from stores near your location',
            code: '20 MINS',
            icon: '🛵',
            tone: 'green',
          },
        ];
  });

  readonly stores = computed<FlashStore[]>(() =>
    this.catalog
      .stores()
      .slice(0, 8)
      .map((store) => this.mapStore(store)),
  );
  readonly products = computed<FlashProduct[]>(() => {
    const recommended = this.catalog.recommendedProducts();
    return (recommended.length ? recommended : this.catalog.products())
      .slice(0, 12)
      .map((product) => this.mapProduct(product));
  });

  readonly filteredStores = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeCategoryId();

    return this.stores().filter((store) => {
      const matchesQuery =
        !query ||
        `${store.name} ${store.category}`.toLowerCase().includes(query);
      const matchesCategory =
        category === 'all' ||
        category === 'more' ||
        store.category.toLowerCase().includes(category);
      return matchesQuery && matchesCategory;
    });
  });

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeCategoryId();

    return this.products().filter((product) => {
      const matchesQuery =
        !query ||
        `${product.name} ${product.unit}`.toLowerCase().includes(query);
      const matchesCategory =
        category === 'all' ||
        category === 'more' ||
        String(product.category || '')
          .toLowerCase()
          .includes(category);
      return matchesQuery && matchesCategory;
    });
  });

  readonly stateView = computed<FlashHomeState>(() => ({
    locationLabel: this.locationLabel(),
    searchQuery: this.searchQuery(),
    cartCount: this.cartCount(),
    categories: this.categories(),
    promotions: this.promotions(),
    stores: this.filteredStores(),
    products: this.filteredProducts(),
  }));

  constructor(
    private readonly catalog: CatalogService,
    private readonly state: AppStateService,
    private readonly ui: UiService,
    private readonly router: Router,
  ) {
    this.selectedTab.set(this.tabFromUrl(this.router.url));
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => {
        this.selectedTab.set(this.tabFromUrl(event.urlAfterRedirects));
      });
  }

  setCategory(id: string): void {
    this.activeCategoryId.set(id);
    if (id === 'more') {
      this.router.navigate(['/stores']);
      return;
    }
    const category = this.categories().find((item) => item.id === id);
    if (category) this.showToast(`${category.name} selected`);
  }

  openLocation(): void {
    this.ui.openLocation();
  }

  openOffers(): void {
    this.router.navigate(['/offers']);
  }

  openNotifications(): void {
    this.showToast('Notifications will appear here when available');
  }

  openStore(store: FlashStore): void {
    this.router.navigate(['/store', store.id]);
  }

  openProduct(product: FlashProduct): void {
    this.router.navigate(['/product', product.id]);
  }

  addToCart(product: FlashProduct): void {
    const raw = product.rawProduct as Product | undefined;
    if (!raw) {
      this.showToast('Product is still loading');
      return;
    }
    this.state.addToCart(raw);
  }

  navigateTab(tab: FlashTab): void {
    this.selectedTab.set(tab);
    const routes: Record<FlashTab, string> = {
      home: '/',
      search: '/search',
      categories: '/stores',
      cart: '/cart',
      orders: '/orders',
      account: '/profile',
    };
    this.router.navigateByUrl(routes[tab]);
  }

  openQuickTile(id: string): void {
    const tile = this.quickTiles().find((item) => item.id === id);
    if (tile?.route) {
      this.router.navigateByUrl(tile.route);
      return;
    }
    this.showToast(`${tile?.name || 'Section'} opened`);
  }

  submitSearch(): void {
    const query = this.searchQuery().trim();
    if (!query) {
      this.router.navigate(['/search']);
      return;
    }
    this.catalog.refreshSearch(query);
    this.router.navigate(['/search'], { queryParams: { q: query } });
  }

  isImageUrl(value: string): boolean {
    return /^(https?:|assets\/|\/assets\/|data:image\/)/i.test(
      String(value || ''),
    );
  }

  showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2200);
  }

  private mapStore(store: Store): FlashStore {
    const eta = Number.parseInt(
      String(store.eta || '').match(/\d+/)?.[0] || '20',
      10,
    );
    const logoText =
      store.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'FD';

    return {
      id: store.id,
      name: store.name,
      category: store.category || 'Store',
      rating: Number(store.rating || 0),
      etaMinutes: Number.isFinite(eta) ? eta : 20,
      freeDelivery: /free/i.test(`${store.delivery} ${store.offer}`),
      imageUrl: store.image || store.hero || '',
      logoText,
      logoTone: this.logoTone(store.name),
      rawStore: store,
    };
  }

  private mapProduct(product: Product): FlashProduct {
    const price = Number(product.price || 0);
    const mrp = Number(product.mrp || 0);
    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      price,
      comparePrice: mrp > price ? mrp : undefined,
      image: product.image || this.emojiForProduct(product),
      badge: product.discount || undefined,
      category: product.category,
      storeId: product.storeId,
      rawProduct: product,
    };
  }

  private emojiForProduct(product: Product): string {
    const text = `${product.name} ${product.category}`.toLowerCase();
    if (text.includes('milk')) return '🥛';
    if (text.includes('bread') || text.includes('bakery')) return '🍞';
    if (text.includes('apple')) return '🍎';
    if (text.includes('banana')) return '🍌';
    if (text.includes('vegetable') || text.includes('fresh')) return '🥦';
    return '🛍️';
  }

  private logoTone(name: string): FlashStore['logoTone'] {
    const tones: FlashStore['logoTone'][] = ['green', 'black', 'red', 'purple'];
    const index =
      Math.abs([...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)) %
      tones.length;
    return tones[index];
  }

  private tabFromUrl(url: string): FlashTab {
    if (url.startsWith('/search')) return 'search';
    if (url.startsWith('/cart')) return 'cart';
    if (url.startsWith('/orders') || url.startsWith('/tracking'))
      return 'orders';
    if (
      url.startsWith('/profile') ||
      url.startsWith('/addresses') ||
      url.startsWith('/wallet') ||
      url.startsWith('/wishlist')
    )
      return 'account';
    if (url.startsWith('/stores') || url.startsWith('/category'))
      return 'categories';
    return 'home';
  }
}
