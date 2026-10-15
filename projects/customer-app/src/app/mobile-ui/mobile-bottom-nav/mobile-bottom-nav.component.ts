import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { CUSTOMER_MOBILE_NAV_ITEMS, type CustomerNavItem } from '../../config/customer-navigation';

@Component({
  selector: 'fd-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, CustomerIconComponent],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent {
  readonly state = inject(AppStateService);
  private features = inject(PageFeatureAccessService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects),
    startWith(this.router.url),
  ));

  isActive(item: CustomerNavItem): boolean {
    const path = (this.currentUrl() || '/').split(/[?#]/)[0];
    if (item.exact) return path === item.route;
    return (item.activeRoutes || [item.route]).some(route => path === route || path.startsWith(route + '/'));
  }

  private readonly items = CUSTOMER_MOBILE_NAV_ITEMS;

  readonly visibleItems = computed(() =>
    this.items.filter((item) =>
      this.features.isRouteEnabled('customer-app', item.featureRoute || item.route),
    ),
  );

}
