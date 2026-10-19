import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { JUDGE0_STATUS_CLASSES, JUDGE0_STATUS_LABELS } from '../../models/judge0-load.model';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  /** A kódfuttató (Judge0) terhelés állapota az elmúlt 7 napra - kis jelvény a Kódfuttató terhelés oldalra. */
  protected readonly judge0Status = toSignal(
    inject(AdminJudge0LoadService).getReport(7).pipe(map((r) => r.status), catchError(() => of(null))),
    { initialValue: null },
  );
  protected readonly judge0Labels = JUDGE0_STATUS_LABELS;
  protected readonly judge0Classes = JUDGE0_STATUS_CLASSES;

  // ADM-F1/A5: a terv sorrendje szerint épülnek ide a funkciók, egy-egy saját
  // route/komponens formájában - a route mező null, amíg a funkció nem kész.
  protected readonly items = [
    { label: 'Audit-napló', note: 'A5 - kész', route: '/audit-log' },
    { label: 'Ajándékkód-kezelés', note: 'A1 - kész', route: '/gift-coupons' },
    { label: 'Felhasználó-kereső / 360°', note: 'A2 - kész', route: '/users' },
    { label: 'Támogatói műveletek', note: 'A3 - kész (a felhasználó-részletezőben)', route: '/users' },
    { label: 'Fizetés-lista', note: 'A4 - kész', route: '/payments' },
    { label: 'Tanári aktivitás', note: 'A7 - kész', route: '/tanarok' },
    { label: 'Alkalmazás-állapot', note: 'A6 - kész', route: '/app-status' },
    { label: 'Kódfuttató terhelés', note: 'Judge0: várakozás, p95, túlterhelés', route: '/kodfuttato-terheles' },
    // §3 migráció: a teacher-fe régi admin/*.ts oldalainak áthozatala.
    { label: 'Tanári jelentkezések', note: 'migrálva', route: '/jelentkezesek' },
    { label: 'Intézményi licencek', note: 'migrálva', route: '/intezmenyek' },
    { label: 'Kérdés-jelentések / érdeklődések', note: 'migrálva', route: '/ellenorzes' },
    { label: 'Kuponkódok (általános)', note: 'migrálva', route: '/kuponok' },
    { label: 'AI-költés pult', note: 'migrálva', route: '/ai-koltes' },
    { label: 'Projektműhely', note: 'haladás, tölcsér, AI- és Judge0-költés', route: '/projektmuhely' },
    { label: 'Git', note: 'kvóták, tárolók, zárolás', route: '/git' },
    { label: 'Növekedés', note: 'kohorszok, aktiválódás, megmaradás, lemondási okok', route: '/novekedes' },
    { label: 'Érettségi-eredmények', note: 'valódi eredmények, előrejelzés-pontosság, idézetek', route: '/erettsegi-eredmenyek' },
    { label: 'Szempontlisták', note: 'a hivatalos feladatok pontozási szempontjai, jóváhagyás', route: '/szempontlistak' },
    { label: 'Gyakorló értékelések', note: 'darab, költség, keret-kihasználtság, toplista', route: '/gyakorlo-ertekelesek' },
  ];
}
