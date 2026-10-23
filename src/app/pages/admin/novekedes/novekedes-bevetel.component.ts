import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminGrowthService } from '../../../services/admin/admin-growth.service';
import { RevenueReport } from '../../../models/growth.model';
import { downloadCsv } from '../../../shared/csv/csv';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { latestValue } from '../../../shared/resource/latest-value';

/**
 * Bevétel (tulajdonosi irányítópult, BE: AdminGrowthController + BusinessStatsService): havi bontás termékenként, visszatérítéssel;
 * becsült havi ismétlődő bevétel; intézményi licencek. Forintban, ahogy a fizetések tárolják, tesztfiókok nélkül; a fül megnyitásakor tölt.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-bevetel',
  imports: [DecimalPipe, LocalSpinnerComponent],
  template: `
    @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
    @if (data(); as r) {
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6" data-testid="revenue-kpis">
        <div class="card p-4"><p class="text-xs text-text-muted">Nettó bevétel (folyó hónap)</p>
          <p class="text-2xl font-bold tabular-nums">{{ current()?.net | number: '1.0-0' }} Ft</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Nettó bevétel ({{ r.months.length }} hónap)</p>
          <p class="text-2xl font-bold tabular-nums">{{ totalNet() | number: '1.0-0' }} Ft</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Becsült havi ismétlődő bevétel</p>
          <p class="text-2xl font-bold tabular-nums">{{ r.recurringMonthlyEstimate | number: '1.0-0' }} Ft</p>
          <p class="text-xs text-text-muted">{{ r.recurringSubscriptions }} megújuló előfizetés, listaáron</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Aktív érettségi-bérlet</p>
          <p class="text-2xl font-bold tabular-nums">{{ r.activeExamPasses }}</p><p class="text-xs text-text-muted">egyszeri, nem újul meg</p></div>
      </div>

      <div class="card p-5 mb-6">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold">Havi bevétel termékenként</h2>
            <p class="text-xs text-text-muted mt-0.5 max-w-2xl">Sikeres Stripe-fizetések a fizetés napja szerint (magyar naptári hónap); a visszatérítés
              a visszatérítés hónapjában csökkenti a nettót. Az ajándékkód-vásárlás összege nincs tárolva: a csomag mostani listaárán becsült,
              a bérlet-ajándék csak darabként szerepel.</p>
          </div>
          <button type="button" class="text-xs font-bold text-primary hover:underline" (click)="exportCsv(r)">CSV letöltése</button>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm" data-testid="revenue-months">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Hónap</th><th class="pr-3 text-right">Előfizetés</th><th class="pr-3 text-right">Bérlet</th>
                <th class="pr-3 text-right">Szülői</th><th class="pr-3 text-right">Ajándék (becsült)</th><th class="pr-3 text-right">Visszatérítés</th>
                <th class="pr-3 text-right">Nettó</th><th class="w-32"></th>
              </tr>
            </thead>
            <tbody>
              @for (m of rowsDesc(); track m.month) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ m.month }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.subscription | number: '1.0-0' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.examPass | number: '1.0-0' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.parentPurchase | number: '1.0-0' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ m.gift | number: '1.0-0' }}
                    @if (m.giftCount) { <span class="text-xs text-text-muted">({{ m.giftCount }} db)</span> }</td>
                  <td class="pr-3 text-right tabular-nums" [class.text-danger]="m.refunds > 0">{{ m.refunds ? '−' : '' }}{{ m.refunds | number: '1.0-0' }}</td>
                  <td class="pr-3 text-right tabular-nums font-semibold">{{ m.net | number: '1.0-0' }}</td>
                  <td><span class="block h-2 rounded-full bg-bg-element overflow-hidden"><span class="block h-full bg-primary" [style.width.%]="barWidth(m.net)"></span></span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5" data-testid="revenue-licences">
        <h2 class="font-bold">Intézményi licencek</h2>
        <p class="text-sm mt-1"><span class="tabular-nums font-semibold">{{ r.licences.activeLicences }}</span> aktív licenc,
          <span class="tabular-nums font-semibold">{{ r.licences.seatsInUse }}</span> / {{ r.licences.seats }} hely foglalt.</p>
        @if (!r.licences.amountsTracked) {
          <p class="text-xs text-text-muted mt-1">A licencek kézi számlázásúak, az összegük nincs rögzítve (csak a számlázási megjegyzés) – a
            bevételben nem szerepelnek.</p>
        }
      </div>
    } @else if (!error()) {
      <app-local-spinner />
    }
  `,
})
export class AdminNovekedesBevetelComponent {
  private readonly api = inject(AdminGrowthService);
  private readonly report = rxResource({ stream: () => this.api.getRevenue(12) });
  readonly data = latestValue(this.report);
  readonly error = computed(() => (this.report.error() ? 'A bevételi adatok betöltése nem sikerült.' : null));

  readonly rowsDesc = computed(() => [...(this.data()?.months ?? [])].reverse());
  readonly current = computed(() => this.data()?.months.at(-1) ?? null);
  readonly totalNet = computed(() => (this.data()?.months ?? []).reduce((s, m) => s + m.net, 0));
  private readonly maxNet = computed(() => Math.max(1, ...(this.data()?.months ?? []).map((m) => m.net)));

  barWidth(net: number): number {
    return Math.max(0, net) / this.maxNet() * 100;
  }

  exportCsv(r: RevenueReport): void {
    downloadCsv('bevetel.csv',
      ['Hónap', 'Előfizetés', 'Bérlet', 'Szülői', 'Ajándék (becsült)', 'Ajándék db', 'Bruttó', 'Visszatérítés', 'Nettó', 'Fizetések', 'Visszatérítések'],
      r.months.map((m) => [m.month, m.subscription, m.examPass, m.parentPurchase, m.gift, m.giftCount, m.gross, m.refunds, m.net, m.paymentCount, m.refundCount]));
  }
}
