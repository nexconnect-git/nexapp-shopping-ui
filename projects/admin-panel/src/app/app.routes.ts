import { type Routes } from '@angular/router';
import {
  authGuard,
  portalUnauthGuard,
  roleGuard,
  unauthGuard,
} from '@shared/public-api';
import { initialSetupGuard } from './guards/initial-setup.guard';
import { superuserGuard } from './guards/superuser.guard';

const adminGuard = [initialSetupGuard, authGuard, roleGuard('admin')];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [portalUnauthGuard('admin')],
  },
  {
    path: 'setup',
    loadComponent: () =>
      import('./pages/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [unauthGuard],
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin/profile',
    loadComponent: () =>
      import('./pages/dynamic-admin-profile/dynamic-admin-profile.component').then(
        (m) => m.DynamicAdminProfileComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'admin/profile/edit',
    loadComponent: () =>
      import('./pages/dynamic-entity-edit/dynamic-entity-edit.component').then(
        (m) => m.DynamicEntityEditComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'admin-user' },
  },
  {
    path: 'admin/profile/review',
    loadComponent: () =>
      import('./pages/dynamic-entity-review/dynamic-entity-review.component').then(
        (m) => m.DynamicEntityReviewComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'admin-user' },
  },
  {
    path: 'files/upload-test',
    loadComponent: () =>
      import('./pages/file-upload-test/file-upload-test.component').then(
        (m) => m.FileUploadTestComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'dispatch',
    loadComponent: () =>
      import('./pages/dispatch-board/dispatch-board.component').then(
        (m) => m.DispatchBoardComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'vendors',
    loadComponent: () =>
      import('./pages/vendors/vendors.component').then(
        (m) => m.VendorsComponent,
      ),
    canActivate: adminGuard,
  },
  // vendors/onboard MUST be before vendors/:id to avoid conflict
  {
    path: 'vendors/onboard',
    loadComponent: () =>
      import('./pages/onboarding-form/onboarding-form.component').then(
        (m) => m.OnboardingFormComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'vendors/:id/edit',
    loadComponent: () =>
      import('./pages/dynamic-entity-edit/dynamic-entity-edit.component').then(
        (m) => m.DynamicEntityEditComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'vendor' },
  },
  {
    path: 'vendors/:id/review',
    loadComponent: () =>
      import('./pages/dynamic-entity-review/dynamic-entity-review.component').then(
        (m) => m.DynamicEntityReviewComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'vendor' },
  },
  {
    path: 'vendors/:id',
    loadComponent: () =>
      import('./pages/vendor-profile/vendor-profile.component').then(
        (m) => m.VendorProfileComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./pages/customers/customers.component').then(
        (m) => m.CustomersComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'customers/:id/edit',
    loadComponent: () =>
      import('./pages/dynamic-entity-edit/dynamic-entity-edit.component').then(
        (m) => m.DynamicEntityEditComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'customer' },
  },
  {
    path: 'customers/:id/review',
    loadComponent: () =>
      import('./pages/dynamic-entity-review/dynamic-entity-review.component').then(
        (m) => m.DynamicEntityReviewComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'customer' },
  },
  {
    path: 'customers/:id',
    loadComponent: () =>
      import('./pages/customer-profile/customer-profile.component').then(
        (m) => m.CustomerProfileComponent,
      ),
    canActivate: adminGuard,
  },
  // delivery-partners/onboard MUST be before delivery-partners/:id
  {
    path: 'delivery-partners/onboard',
    loadComponent: () =>
      import('./pages/onboarding-form/onboarding-form.component').then(
        (m) => m.OnboardingFormComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'delivery-partners',
    loadComponent: () =>
      import('./pages/delivery-partners/delivery-partners.component').then(
        (m) => m.DeliveryPartnersComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'delivery-partners/:id/edit',
    loadComponent: () =>
      import('./pages/dynamic-entity-edit/dynamic-entity-edit.component').then(
        (m) => m.DynamicEntityEditComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'delivery-partner' },
  },
  {
    path: 'delivery-partners/:id/review',
    loadComponent: () =>
      import('./pages/dynamic-entity-review/dynamic-entity-review.component').then(
        (m) => m.DynamicEntityReviewComponent,
      ),
    canActivate: adminGuard,
    data: { entityType: 'delivery-partner' },
  },
  {
    path: 'delivery-partners/:id',
    loadComponent: () =>
      import('./pages/partner-profile/partner-profile.component').then(
        (m) => m.PartnerProfileComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
    canActivate: adminGuard,
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.component').then(
        (m) => m.OrderDetailComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/products/products.component').then(
        (m) => m.ProductsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'catalog',
    loadComponent: () =>
      import('./pages/catalog/catalog.component').then(
        (m) => m.CatalogComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'catalog-requests',
    loadComponent: () =>
      import('./pages/catalog-requests/catalog-requests.component').then(
        (m) => m.CatalogRequestsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'vendor-variant-approvals',
    loadComponent: () =>
      import('./pages/vendor-variant-approvals/vendor-variant-approvals.component').then(
        (m) => m.VendorVariantApprovalsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./pages/categories/categories.component').then(
        (m) => m.CategoriesComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./pages/assets/assets.component').then((m) => m.AssetsComponent),
    canActivate: adminGuard,
  },
  {
    path: 'payouts',
    loadComponent: () =>
      import('./pages/payouts/payouts.component').then(
        (m) => m.PayoutsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'payments',
    loadComponent: () =>
      import('./pages/payments/payments.component').then(
        (m) => m.PaymentsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'reconciliation',
    loadComponent: () =>
      import('./pages/reconciliation/reconciliation.component').then(
        (m) => m.ReconciliationComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'scheduled-tasks',
    loadComponent: () =>
      import('./pages/scheduled-tasks/scheduled-tasks.component').then(
        (m) => m.ScheduledTasksComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'settings/page-feature-management',
    loadComponent: () =>
      import('./pages/page-feature-management-demo/page-feature-management-demo.component').then(
        (m) => m.PageFeatureManagementDemoComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'platform-settings',
    loadComponent: () =>
      import('./pages/platform-settings/platform-settings.component').then(
        (m) => m.PlatformSettingsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'audit-logs',
    loadComponent: () =>
      import('./pages/audit-logs/audit-logs.component').then(
        (m) => m.AuditLogsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'production-readiness',
    loadComponent: () =>
      import('./pages/production-readiness/production-readiness.component').then(
        (m) => m.ProductionReadinessComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'issues',
    loadComponent: () =>
      import('./pages/issues/issues.component').then((m) => m.IssuesComponent),
    canActivate: adminGuard,
  },
  {
    path: 'coupons',
    loadComponent: () =>
      import('./pages/coupons/coupons.component').then(
        (m) => m.CouponsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'banners',
    loadComponent: () =>
      import('./pages/banners/banners.component').then(
        (m) => m.BannersComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
    canActivate: adminGuard,
  },
  {
    path: 'admin-users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users.component').then(
        (m) => m.AdminUsersComponent,
      ),
    canActivate: [initialSetupGuard, superuserGuard],
  },
  { path: '**', redirectTo: '' },
];
