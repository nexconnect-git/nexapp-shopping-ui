import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';

interface MobileNavItem {
  icon: string;
  label: string;
  route: string;
  featureRoute?: string;
  exact?: boolean;
  badge?: boolean;
}

@Component({
  selector: 'fd-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent {
  readonly state = inject(AppStateService);
  private features = inject(PageFeatureAccessService);

  private readonly items: MobileNavItem[] = [
    { icon: 'home', label: 'Home', route: '/', exact: true },
    { icon: 'travel_explore', label: 'Explore', route: '/explore', featureRoute: '/search' },
    { icon: 'shopping_bag', label: 'Cart', route: '/cart', badge: true },
    { icon: 'receipt_long', label: 'Orders', route: '/orders' },
    { icon: 'person', label: 'Account', route: '/account', featureRoute: '/profile' },
  ];

  readonly visibleItems = computed(() =>
    this.items.filter((item) =>
      this.features.isRouteEnabled('customer-app', item.featureRoute || item.route),
    ),
  );

}
