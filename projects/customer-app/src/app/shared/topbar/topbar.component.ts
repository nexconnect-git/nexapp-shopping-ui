import { Component, computed, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppCurrencyPipe, PageFeatureAccessService } from '@shared/public-api';
import { buildStoreSelectionTarget } from '@nexconnect/customer-search';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'fd-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AppCurrencyPipe],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent {
  query = signal('');
  searchOpen = signal(false);

  constructor(
    public state: AppStateService,
    public ui: UiService,
    public auth: AuthService,
    public features: PageFeatureAccessService,
    private catalog: CatalogService,
    private router: Router,
  ) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url.startsWith('/search')) {
          const parsed = this.router.parseUrl(this.router.url);
          this.query.set((parsed.queryParams['q'] as string) ?? '');
        }
      });
  }

  searchResults = computed(() => this.catalog.search(this.query()));
  quickSuggestions = computed(() => {
    const productNames = this.catalog
      .products()
      .map((product) => product.name)
      .filter(Boolean);
    const categoryNames = this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .map((category) => category.label);
    return [...new Set([...productNames, ...categoryNames])].slice(0, 6);
  });
  menuCategories = computed(() =>
    this.catalog
      .categories()
      .filter((category) => category.id !== 'all')
      .slice(0, 3),
  );
  totalResults = computed(() => {
    const r = this.searchResults();
    return r.stores.length + r.products.length + r.categories.length;
  });

  onSearch(value: string): void {
    this.query.set(value);
    this.catalog.refreshSearch(value);
    this.searchOpen.set(true);
  }
  clearSearch(): void {
    this.query.set('');
    this.catalog.refreshSearch('');
    this.searchOpen.set(true);
  }
  closeSearch(): void {
    this.searchOpen.set(false);
  }

  selectStore(event: Event, store: unknown): void {
    event.preventDefault();
    event.stopPropagation();
    const target = buildStoreSelectionTarget(store as any, {
      searchQuery: this.query(),
    });
    if (!target) return;
    this.closeSearch();
    this.router.navigate(['/store', target.storeId], {
      queryParams: target.searchQuery ? { q: target.searchQuery } : undefined,
    });
  }

  openCart(): void {
    this.ui.openMiniCart();
    this.state.openMiniCart();
  }

  openLocation(): void {
    this.ui.closeMobileSidebar();
    this.ui.openLocation();
  }

  logout(): void {
    this.ui.closeMenus();
    this.auth.logout();
  }

  goSearch(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) {
      this.searchOpen.set(true);
      return;
    }
    this.closeSearch();
    this.router.navigate(['/search'], { queryParams: { q } });
  }

  canUseRoute(route: string): boolean {
    return this.features.isRouteEnabled('customer-app', route);
  }
}
