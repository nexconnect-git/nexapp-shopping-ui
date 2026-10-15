import { pageFeatureRouteGuard } from '@shared/lib/guards/page-feature.guard';
import { type Routes } from '@angular/router';
import { customerUnsavedGuard } from './services/customer-unsaved.guard';
import { customerAuthGuard } from './services/customer-auth.guard';
import { customerLocationGuard } from './services/customer-location.guard';

export const routes: Routes = [
  {
    path: 'feature-unavailable',
    loadComponent: () =>
      import('./pages/feature-unavailable/feature-unavailable.component').then(
        (m) => m.CustomerFeatureUnavailableComponent
      ),
  },
  {
    path: 'location',
    loadComponent: () =>
      import('./pages/location/location.component').then(
        (m) => m.LocationComponent
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  { path: 'new-home', redirectTo: '' },
  {
    path: 'categories',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/categories/categories.component').then(
        (m) => m.CategoriesComponent
      ),
  },
  {
    path: 'explore',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'explore/:categoryId',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'stores',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/stores/stores.component').then((m) => m.StoresComponent),
  },
  {
    path: 'category/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/category/category.component').then(
        (m) => m.CategoryComponent
      ),
  },
  {
    path: 'store/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/store-detail/store-detail.component').then(
        (m) => m.StoreDetailComponent
      ),
  },
  {
    path: 'product/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent
      ),
  },
  {
    path: 'search',
    redirectTo: 'explore',
  },
  {
    path: 'cart',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerLocationGuard],
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent
      ),
  },
  {
    path: 'orders',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    loadComponent: () =>
      import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'order-confirmed/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-confirmed/order-confirmed.component').then(
        (m) => m.OrderConfirmedComponent
      ),
  },
  {
    path: 'tracking/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    loadComponent: () =>
      import('./pages/tracking/tracking.component').then(
        (m) => m.TrackingComponent
      ),
  },
  { path: 'completed-order/:id', redirectTo: 'order-finished/:id' },
  {
    path: 'order-finished/:id',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent
      ),
  },
  { path: 'order/:id', pathMatch: 'full', redirectTo: 'tracking/:id' },
  { path: 'order/:id/tracking', redirectTo: 'tracking/:id' },
  {
    path: 'order/:id/rating',
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    loadComponent: () =>
      import('./pages/order-finished/order-finished.component').then(
        (m) => m.OrderFinishedComponent
      ),
  },
  {
    path: 'account',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
  },
  { path: 'profile', redirectTo: 'account' },
  {
    path: 'addresses',
    canDeactivate: [customerUnsavedGuard],
    canActivate: [pageFeatureRouteGuard('customer-app')],
    loadComponent: () =>
      import('./pages/addresses/addresses.component').then(
        (m) => m.AddressesComponent
      ),
  },
  {
    path: 'notifications',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(
        (m) => m.NotificationsComponent
      ),
  },
  {
    path: 'privacy-policy',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    loadComponent: () =>
      import('./pages/privacy-policy/privacy-policy.component').then(
        (m) => m.PrivacyPolicyComponent
      ),
  },
  { path: 'privacy', redirectTo: 'privacy-policy' },
  { path: 'wishlist', redirectTo: 'account' },
  { path: 'favorites', redirectTo: 'account' },
  { path: 'wallet', redirectTo: 'account' },
  { path: 'payments', redirectTo: 'account' },
  { path: 'offers', redirectTo: 'explore' },
  { path: 'referral', redirectTo: 'account' },
  {
    path: 'help',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    data: { mode: 'help' },
    loadComponent: () =>
      import('./pages/support/support.component').then(
        (m) => m.SupportComponent
      ),
  },
  {
    path: 'issues',
    canActivate: [pageFeatureRouteGuard('customer-app')],
    data: { mode: 'list' },
    loadComponent: () =>
      import('./pages/support/support.component').then(
        (m) => m.SupportComponent
      ),
  },
  { path: 'my-issues', redirectTo: 'issues' },
  {
    path: 'order/:id/issue',
    canDeactivate: [customerUnsavedGuard],
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    data: { mode: 'create' },
    loadComponent: () =>
      import('./pages/support/support.component').then(
        (m) => m.SupportComponent
      ),
  },
  {
    path: 'issue/:issueId',
    canDeactivate: [customerUnsavedGuard],
    canActivate: [pageFeatureRouteGuard('customer-app'), customerAuthGuard],
    data: { mode: 'detail' },
    loadComponent: () =>
      import('./pages/support/support.component').then(
        (m) => m.SupportComponent
      ),
  },
  { path: 'login', redirectTo: '' },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(
        (m) => m.CustomerNotFoundComponent
      ),
  },
];
