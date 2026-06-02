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
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-home')],
  },
  {
    path: 'new-home',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-home')],
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./pages/categories/categories.component').then(
        (m) => m.CategoriesComponent,
      ),
    canActivate: [pageFeatureGuard('customer-app', 'customer-categories')],
  },
  {
    path: 'stores',
    loadComponent: () =>
      import('./pages/stores/stores.component').then((m) => m.StoresComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-stores')],
  },
  {
    path: 'category/:id',
    loadComponent: () =>
      import('./pages/category/category.component').then(
        (m) => m.CategoryComponent,
      ),
    canActivate: [pageFeatureGuard('customer-app', 'customer-categories')],
  },
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
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-search')],
  },
  {
    path: 'cart',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-cart'),
    ],
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
    path: 'order/:id/help',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-help'),
    ],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'order/:id/issue',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-help'),
    ],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
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
    path: 'offers',
    loadComponent: () =>
      import('./pages/offers/offers.component').then((m) => m.OffersComponent),
    canActivate: [pageFeatureGuard('customer-app', 'customer-offers')],
  },
  {
    path: 'wallet',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-wallet'),
    ],
    loadComponent: () =>
      import('./pages/wallet/wallet.component').then((m) => m.WalletComponent),
  },
  {
    path: 'wishlist',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-wishlist'),
    ],
    loadComponent: () =>
      import('./pages/wishlist/wishlist.component').then(
        (m) => m.WishlistComponent,
      ),
  },
  {
    path: 'referral',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-referral'),
    ],
    loadComponent: () =>
      import('./pages/referral/referral.component').then(
        (m) => m.ReferralComponent,
      ),
  },
  {
    path: 'notifications',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-issues'),
    ],
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
  },
  {
    path: 'issues',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-issues'),
    ],
    loadComponent: () =>
      import('./pages/issues/issues.component').then((m) => m.IssuesComponent),
  },
  {
    path: 'help',
    canActivate: [pageFeatureGuard('customer-app', 'customer-help')],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'issue/:issueId',
    canActivate: [
      customerAuthGuard,
      pageFeatureGuard('customer-app', 'customer-help'),
    ],
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  { path: 'my-issues', redirectTo: 'issues' },
  { path: 'favorites', redirectTo: 'wishlist' },
  { path: 'payments', redirectTo: 'wallet' },
  { path: 'login', redirectTo: '' },
  { path: '**', redirectTo: '' },
];
