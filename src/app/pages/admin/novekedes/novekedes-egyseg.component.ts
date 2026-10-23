import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject } from '@angular/core';
import { DecimalPipe, PercentPipe, formatNumber } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminGrowthService } from '../../../services/admin/admin-growth.service';
import { UnitEconomics } from '../../../models/growth.model';
import { sourceLabel } from '../../../models/ai-spending.model';
import { downloadCsv } from '../../../shared/csv/csv';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { latestValue } from '../../../shared/resource/latest-value';

/** Egységgazdaság: MI-költség aktív / fizető felhasználónként, árrés, legnagyobb költségforrások; a fül megnyitásakor tölt. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-egyseg',
  imports: [DecimalPipe, PercentPipe, LocalSpinnerComponent],
  template: `
    @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
    @if (data(); as u) {
      <div class="card p-5 mb-6">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold">Havi egységgazdaság</h2>
            <p class="text-xs text-text-muted mt-0.5 max-w-2xl">Aktív: dolgozott a hónap valamelyik hetében. Fizető: a hónap bármely napján érvényes
              fizetős előfizetése volt. MI-költség forintban {{ u.usdToHuf }} Ft/$ árfolyammal (MockExam:UsdToHuf). Árrés: (nettó bevétel − MI-költség) /
              nettó bevétel – a Judge0 és a szerver költsége nélkül.</p>
          </div>
          <button type="button" class="text-xs font-bold text-primary hover:underline" (click)="exportCsv(u)">CSV letöltése</button>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm" data-testid="unit-months">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Hónap</th><th class="pr-3 text-right">MI-költség</th><th class="pr-3 text-right">Aktív</th>
                <th class="pr-3 text-right">Fizető</th><th class="pr-3 text-right">MI / aktív</th><th class="pr-3 text-right">MI / fizető</th>
                <th class="pr-3 text-right">Bevétel / fizető</th><th class="pr-3 text-right">Nettó bevétel</th><th class="text-right">Árrés</th>
              </tr>
            </thead>
            <tbody>
              @for (m of rowsDesc(); track m.month) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ m.month }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.aiCostHuf | number: '1.0-0' }} Ft
                    @if (m.unknownCostCalls) { <span class="text-xs text-warning" [title]="m.unknownCostCalls + ' hívás költség nélkül'">*</span> }</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.activeUsers }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.payingUsers }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ money(m.aiCostPerActiveUserHuf) }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ money(m.aiCostPerPayingUserHuf) }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ money(m.revenuePerPayingUserHuf) }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.netRevenue | number: '1.0-0' }} Ft</td>
                  <td class="text-right tabular-nums font-semibold" [class.text-danger]="m.marginRate !== null && m.marginRate < 0"
                    [class.text-success]="m.marginRate !== null && m.marginRate >= 0.5">{{ m.marginRate === null ? '–' : (m.marginRate | percent: '1.0-0') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5">
        <h2 class="font-bold">Legnagyobb MI-költségforrások <span class="text-xs text-text-muted font-normal">(utolsó 30 nap)</span></h2>
        <div class="mt-3 space-y-1.5" data-testid="unit-drivers">
          @for (d of u.topDrivers; track d.source) {
            <div class="grid grid-cols-[minmax(8rem,16rem)_1fr_7rem_3rem] items-center gap-3 text-sm">
              <span class="truncate" [title]="d.source">{{ label(d.source) }}</span>
              <span class="h-2 rounded-full bg-bg-element overflow-hidden"><span class="block h-full bg-primary" [style.width.%]="d.share * 100"></span></span>
              <span class="text-right tabular-nums">{{ d.costHuf | number: '1.0-0' }} Ft</span>
              <span class="text-right tabular-nums text-text-muted">{{ d.share | percent: '1.0-0' }}</span>
            </div>
          } @empty {
            <p class="text-sm text-text-muted">Nem volt MI-hívás az utolsó 30 napban.</p>
          }
        </div>
      </div>
    } @else if (!error()) {
      <app-local-spinner />
    }
  `,
})
export class AdminNovekedesEgysegComponent {
  private readonly api = inject(AdminGrowthService);
  private readonly locale = inject(LOCALE_ID);
  private readonly report = rxResource({ stream: () => this.api.getUnitEconomics(12) });
  readonly data = latestValue(this.report);
  readonly error = computed(() => (this.report.error() ? 'Az egységgazdasági adatok betöltése nem sikerült.' : null));
  readonly rowsDesc = computed(() => [...(this.data()?.months ?? [])].reverse());
  readonly label = sourceLabel;

  /** Ugyanaz a tagolás, mint az összeg-oszlopok `number: '1.0-0'` pipe-ja (a hu-HU toLocaleString 4 jegyig nem tagol). */
  money(value: number | null): string {
    return value === null ? '–' : `${formatNumber(value, this.locale, '1.0-0')} Ft`;
  }

  exportCsv(u: UnitEconomics): void {
    downloadCsv('egyseggazdasag.csv',
      ['Hónap', 'MI-költség ($)', 'MI-költség (Ft)', 'Költség nélküli hívás', 'Aktív', 'Fizető', 'MI / aktív (Ft)', 'MI / fizető (Ft)', 'Bevétel / fizető (Ft)', 'Nettó bevétel (Ft)', 'Árrés'],
      u.months.map((m) => [m.month, m.aiCostUsd, m.aiCostHuf, m.unknownCostCalls, m.activeUsers, m.payingUsers, m.aiCostPerActiveUserHuf,
        m.aiCostPerPayingUserHuf, m.revenuePerPayingUserHuf, m.netRevenue, m.marginRate]));
  }
}
