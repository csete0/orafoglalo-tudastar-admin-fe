import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminGrowthService } from '../../../services/admin/admin-growth.service';
import { ReferralReport } from '../../../models/growth.model';
import { downloadCsv } from '../../../shared/csv/csv';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { latestValue } from '../../../shared/resource/latest-value';

/** Ajánlóprogram: meghívások, fizetett meghívottak, jóváírt jutalmak, függő (14 napos) jutalmak, legjobb ajánlók; a fül megnyitásakor tölt. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-ajanlo',
  imports: [LocalSpinnerComponent],
  template: `
    @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
    @if (data(); as r) {
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6" data-testid="referral-kpis">
        <div class="card p-4"><p class="text-xs text-text-muted">Meghívás</p><p class="text-2xl font-bold tabular-nums">{{ r.created }}</p>
          <p class="text-xs text-text-muted">ebből {{ r.created30 }} az utolsó 30 napban</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Fizetett meghívott</p><p class="text-2xl font-bold tabular-nums">{{ r.converted }}</p>
          <p class="text-xs text-text-muted">{{ r.inviteeRewards }} meghívott kapott +30 napot</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Ajánlói jutalom-hónap</p><p class="text-2xl font-bold tabular-nums">{{ r.referrerRewardMonths }}</p>
          <p class="text-xs text-text-muted">{{ r.referrerExtend }} hosszabbítás, {{ r.referrerCode }} ajándékkód; {{ r.referrerCapped }} korlát, {{ r.referrerRefunded }} visszatérítés miatt nem</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Függő (14 napos várakozás)</p><p class="text-2xl font-bold tabular-nums">{{ r.pending }}</p>
          @if (r.pendingOverdue) { <p class="text-xs text-warning">{{ r.pendingOverdue }} lejárt, a napi job még nem dolgozta fel</p> }</div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="font-bold">Legjobb ajánlók</h2>
          <button type="button" class="text-xs font-bold text-primary hover:underline" (click)="exportCsv(r)">CSV letöltése</button>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm" data-testid="referral-inviters">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Felhasználó</th><th class="pr-3 text-right">Meghívott</th><th class="pr-3 text-right">Fizetett</th>
                <th class="pr-3 text-right">Jutalom-hónap</th><th class="text-right">Függő</th>
              </tr>
            </thead>
            <tbody>
              @for (i of r.topInviters; track i.userId) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 pr-3"><span class="text-text-muted text-xs">#{{ i.userId }}</span> {{ i.email ?? '–' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ i.invited }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ i.converted }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ i.rewardMonths }}</td>
                  <td class="text-right tabular-nums">{{ i.pending }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="py-3 text-text-muted">Még nincs meghívás.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else if (!error()) {
      <app-local-spinner />
    }
  `,
})
export class AdminNovekedesAjanloComponent {
  private readonly api = inject(AdminGrowthService);
  private readonly report = rxResource({ stream: () => this.api.getReferrals() });
  readonly data = latestValue(this.report);
  readonly error = computed(() => (this.report.error() ? 'Az ajánlóprogram adatainak betöltése nem sikerült.' : null));

  exportCsv(r: ReferralReport): void {
    downloadCsv('ajanlok.csv', ['Felhasználó Id', 'E-mail', 'Meghívott', 'Fizetett', 'Jutalom-hónap', 'Függő'],
      r.topInviters.map((i) => [i.userId, i.email, i.invited, i.converted, i.rewardMonths, i.pending]));
  }
}
