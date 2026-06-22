import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { CUSTOMER_MOBILE_NAV_ITEMS } from '../../config/customer-navigation';

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

  private readonly items = CUSTOMER_MOBILE_NAV_ITEMS;

  readonly visibleItems = computed(() =>
    this.items.filter((item) =>
      this.features.isRouteEnabled('customer-app', item.featureRoute || item.route),
    ),
  );

}
