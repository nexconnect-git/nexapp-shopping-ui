import { type Routes } from '@angular/router';
import {
  approvedVendorGuard,
  authGuard,
  pageFeatureGuard,
  portalUnauthGuard,
  roleGuard,
  unauthGuard,
} from '@shared/public-api';

const vendorGuard = [authGuard, roleGuard('vendor'), approvedVendorGuard];
const vendorPageGuard = (pageId: string) => [
  ...vendorGuard,
  pageFeatureGuard('vendor-app', pageId),
];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [
      pageFeatureGuard('vendor-app', 'vendor-login'),
      portalUnauthGuard('vendor'),
    ],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
    canActivate: [
      pageFeatureGuard('vendor-app', 'vendor-register'),
      unauthGuard,
    ],
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
    canActivate: [
      authGuard,
      pageFeatureGuard('vendor-app', 'vendor-change-password'),
    ],
  },
  {
    path: 'pending-approval',
    loadComponent: () =>
      import('./pages/pending-approval/pending-approval.component').then(
        (m) => m.PendingApprovalComponent,
      ),
    canActivate: [
      authGuard,
      roleGuard('vendor'),
      pageFeatureGuard('vendor-app', 'vendor-pending-approval'),
    ],
  },
  {
    path: 'feature-unavailable',
    loadComponent: () =>
      import('@shared/public-api').then(
        (m) => m.PageFeatureUnavailableComponent,
      ),
    canActivate: vendorGuard,
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: vendorPageGuard('vendor-dashboard'),
  },
  {
    path: 'live-orders',
    loadComponent: () =>
      import('./pages/live-orders/live-orders.component').then(
        (m) => m.LiveOrdersComponent,
      ),
    canActivate: vendorPageGuard('vendor-live-orders'),
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./pages/inventory/inventory.component').then(
        (m) => m.InventoryComponent,
      ),
    canActivate: vendorPageGuard('vendor-inventory'),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products/products.component').then(
        (m) => m.ProductsComponent,
      ),
    canActivate: vendorPageGuard('vendor-products'),
  },
  { path: 'products/health', redirectTo: 'inventory' },
  {
    path: 'products/new',
    loadComponent: () =>
      import('./pages/product-create/product-create.component').then(
        (m) => m.ProductCreateComponent,
      ),
    canActivate: vendorPageGuard('vendor-product-new'),
  },
  {
    path: 'products/:id/edit',
    loadComponent: () =>
      import('./pages/product-edit/product-edit.component').then(
        (m) => m.ProductEditComponent,
      ),
    canActivate: vendorPageGuard('vendor-product-edit'),
  },
  {
    path: 'products/edit/:id',
    loadComponent: () =>
      import('./pages/product-edit/product-edit.component').then(
        (m) => m.ProductEditComponent,
      ),
    canActivate: vendorPageGuard('vendor-product-edit'),
  },
  {
    path: 'catalog-requests',
    loadComponent: () =>
      import('./pages/catalog-requests/catalog-requests.component').then(
        (m) => m.CatalogRequestsComponent,
      ),
    canActivate: vendorPageGuard('vendor-catalog-requests'),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
    canActivate: vendorPageGuard('vendor-orders'),
  },
  { path: 'order/:id/tracking', redirectTo: '/orders/:id', pathMatch: 'full' },
  { path: 'order/:id', redirectTo: '/orders/:id', pathMatch: 'full' },
  {
    path: 'orders/:id/prep',
    loadComponent: () =>
      import('./pages/order-prep/order-prep.component').then(
        (m) => m.OrderPrepComponent,
      ),
    canActivate: vendorPageGuard('vendor-order-prep'),
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.component').then(
        (m) => m.OrderDetailComponent,
      ),
    canActivate: vendorPageGuard('vendor-order-detail'),
  },
  { path: 'profile', redirectTo: 'store-settings' },
  { path: 'sales-report', redirectTo: 'analytics' },
  { path: 'stock-management', redirectTo: 'inventory' },
  { path: 'wallet', redirectTo: 'payouts' },
  { path: 'payments', redirectTo: 'payouts' },
  { path: 'coupons', redirectTo: 'promotions' },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/sales-report/sales-report.component').then(
        (m) => m.SalesReportComponent,
      ),
    canActivate: vendorPageGuard('vendor-analytics'),
  },
  {
    path: 'payouts',
    loadComponent: () =>
      import('./pages/payments/payments.component').then(
        (m) => m.PaymentsComponent,
      ),
    canActivate: vendorPageGuard('vendor-payouts'),
  },
  {
    path: 'promotions',
    loadComponent: () =>
      import('./pages/coupons/coupons.component').then(
        (m) => m.CouponsComponent,
      ),
    canActivate: vendorPageGuard('vendor-promotions'),
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./pages/support/support.component').then(
        (m) => m.SupportComponent,
      ),
    canActivate: vendorPageGuard('vendor-support'),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./pages/reviews/reviews.component').then(
        (m) => m.ReviewsComponent,
      ),
    canActivate: vendorPageGuard('vendor-reviews'),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
    canActivate: vendorPageGuard('vendor-notifications'),
  },
  {
    path: 'store/settings',
    loadComponent: () =>
      import('./pages/store-settings/store-settings.component').then(
        (m) => m.StoreSettingsComponent,
      ),
    canActivate: vendorPageGuard('vendor-store-settings'),
  },
  {
    path: 'store-settings',
    loadComponent: () =>
      import('./pages/store-settings/store-settings.component').then(
        (m) => m.StoreSettingsComponent,
      ),
    canActivate: vendorPageGuard('vendor-store-settings'),
  },
  { path: '**', redirectTo: '' },
];
