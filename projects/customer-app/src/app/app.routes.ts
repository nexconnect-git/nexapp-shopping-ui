import { type Routes } from '@angular/router';
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
    path: 'location',
    loadComponent: () =>
      import('./pages/location/location.component').then(
        (m) => m.LocationComponent,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  { path: 'new-home', redirectTo: '' },
  { path: 'categories', redirectTo: 'explore' },
  {
    path: 'explore',
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'explore/:categoryId',
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
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
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
  },
  {
    path: 'search',
    redirectTo: 'explore',
  },
  {
    path: 'cart',
    loadComponent: () =>
      import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent,
      ),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'order-confirmed/:id',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-confirmed/order-confirmed.component').then(
        (m) => m.OrderConfirmedComponent,
      ),
  },
  {
    path: 'tracking/:id',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/tracking/tracking.component').then(
        (m) => m.TrackingComponent,
      ),
  },
  { path: 'completed-order/:id', redirectTo: 'order-finished/:id' },
  {
    path: 'order-finished/:id',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent,
      ),
  },
  { path: 'order/:id', redirectTo: 'tracking/:id' },
  { path: 'order/:id/tracking', redirectTo: 'tracking/:id' },
  {
    path: 'order/:id/rating',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent,
      ),
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent,
      ),
  },
  { path: 'profile', redirectTo: 'account' },
  {
    path: 'addresses',
    loadComponent: () =>
      import('./pages/addresses/addresses.component').then(
        (m) => m.AddressesComponent,
      ),
  },
  { path: 'notifications', redirectTo: 'account' },
  { path: 'wishlist', redirectTo: 'account' },
  { path: 'favorites', redirectTo: 'account' },
  { path: 'wallet', redirectTo: 'account' },
  { path: 'payments', redirectTo: 'account' },
  { path: 'offers', redirectTo: 'explore' },
  { path: 'referral', redirectTo: 'account' },
  { path: 'help', redirectTo: 'account' },
  { path: 'issues', redirectTo: 'account' },
  { path: 'my-issues', redirectTo: 'account' },
  { path: 'order/:id/issue', redirectTo: 'account' },
  { path: 'issue/:issueId', redirectTo: 'account' },
  { path: 'login', redirectTo: '' },
  { path: '**', redirectTo: '' },
];
