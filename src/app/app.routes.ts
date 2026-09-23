import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'audit-log',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  {
    path: 'gift-coupons',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/gift-coupons/gift-coupons.component').then((m) => m.GiftCouponsComponent),
  },
  { path: '**', redirectTo: '' },
];
