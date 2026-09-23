import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  // ADM-F1/A5: a terv sorrendje szerint épülnek ide a funkciók, egy-egy saját
  // route/komponens formájában - a route mező null, amíg a funkció nem kész.
  protected readonly items = [
    { label: 'Audit-napló', note: 'A5 - kész', route: '/audit-log' },
    { label: 'Ajándékkód-kezelés', note: 'A1 - kész', route: '/gift-coupons' },
    { label: 'Felhasználó-kereső / 360°', note: 'A2 - kész', route: '/users' },
    { label: 'Támogatói műveletek', note: 'A3 - kész (a felhasználó-részletezőben)', route: '/users' },
    { label: 'Fizetés-lista', note: 'A4 - kész', route: '/payments' },
    { label: 'Tanári aktivitás', note: 'A7 - kész (a jelenlegi tanár-admin felületen)', route: null },
    { label: 'Alkalmazás-állapot', note: 'A6 - kész', route: '/app-status' },
  ];
}
