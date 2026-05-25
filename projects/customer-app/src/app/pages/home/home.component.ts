import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { StoreCardComponent } from '../../components/store-card/store-card.component';
import { RightRailComponent } from '../../components/right-rail/right-rail.component';
import { UiService } from '../../services/ui.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { categoryIconFor } from '../../shared/category-icons';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    ProductCardComponent,
    StoreCardComponent,
    RightRailComponent,
    BreadcrumbsComponent,
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
    this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .slice(0, 2),
  );
  homePromos = computed(() => {
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
        image: banner.image || undefined,
      }));
    return liveBanners.length ? liveBanners : this.content.ads().home;
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
}
