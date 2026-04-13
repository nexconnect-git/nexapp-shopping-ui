import { Routes } from '@angular/router';
import { authGuard, unauthGuard } from '@shared/public-api';
import { superuserGuard } from './guards/superuser.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent), canActivate: [unauthGuard] },
  { path: 'setup', loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent), canActivate: [unauthGuard] },
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
  { path: 'vendors', loadComponent: () => import('./pages/vendors/vendors.component').then(m => m.VendorsComponent), canActivate: [authGuard] },
  // vendors/onboard MUST be before vendors/:id to avoid conflict
  { path: 'vendors/onboard', loadComponent: () => import('./pages/onboarding-form/onboarding-form.component').then(m => m.OnboardingFormComponent), canActivate: [authGuard] },
  { path: 'vendors/:id/edit', loadComponent: () => import('./pages/onboarding-form/onboarding-form.component').then(m => m.OnboardingFormComponent), canActivate: [authGuard] },
  { path: 'vendors/:id', loadComponent: () => import('./pages/vendor-profile/vendor-profile.component').then(m => m.VendorProfileComponent), canActivate: [authGuard] },
  { path: 'customers', loadComponent: () => import('./pages/customers/customers.component').then(m => m.CustomersComponent), canActivate: [authGuard] },
  { path: 'customers/:id', loadComponent: () => import('./pages/customer-profile/customer-profile.component').then(m => m.CustomerProfileComponent), canActivate: [authGuard] },
  // delivery-partners/onboard MUST be before delivery-partners/:id
  { path: 'delivery-partners/onboard', loadComponent: () => import('./pages/onboarding-form/onboarding-form.component').then(m => m.OnboardingFormComponent), canActivate: [authGuard] },
  { path: 'delivery-partners', loadComponent: () => import('./pages/delivery-partners/delivery-partners.component').then(m => m.DeliveryPartnersComponent), canActivate: [authGuard] },
  { path: 'delivery-partners/:id', loadComponent: () => import('./pages/partner-profile/partner-profile.component').then(m => m.PartnerProfileComponent), canActivate: [authGuard] },
  { path: 'orders', loadComponent: () => import('./pages/orders/orders.component').then(m => m.OrdersComponent), canActivate: [authGuard] },
  { path: 'orders/:id', loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent), canActivate: [authGuard] },
  { path: 'categories', loadComponent: () => import('./pages/categories/categories.component').then(m => m.CategoriesComponent), canActivate: [authGuard] },
  { path: 'assets', loadComponent: () => import('./pages/assets/assets.component').then(m => m.AssetsComponent), canActivate: [authGuard] },
  { path: 'payouts', loadComponent: () => import('./pages/payouts/payouts.component').then(m => m.PayoutsComponent), canActivate: [authGuard] },
  { path: 'scheduled-tasks', loadComponent: () => import('./pages/scheduled-tasks/scheduled-tasks.component').then(m => m.ScheduledTasksComponent), canActivate: [authGuard] },
  { path: 'issues', loadComponent: () => import('./pages/issues/issues.component').then(m => m.IssuesComponent), canActivate: [authGuard] },
  { path: 'coupons', loadComponent: () => import('./pages/coupons/coupons.component').then(m => m.CouponsComponent), canActivate: [authGuard] },
  { path: 'admin-users', loadComponent: () => import('./pages/admin-users/admin-users.component').then(m => m.AdminUsersComponent), canActivate: [superuserGuard] },
  { path: '**', redirectTo: '' }
];
