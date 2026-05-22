import { type Routes } from '@angular/router';
import {
  authGuard,
  pageFeatureGuard,
  portalUnauthGuard,
  roleGuard,
} from '@shared/public-api';

const deliveryGuard = [authGuard, roleGuard('delivery')];
const deliveryPageGuard = (pageId: string) => [
  ...deliveryGuard,
  pageFeatureGuard('delivery-app', pageId),
];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [
      pageFeatureGuard('delivery-app', 'delivery-login'),
      portalUnauthGuard('delivery'),
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
      pageFeatureGuard('delivery-app', 'delivery-change-password'),
    ],
  },
  {
    path: 'feature-unavailable',
    loadComponent: () =>
      import('@shared/public-api').then(
        (m) => m.PageFeatureUnavailableComponent,
      ),
    canActivate: deliveryGuard,
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: deliveryPageGuard('delivery-dashboard'),
  },
  {
    path: 'available',
    loadComponent: () =>
      import('./pages/available-orders/available-orders.component').then(
        (m) => m.AvailableOrdersComponent,
      ),
    canActivate: deliveryPageGuard('delivery-available'),
  },
  {
    path: 'active',
    loadComponent: () =>
      import('./pages/active-delivery/active-delivery.component').then(
        (m) => m.ActiveDeliveryComponent,
      ),
    canActivate: deliveryPageGuard('delivery-active'),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history/history.component').then(
        (m) => m.HistoryComponent,
      ),
    canActivate: deliveryPageGuard('delivery-history'),
  },
  {
    path: 'earnings',
    loadComponent: () =>
      import('./pages/earnings/earnings.component').then(
        (m) => m.EarningsComponent,
      ),
    canActivate: deliveryPageGuard('delivery-earnings'),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent,
      ),
    canActivate: deliveryPageGuard('delivery-profile'),
  },
  { path: '**', redirectTo: '' },
];
