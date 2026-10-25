import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  // Minden oldal a bejelentkezéshez kötött: egy komponens nélküli szülő-útvonal őrzi a gyerekeit (a login és a ** kívül).
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'audit-log',
        loadComponent: () => import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
      },
      {
        path: 'gift-coupons',
        loadComponent: () =>
          import('./pages/gift-coupons/gift-coupons.component').then((m) => m.GiftCouponsComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./pages/user-detail/user-detail.component').then((m) => m.UserDetailComponent),
      },
      {
        path: 'payments',
        loadComponent: () => import('./pages/payments/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'app-status',
        loadComponent: () =>
          import('./pages/app-status/app-status.component').then((m) => m.AppStatusComponent),
      },
      // §3 migráció: a teacher-fe admin/*.ts oldalainak áthozatala (PATRICKS-ADMIN-
      // SZETVALASZTAS-TERV.md). Nincs külön roleGuard - az egész admin-fe már
      // admin-audience JWT-vel gated (authGuard + az Admin.API RequireAdminRole-ja).
      {
        path: 'jelentkezesek',
        loadComponent: () =>
          import('./pages/admin/admin-jelentkezesek.component').then((m) => m.AdminJelentkezesekComponent),
      },
      {
        path: 'tanarok',
        loadComponent: () =>
          import('./pages/admin/admin-tanarok.component').then((m) => m.AdminTanarokComponent),
      },
      {
        path: 'demok',
        loadComponent: () => import('./pages/admin/admin-demok.component').then((m) => m.AdminDemokComponent),
      },
      {
        path: 'intezmenyek',
        loadComponent: () =>
          import('./pages/admin/admin-intezmenyek.component').then((m) => m.AdminIntezmenyekComponent),
      },
      {
        path: 'ellenorzes',
        loadComponent: () =>
          import('./pages/admin/admin-ellenorzes.component').then((m) => m.AdminEllenorzesComponent),
      },
      // B3: kuponkódok - a plan/teacher-fe mintája szerint nincs fejléc nav-link (dashboard-
      // csempéről érhető el), az admin-fe nav-ja már így is zsúfolt (F1-A7 + ez az 5 új oldal).
      {
        path: 'kuponok',
        loadComponent: () =>
          import('./pages/admin/admin-kuponok.component').then((m) => m.AdminKuponokComponent),
      },
      {
        path: 'ai-koltes',
        loadComponent: () =>
          import('./pages/admin/admin-ai-koltes.component').then((m) => m.AdminAiKoltesComponent),
      },
      {
        path: 'projektmuhely',
        loadComponent: () =>
          import('./pages/admin/admin-projektmuhely.component').then((m) => m.AdminProjektmuhelyComponent),
      },
      {
        path: 'git',
        loadComponent: () => import('./pages/admin/admin-git.component').then((m) => m.AdminGitComponent),
      },
      {
        path: 'csapatok',
        loadComponent: () => import('./pages/admin/admin-csapatok.component').then((m) => m.AdminCsapatokComponent),
      },
      {
        path: 'kodfuttato-terheles',
        loadComponent: () =>
          import('./pages/admin/admin-kodfuttato-terheles.component').then((m) => m.AdminKodfuttatoTerhelesComponent),
      },
      {
        path: 'verseny',
        loadComponent: () =>
          import('./pages/admin/admin-verseny.component').then((m) => m.AdminVersenyComponent),
      },
      {
        path: 'gyakorlo-ertekelesek',
        loadComponent: () =>
          import('./pages/admin/admin-gyakorlo-ertekelesek.component').then((m) => m.AdminGyakorloErtekelesekComponent),
      },
      {
        path: 'szempontlistak',
        loadComponent: () =>
          import('./pages/admin/admin-szempontlistak.component').then((m) => m.AdminSzempontlistakComponent),
      },
      {
        path: 'novekedes',
        loadComponent: () =>
          import('./pages/admin/admin-novekedes.component').then((m) => m.AdminNovekedesComponent),
      },
      {
        path: 'probaerettsegi',
        loadComponent: () =>
          import('./pages/admin/admin-probaerettsegi.component').then((m) => m.AdminProbaerettsegiComponent),
      },
      {
        path: 'erettsegi-eredmenyek',
        loadComponent: () =>
          import('./pages/admin/admin-erettsegi-eredmenyek.component').then((m) => m.AdminErettsegiEredmenyekComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
