import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { AdminContestStore } from '../../services/admin/admin-contest.store';
import { CONTEST_GATE_LABELS } from '../../models/contest-admin.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

/**
 * Verseny mód (PATRICKS-VERSENY-MOD-TERV.md, 4.5): feladatonként a kapu állapota, a közzététel, a 30 napos beküldésszám és a megoldók;
 * soronként kinyitva a csoportonkénti bukási arány (melyik csoport túl nehéz vagy hibás). Csak megjelenítés: a kapu futtatása és a
 * közzététel a fő API végpontjain (Task 9 szkript) megy.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-verseny',
  imports: [DatePipe, PercentPipe, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Verseny</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        A verseny-feladatok közzétételi kapuja és forgalma. Közzétenni csak zöld kapuval lehet; a csoportonkénti bukási arány 60 % fölött pirossal jelenik meg.
      </p>
      <div class="hairline"></div>

      @if (store.error()) { <p class="text-danger text-sm mb-4">{{ store.error() }}</p> }
      @if (store.loading() && !store.problems()) {
        <app-local-spinner />
      } @else if (store.problems(); as problems) {
        <div class="card p-5 overflow-x-auto">
          <table class="w-full text-sm" data-testid="contest-problems">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Feladat</th><th class="pr-3">Témakör</th><th class="pr-3 text-right">Nehézség</th>
                <th class="pr-3">Kapu</th><th class="pr-3">Közzétéve</th>
                <th class="pr-3 text-right">Beküldés (30 nap)</th><th class="text-right">Megoldók</th>
              </tr>
            </thead>
            <tbody>
              @for (p of problems; track p.slug) {
                <tr class="border-t border-border-default cursor-pointer" [attr.data-testid]="'row-' + p.slug" (click)="toggle(p.slug)">
                  <td class="py-1.5 pr-3 font-semibold">
                    <button type="button" class="text-left" [attr.aria-expanded]="open() === p.slug">{{ p.title }}</button>
                  </td>
                  <td class="pr-3">{{ p.topicTitle }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ p.difficulty }}</td>
                  <td class="pr-3">
                    <span class="inline-block rounded-full px-2 py-0.5 text-xs font-bold" [attr.data-testid]="'gate-' + p.gateStatus"
                      [class.bg-success]="p.gateStatus === 'green'" [class.bg-danger]="p.gateStatus === 'red'" [class.border]="p.gateStatus === 'none'" [class.border-border-default]="p.gateStatus === 'none'"
                      [class.text-text-muted]="p.gateStatus === 'none'" [class.text-white]="p.gateStatus !== 'none'">{{ gateLabels[p.gateStatus] }}</span>
                    @if (p.gateCheckedAt) { <span class="text-xs text-text-muted ml-2">{{ p.gateCheckedAt | date: 'yyyy.MM.dd. HH:mm' }}</span> }
                  </td>
                  <td class="pr-3">{{ p.isPublished ? 'Igen' : 'Nem' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ p.submissions30d }}</td>
                  <td class="text-right tabular-nums">{{ p.solvers }}</td>
                </tr>
                @if (open() === p.slug) {
                  <tr [attr.data-testid]="'groups-' + p.slug">
                    <td colspan="7" class="pb-3 pl-4">
                      <table class="w-full text-xs">
                        <thead><tr class="text-left text-text-muted"><th class="py-1 pr-3">Csoport</th><th class="pr-3 text-right">Pont</th><th class="pr-3 text-right">Próbálkozás</th><th class="text-right">Bukási arány</th></tr></thead>
                        <tbody>
                          @for (g of p.groups; track g.label) {
                            <tr class="border-t border-border-default">
                              <td class="py-1 pr-3">{{ g.label }}</td>
                              <td class="pr-3 text-right tabular-nums">{{ g.points }}</td>
                              <td class="pr-3 text-right tabular-nums">{{ g.attempts }}</td>
                              <td class="text-right tabular-nums" data-testid="fail-rate" [class.text-danger]="g.failRate > failAlert">{{ g.failRate | percent: '1.0-0' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="7" class="py-3 text-text-muted">Még nincs verseny-feladat.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminVersenyComponent implements OnInit {
  readonly store = inject(AdminContestStore);

  readonly gateLabels = CONTEST_GATE_LABELS;
  /** E fölött a csoport bukási aránya pirossal jelenik meg (túl nehéz vagy hibás csoport gyanúja). */
  readonly failAlert = 0.6;
  /** A kinyitott sor slug-ja. */
  readonly open = signal<string | null>(null);

  ngOnInit(): void {
    this.store.load();
  }

  toggle(slug: string): void {
    this.open.update((current) => (current === slug ? null : slug));
  }
}
