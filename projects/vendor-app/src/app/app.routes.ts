import { Routes } from '@angular/router';
import { authGuard, roleGuard, approvedVendorGuard } from '@shared/public-api';

const vendorGuard = [authGuard, roleGuard('vendor'), approvedVendorGuard];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
  { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [authGuard] },
  { path: 'pending-approval', loadComponent: () => import('./pages/pending-approval/pending-approval.component').then(m => m.PendingApprovalComponent), canActivate: [authGuard, roleGuard('vendor')] },
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: vendorGuard },
  { path: 'products', loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent), canActivate: vendorGuard },
  { path: 'products/new', loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent), canActivate: vendorGuard },
  { path: 'products/edit/:id', loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent), canActivate: vendorGuard },
  { path: 'orders', loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent), canActivate: vendorGuard },
  { path: 'orders/:id', loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent), canActivate: vendorGuard },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: vendorGuard },
  { path: 'sales-report', loadComponent: () => import('./pages/sales-report/sales-report.component').then(m => m.SalesReportComponent), canActivate: vendorGuard },
  { path: 'stock-management', loadComponent: () => import('./pages/stock-management/stock-management.component').then(m => m.StockManagementComponent), canActivate: vendorGuard },
  { path: 'payments', loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent), canActivate: vendorGuard },
  { path: 'support', loadComponent: () => import('./pages/support/support.component').then(m => m.SupportComponent), canActivate: vendorGuard },
  { path: '**', redirectTo: '' }
];
