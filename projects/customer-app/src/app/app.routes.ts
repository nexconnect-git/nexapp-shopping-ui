import { type Routes } from '@angular/router';
import { pageFeatureGuard } from '@shared/lib/guards/page-feature.guard';
import { customerAuthGuard } from './services/customer-auth.guard';

export const routes: Routes = [
  {
    path: 'feature-unavailable',
    loadComponent: () =>
      import('@shared/lib/components/page-feature-unavailable/page-feature-unavailable.component').then(
        (m) => m.PageFeatureUnavailableComponent,
      ),
  },
  { path: 'location', redirectTo: '' },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-home')],
  },
  { path: 'new-home', redirectTo: '' },
  { path: 'categories', redirectTo: 'explore' },
  {
    path: 'explore',
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-search')],
  },
  {
    path: 'explore/:categoryId',
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-search')],
  },
  {
    path: 'stores',
    redirectTo: 'explore',
  },
  { path: 'category/:id', redirectTo: 'explore/:id' },
  {
    path: 'store/:id',
    loadComponent: () =>
      import('./pages/store-detail/store-detail.component').then(
        (m) => m.StoreDetailComponent,
      ),
    canActivate: [pageFeatureGuard('customer-app', 'customer-store-detail')],
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
    canActivate: [pageFeatureGuard('customer-app', 'customer-product-detail')],
  },
  {
    path: 'search',
    redirectTo: 'explore',
  },
  {
    path: 'cart',
    canActivate: [pageFeatureGuard('customer-app', 'customer-cart')],
    loadComponent: () =>
      import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-checkout'),
    ],
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent,
      ),
  },
  {
    path: 'orders',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-orders'),
    ],
    loadComponent: () =>
      import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'order-confirmed/:id',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-tracking'),
    ],
    loadComponent: () =>
      import('./pages/order-confirmed/order-confirmed.component').then(
        (m) => m.OrderConfirmedComponent,
      ),
  },
  {
    path: 'tracking/:id',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-tracking'),
    ],
    loadComponent: () =>
      import('./pages/tracking/tracking.component').then(
        (m) => m.TrackingComponent,
      ),
  },
  { path: 'completed-order/:id', redirectTo: 'order-finished/:id' },
  {
    path: 'order-finished/:id',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-order-finished'),
    ],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent,
      ),
  },
  { path: 'order/:id', redirectTo: 'tracking/:id' },
  { path: 'order/:id/tracking', redirectTo: 'tracking/:id' },
  {
    path: 'order/:id/rating',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-order-finished'),
    ],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent,
      ),
  },
  {
    path: 'account',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-profile'),
    ],
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent,
      ),
  },
  {
    path: 'profile',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-profile'),
    ],
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent,
      ),
  },
  {
    path: 'addresses',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-addresses'),
    ],
    loadComponent: () =>
      import('./pages/addresses/addresses.component').then(
        (m) => m.AddressesComponent,
      ),
  },
  {
    path: 'notifications',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-notifications'),
    ],
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
  },
  {
    path: 'wishlist',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/wishlist/wishlist.component').then(
        (m) => m.WishlistComponent,
      ),
  },
  {
    path: 'wallet',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/wallet/wallet.component').then(
        (m) => m.WalletComponent,
      ),
  },
  {
    path: 'offers',
    loadComponent: () =>
      import('./pages/offers/offers.component').then(
        (m) => m.OffersComponent,
      ),
  },
  {
    path: 'referral',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/referral/referral.component').then(
        (m) => m.ReferralComponent,
      ),
  },
  {
    path: 'help',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'order/:id/issue',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'issue/:issueId',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'issues',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/issues/issues.component').then(
        (m) => m.IssuesComponent,
      ),
  },
  { path: 'favorites', redirectTo: 'wishlist' },
  { path: 'payments', redirectTo: 'wallet' },
  { path: 'my-issues', redirectTo: 'issues' },
  { path: 'login', redirectTo: '' },
  { path: '**', redirectTo: '' },
];
