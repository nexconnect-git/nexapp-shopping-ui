import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@shared/public-api';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent), canActivate: [guestGuard] },
  { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [authGuard] },
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
  { path: 'available', loadComponent: () => import('./pages/available-orders/available-orders.component').then(m => m.AvailableOrdersComponent), canActivate: [authGuard] },
  { path: 'active', loadComponent: () => import('./pages/active-delivery/active-delivery.component').then(m => m.ActiveDeliveryComponent), canActivate: [authGuard] },
  { path: 'history', loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent), canActivate: [authGuard] },
  { path: 'earnings', loadComponent: () => import('./pages/earnings/earnings.component').then(m => m.EarningsComponent), canActivate: [authGuard] },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
