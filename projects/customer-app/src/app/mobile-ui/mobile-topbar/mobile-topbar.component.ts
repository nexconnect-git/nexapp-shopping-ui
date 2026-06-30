import { Location } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { filter } from 'rxjs';

@Component({
  selector: 'fd-mobile-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-topbar.component.html',
  styleUrls: ['./mobile-topbar.component.scss'],
})
export class MobileTopbarComponent implements OnInit, OnDestroy {
  private features = inject(PageFeatureAccessService);
  query = signal('');
  private currentUrl = signal('/');
  readonly isHomeRoute = computed(() => {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    return path === '/';
  });
  readonly showBack = computed(() => !this.isHomeRoute());

  placeholders = [
    'Search "milk, bread, butter"...',
    'Search "fresh fruits & veggies"...',
    'Search "chocolates & snacks"...',
    'Search "daily essentials"...',
    'Search "tea, coffee & drinks"...'
  ];
  currentPlaceholderIndex = signal(0);
  readonly activePlaceholder = computed(() => this.placeholders[this.currentPlaceholderIndex()]);
  private intervalId?: ReturnType<typeof setInterval>;

  suggestions = computed(() =>
    [
      ...this.catalog.products().map((item) => item.name),
      ...this.catalog.categories().map((item) => item.label),
    ]
      .filter(Boolean)
      .slice(0, 5),
  );

  constructor(
    public state: AppStateService,
    public ui: UiService,
    private catalog: CatalogService,
    private router: Router,
    private location: Location,
  ) {
    this.currentUrl.set(this.router.url || '/');
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
    });
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.intervalId = setInterval(() => {
        this.currentPlaceholderIndex.update(idx => (idx + 1) % this.placeholders.length);
      }, 3000);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  search(event: Event): void {
    event.preventDefault();
    const value = this.query().trim();
    this.router.navigate(['/explore'], { queryParams: value ? { q: value } : {} });
  }

  openCart(): void {
    this.router.navigate(['/cart']);
  }

  canUseRoute(route: string): boolean {
    if (route === '/explore') {
      return this.features.isRouteEnabled('customer-app', '/explore');
    }
    return this.features.isRouteEnabled('customer-app', route);
  }

  goBack(): void {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    if (path === '/') return;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/']);
  }
}
