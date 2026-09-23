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
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
  },
  {
    path: 'users/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/user-detail/user-detail.component').then((m) => m.UserDetailComponent),
  },
  {
    path: 'payments',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payments/payments.component').then((m) => m.PaymentsComponent),
  },
  {
    path: 'app-status',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/app-status/app-status.component').then((m) => m.AppStatusComponent),
  },
  // §3 migráció: a teacher-fe admin/*.ts oldalainak áthozatala (PATRICKS-ADMIN-
  // SZETVALASZTAS-TERV.md). Nincs külön roleGuard - az egész admin-fe már
  // admin-audience JWT-vel gated (authGuard + az Admin.API RequireAdminRole-ja).
  {
    path: 'jelentkezesek',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-jelentkezesek.component').then((m) => m.AdminJelentkezesekComponent),
  },
  {
    path: 'tanarok',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-tanarok.component').then((m) => m.AdminTanarokComponent),
  },
  {
    path: 'intezmenyek',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-intezmenyek.component').then((m) => m.AdminIntezmenyekComponent),
  },
  {
    path: 'ellenorzes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-ellenorzes.component').then((m) => m.AdminEllenorzesComponent),
  },
  // B3: kuponkódok - a plan/teacher-fe mintája szerint nincs fejléc nav-link (dashboard-
  // csempéről érhető el), az admin-fe nav-ja már így is zsúfolt (F1-A7 + ez az 5 új oldal).
  {
    path: 'kuponok',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-kuponok.component').then((m) => m.AdminKuponokComponent),
  },
  {
    path: 'ai-koltes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin/admin-ai-koltes.component').then((m) => m.AdminAiKoltesComponent),
  },
  { path: '**', redirectTo: '' },
];
