import { Routes } from '@angular/router';
import { authGuard, unauthGuard } from '@shared/public-api';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [unauthGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [unauthGuard]
  },
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    canActivate: [authGuard]
  },
  {
    path: 'shops',
    loadComponent: () => import('./pages/shops/shops.component').then(m => m.ShopsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'shop/:id',
    loadComponent: () => import('./pages/shop-detail/shop-detail.component').then(m => m.ShopDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
    canActivate: [authGuard]
  },
  {
    path: 'order/:id',
    loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'order/:id/tracking',
    loadComponent: () => import('./pages/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
    canActivate: [authGuard]
  },
  {
    path: 'order/:id/help',
    loadComponent: () => import('./pages/order-help/order-help.component').then(m => m.OrderHelpComponent),
    canActivate: [authGuard]
  },
  {
    path: 'order/:id/rate',
    loadComponent: () => import('./pages/order-rating/order-rating.component').then(m => m.OrderRatingComponent),
    canActivate: [authGuard]
  },
  {
    path: 'order/:id/issue',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: [authGuard]
  },
  {
    path: 'issue/:issueId',
    loadComponent: () => import('./pages/order-issue/order-issue.component').then(m => m.OrderIssueComponent),
    canActivate: [authGuard]
  },
  {
    path: 'my-issues',
    loadComponent: () => import('./pages/my-issues/my-issues.component').then(m => m.MyIssuesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'orders', loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent) }
    ]
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard]
  },
  {
    path: 'offers',
    loadComponent: () => import('./pages/offers/offers.component').then(m => m.OffersComponent),
    canActivate: [authGuard]
  },
  {
    path: 'addresses',
    loadComponent: () => import('./pages/addresses/addresses.component').then(m => m.AddressesComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
