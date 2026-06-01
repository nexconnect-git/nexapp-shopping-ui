import { Location } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '@shared/public-api';
import { filter } from 'rxjs';

@Component({
  selector: 'fd-mobile-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-topbar.component.html',
  styleUrls: ['./mobile-topbar.component.scss'],
})
export class MobileTopbarComponent {
  query = signal('');
  private currentUrl = signal('/');
  readonly isHomeRoute = computed(() => {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    return path === '/' || path === '/new-home';
  });
  readonly showBack = computed(() => !this.isHomeRoute());
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
    public auth: AuthService,
    public api: ApiService,
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
    if (this.auth.isLoggedIn()) {
      this.api.refreshUnreadCount();
    }
  }

  search(event: Event): void {
    event.preventDefault();
    const value = this.query().trim();
    this.router.navigate(['/search'], { queryParams: value ? { q: value } : {} });
  }

  openCart(): void {
    this.router.navigate(['/cart']);
  }

  goBack(): void {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    if (path === '/' || path === '/new-home') return;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/']);
  }
}
