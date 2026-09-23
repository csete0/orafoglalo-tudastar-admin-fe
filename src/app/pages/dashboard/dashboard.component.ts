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
    { label: 'Ajándékkód-kezelés', note: 'A1', route: null },
    { label: 'Felhasználó-kereső / 360°', note: 'A2', route: null },
    { label: 'Támogatói műveletek', note: 'A3', route: null },
    { label: 'Fizetés-lista', note: 'A4', route: null },
    { label: 'Tanári aktivitás', note: 'A7', route: null },
  ];
}
