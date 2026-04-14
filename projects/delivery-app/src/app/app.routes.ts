import { Routes } from '@angular/router';
import { authGuard, unauthGuard, roleGuard } from '@shared/public-api';

const deliveryGuard = [authGuard, roleGuard('delivery')];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent), canActivate: [unauthGuard] },
  { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [authGuard] },
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: deliveryGuard },
  { path: 'available', loadComponent: () => import('./pages/available-orders/available-orders.component').then(m => m.AvailableOrdersComponent), canActivate: deliveryGuard },
  { path: 'active', loadComponent: () => import('./pages/active-delivery/active-delivery.component').then(m => m.ActiveDeliveryComponent), canActivate: deliveryGuard },
  { path: 'history', loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent), canActivate: deliveryGuard },
  { path: 'earnings', loadComponent: () => import('./pages/earnings/earnings.component').then(m => m.EarningsComponent), canActivate: deliveryGuard },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: deliveryGuard },
  { path: '**', redirectTo: '' }
];


