import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
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

@Component({
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbsComponent,
    ProductCardComponent,
    StoreCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  heroBanner = computed(() => this.catalog.banners()[0] || null);
  heroStore = computed(
    () => this.catalog.featuredStores()[0] || this.catalog.stores()[0] || null,
  );
  heroImage = computed(
    () =>
      this.heroBanner()?.image ||
      this.heroStore()?.hero ||
      this.catalog.topProducts()[0]?.image ||
      this.content.home().fallbackHero.image,
  );
  heroBackground = computed(() => this.heroBanner()?.bgGradient || null);
  heroTitle = computed(
    () => this.heroBanner()?.title || this.content.home().fallbackHero.title,
  );
  heroSubtitle = computed(() => {
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
      this.heroBanner()?.badgeText ||
      this.heroStore()?.eta ||
      this.content.home().fallbackHero.badge,
  );
  heroCtaLabel = computed(
    () =>
      this.heroBanner()?.ctaLabel || this.content.home().fallbackHero.ctaLabel,
  );
  heroCtaUrl = computed(
    () => this.heroBanner()?.ctaUrl || this.content.home().fallbackHero.ctaUrl,
  );
  promoCoupons = computed(() => this.catalog.topCoupons().slice(0, 2));
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
    const contentPromos = this.content.ads().home;
    if (contentPromos.length) {
      return contentPromos;
    }
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
    return liveBanners;
  });
  engagementBanner = computed(
    () => this.content.home().engagementBanners[0] || null,
  );

  constructor(
    public catalog: CatalogService,
    public state: AppStateService,
    public ui: UiService,
    public content: CustomerContentConfigService,
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

  private _splitUrl(url: string | null | undefined): {
    path: string;
    query: Record<string, string> | null;
  } {
    const safeUrl = (url || '/search').trim() || '/search';
    const [path, queryString] = safeUrl.split('?', 2);
    const query: Record<string, string> = {};
    new URLSearchParams(queryString || '').forEach((value, key) => {
      query[key] = value;
    });
    return {
      path: path || '/search',
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

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
