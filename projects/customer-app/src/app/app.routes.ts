import { Routes } from '@angular/router';
import { authGuard, unauthGuard, roleGuard, portalUnauthGuard } from '@shared/public-api';

const customerGuard = [authGuard, roleGuard('customer')];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [portalUnauthGuard('customer')],
    data: { breadcrumb: 'Sign in' },
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [unauthGuard],
    data: { breadcrumb: 'Create account' },
  },
  {
    path: 'set-location',
    loadComponent: () => import('./pages/set-location/set-location.component').then(m => m.SetLocationComponent),
    data: { breadcrumb: 'Set location' },
  },
  {
    path: 'forgot-password',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'reset-password',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    data: { breadcrumb: 'Home' },
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    data: { breadcrumb: 'Search' },
  },
  {
    path: 'shops',
    loadComponent: () => import('./pages/shops/shops.component').then(m => m.ShopsComponent),
    data: { breadcrumb: 'Browse stores' },
  },
  {
    path: 'shop/:id',
    loadComponent: () => import('./pages/shop-detail/shop-detail.component').then(m => m.ShopDetailComponent),
    data: { breadcrumb: 'Store' },
  },
  {
    path: 'products',
    redirectTo: '/search',
    pathMatch: 'full'
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    data: { breadcrumb: 'Product' },
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Cart' },
  },
  {
    path: 'order/:id',
    loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Order details' },
  },
  {
    path: 'order/:id/tracking',
    loadComponent: () => import('./pages/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Live tracking' },
  },
  {
    path: 'order/:id/help',
    loadComponent: () => import('./pages/order-help/order-help.component').then(m => m.OrderHelpComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Order help' },
  },
  {
    path: 'order/:id/rate',
    loadComponent: () => import('./pages/order-rating/order-rating.component').then(m => m.OrderRatingComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Rate order' },
  },
  {
    path: 'order/:id/issue',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Report issue' },
  },
  {
    path: 'issue/:issueId',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Support thread' },
  },
  {
    path: 'my-issues',
    loadComponent: () => import('./pages/my-issues/my-issues.component').then(m => m.MyIssuesComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'My issues' },
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Orders' },
  },
  {
    path: 'profile',
    canActivate: customerGuard,
    data: { breadcrumb: 'Profile' },
    children: [
      { path: '', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'orders', redirectTo: '/orders', pathMatch: 'full' }
    ]
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Checkout' },
  },
  {
    path: 'offers',
    loadComponent: () => import('./pages/offers/offers.component').then(m => m.OffersComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Deals' },
  },
  {
    path: 'addresses',
    loadComponent: () => import('./pages/addresses/addresses.component').then(m => m.AddressesComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Addresses' },
  },
  {
    path: 'wallet',
    loadComponent: () => import('./pages/wallet/wallet.component').then(m => m.WalletComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Wallet' },
  },
  {
    path: 'wishlist',
    loadComponent: () => import('./pages/wishlist/wishlist.component').then(m => m.WishlistComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Wishlist' },
  },
  {
    path: 'referral',
    loadComponent: () => import('./pages/referral/referral.component').then(m => m.ReferralComponent),
    canActivate: customerGuard,
    data: { breadcrumb: 'Refer and earn' },
  },
  {
    path: 'showcase',
    loadComponent: () => import('./pages/showcase/showcase.component').then(m => m.ShowcaseComponent),
    data: { breadcrumb: 'Showcase' },
  },
  {
    path: '**',
    redirectTo: ''
  }
];
