import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'fd-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent {
  readonly items = [
    { icon: 'home', label: 'Home', route: '/', exact: true },
    { icon: 'search', label: 'Search', route: '/search' },
    { icon: 'shopping_bag', label: 'Cart', route: '/cart', badge: true },
    { icon: 'receipt_long', label: 'Orders', route: '/orders' },
    { icon: 'person', label: 'Account', route: '/profile' },
  ];

  constructor(public state: AppStateService) {}
}
