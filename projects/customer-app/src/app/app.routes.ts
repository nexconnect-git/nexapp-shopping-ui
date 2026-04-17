import { Routes } from '@angular/router';
import { authGuard, unauthGuard, roleGuard, portalUnauthGuard } from '@shared/public-api';

const customerGuard = [authGuard, roleGuard('customer')];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [portalUnauthGuard('customer')]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [unauthGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [unauthGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [unauthGuard]
  },
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: customerGuard
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    canActivate: customerGuard
  },
  {
    path: 'shops',
    loadComponent: () => import('./pages/shops/shops.component').then(m => m.ShopsComponent),
    canActivate: customerGuard
  },
  {
    path: 'shop/:id',
    loadComponent: () => import('./pages/shop-detail/shop-detail.component').then(m => m.ShopDetailComponent),
    canActivate: customerGuard
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent),
    canActivate: customerGuard
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    canActivate: customerGuard
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
    canActivate: customerGuard
  },
  {
    path: 'order/:id',
    loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: customerGuard
  },
  {
    path: 'order/:id/tracking',
    loadComponent: () => import('./pages/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
    canActivate: customerGuard
  },
  {
    path: 'order/:id/help',
    loadComponent: () => import('./pages/order-help/order-help.component').then(m => m.OrderHelpComponent),
    canActivate: customerGuard
  },
  {
    path: 'order/:id/rate',
    loadComponent: () => import('./pages/order-rating/order-rating.component').then(m => m.OrderRatingComponent),
    canActivate: customerGuard
  },
  {
    path: 'order/:id/issue',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: customerGuard
  },
  {
    path: 'issue/:issueId',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: customerGuard
  },
  {
    path: 'my-issues',
    loadComponent: () => import('./pages/my-issues/my-issues.component').then(m => m.MyIssuesComponent),
    canActivate: customerGuard
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent),
    canActivate: customerGuard
  },
  {
    path: 'profile',
    canActivate: customerGuard,
    children: [
      { path: '', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'orders', redirectTo: '/orders', pathMatch: 'full' }
    ]
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: customerGuard
  },
  {
    path: 'offers',
    loadComponent: () => import('./pages/offers/offers.component').then(m => m.OffersComponent),
    canActivate: customerGuard
  },
  {
    path: 'addresses',
    loadComponent: () => import('./pages/addresses/addresses.component').then(m => m.AddressesComponent),
    canActivate: customerGuard
  },
  {
    path: 'wallet',
    loadComponent: () => import('./pages/wallet/wallet.component').then(m => m.WalletComponent),
    canActivate: customerGuard
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
