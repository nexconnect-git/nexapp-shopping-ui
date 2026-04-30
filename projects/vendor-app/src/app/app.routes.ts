import { Routes } from '@angular/router';
import { authGuard, unauthGuard, roleGuard, approvedVendorGuard, portalUnauthGuard } from '@shared/public-api';

const vendorGuard = [authGuard, roleGuard('vendor'), approvedVendorGuard];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent), canActivate: [portalUnauthGuard('vendor')] },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent), canActivate: [unauthGuard] },
  { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [authGuard] },
  { path: 'pending-approval', loadComponent: () => import('./pages/pending-approval/pending-approval.component').then(m => m.PendingApprovalComponent), canActivate: [authGuard, roleGuard('vendor')] },
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: vendorGuard },
  { path: 'live-orders', loadComponent: () => import('./pages/live-orders/live-orders.component').then(m => m.LiveOrdersComponent), canActivate: vendorGuard },
  { path: 'inventory', loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent), canActivate: vendorGuard },
  { path: 'products', loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent), canActivate: vendorGuard },
  { path: 'products/health', redirectTo: 'inventory' },
  { path: 'products/new', loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent), canActivate: vendorGuard },
  { path: 'products/edit/:id', loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent), canActivate: vendorGuard },
  { path: 'catalog-requests', loadComponent: () => import('./pages/catalog-requests/catalog-requests.component').then(m => m.CatalogRequestsComponent), canActivate: vendorGuard },
  { path: 'orders', loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent), canActivate: vendorGuard },
  { path: 'orders/:id/prep', loadComponent: () => import('./pages/order-prep/order-prep.component').then(m => m.OrderPrepComponent), canActivate: vendorGuard },
  { path: 'orders/:id', loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent), canActivate: vendorGuard },
  { path: 'profile', redirectTo: 'store-settings' },
  { path: 'sales-report', redirectTo: 'analytics' },
  { path: 'stock-management', redirectTo: 'inventory' },
  { path: 'wallet', redirectTo: 'payouts' },
  { path: 'payments', redirectTo: 'payouts' },
  { path: 'coupons', redirectTo: 'promotions' },
  { path: 'analytics', loadComponent: () => import('./pages/sales-report/sales-report.component').then(m => m.SalesReportComponent), canActivate: vendorGuard },
  { path: 'payouts', loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent), canActivate: vendorGuard },
  { path: 'promotions', loadComponent: () => import('./pages/coupons/coupons.component').then(m => m.CouponsComponent), canActivate: vendorGuard },
  { path: 'support', loadComponent: () => import('./pages/support/support.component').then(m => m.SupportComponent), canActivate: vendorGuard },
  { path: 'reviews', loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent), canActivate: vendorGuard },
  { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent), canActivate: vendorGuard },
  { path: 'store-settings', loadComponent: () => import('./pages/store-settings/store-settings.component').then(m => m.StoreSettingsComponent), canActivate: vendorGuard },
  { path: '**', redirectTo: '' }
];


