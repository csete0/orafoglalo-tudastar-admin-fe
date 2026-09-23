import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  // ADM-F1: ez a komponens csak a hozzáférési modellt bizonyítja
  // (bejelentkezés -> védett útvonal). A tényleges funkciók (A5 audit-napló,
  // A1 ajándékkód-kezelés, A2 felhasználó-kereső, ...) a terv sorrendje
  // szerint ide kerülnek majd, egy-egy saját route/komponens formájában.
  protected readonly upcoming = [
    { label: 'Audit-napló', note: 'A5 - legközelebb' },
    { label: 'Ajándékkód-kezelés', note: 'A1' },
    { label: 'Felhasználó-kereső / 360°', note: 'A2' },
    { label: 'Támogatói műveletek', note: 'A3' },
    { label: 'Fizetés-lista', note: 'A4' },
    { label: 'Tanári aktivitás', note: 'A7' },
  ];
}
