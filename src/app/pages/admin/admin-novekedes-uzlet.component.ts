import { ChangeDetectionStrategy, Component, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe, formatNumber } from '@angular/common';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { ReferralReport, RevenueReport, TrialFunnel, UnitEconomics } from '../../models/growth.model';
import { sourceLabel } from '../../models/ai-spending.model';
import { downloadCsv } from '../../shared/csv/csv';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

/**
 * Tulajdonosi irányítópult - a Növekedés oldal fülei (BE: AdminGrowthController + BusinessStatsService). Minden fül a megnyitásakor tölt;
 * az összegek forintban, ahogy a fizetések tárolják, tesztfiókok nélkül.
 */

const CSV_BUTTON = 'text-xs font-bold text-primary hover:underline';

/** Bevétel: havi bontás termékenként, visszatérítéssel; becsült havi ismétlődő bevétel; intézményi licencek. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-bevetel',
  standalone: true,
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
          <button type="button" [class]="csvButton" (click)="exportCsv(r)">CSV letöltése</button>
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
export class AdminNovekedesBevetelComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);
  readonly csvButton = CSV_BUTTON;
  readonly data = signal<RevenueReport | null>(null);
  readonly error = signal<string | null>(null);

  readonly rowsDesc = computed(() => [...(this.data()?.months ?? [])].reverse());
  readonly current = computed(() => this.data()?.months.at(-1) ?? null);
  readonly totalNet = computed(() => (this.data()?.months ?? []).reduce((s, m) => s + m.net, 0));
  private readonly maxNet = computed(() => Math.max(1, ...(this.data()?.months ?? []).map((m) => m.net)));

  ngOnInit(): void {
    this.api.getRevenue(12).subscribe({ next: (r) => this.data.set(r), error: () => this.error.set('A bevételi adatok betöltése nem sikerült.') });
  }

  barWidth(net: number): number {
    return Math.max(0, net) / this.maxNet() * 100;
  }

  exportCsv(r: RevenueReport): void {
    downloadCsv('bevetel.csv',
      ['Hónap', 'Előfizetés', 'Bérlet', 'Szülői', 'Ajándék (becsült)', 'Ajándék db', 'Bruttó', 'Visszatérítés', 'Nettó', 'Fizetések', 'Visszatérítések'],
      r.months.map((m) => [m.month, m.subscription, m.examPass, m.parentPurchase, m.gift, m.giftCount, m.gross, m.refunds, m.net, m.paymentCount, m.refundCount]));
  }
}

/** Próba-tölcsér: regisztrált → próbát kezdett → fizetett, heti kohorszonként. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-proba',
  standalone: true,
  imports: [DatePipe, PercentPipe, LocalSpinnerComponent],
  template: `
    @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
    @if (data(); as f) {
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6" data-testid="trial-kpis">
        <div class="card p-4"><p class="text-xs text-text-muted">Regisztrált</p><p class="text-2xl font-bold tabular-nums">{{ totals().registered }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próbát kezdett</p><p class="text-2xl font-bold tabular-nums">{{ totals().trialStarted }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próba → fizetés (lejárt próbák)</p>
          <p class="text-2xl font-bold tabular-nums">{{ totals().conversion === null ? '–' : (totals().conversion | percent: '1.0-0') }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próba nélkül fizetett</p><p class="text-2xl font-bold tabular-nums">{{ totals().paidWithoutTrial }}</p></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold">Próba → fizetés heti kohorszonként</h2>
            <p class="text-xs text-text-muted mt-0.5 max-w-2xl">A regisztráció hete szerint. Átváltás: a próbázók közül hányan fizettek (vagy aktiváltak
              ajándékot) – a még futó próbák miatt a friss hetek alacsonyabbak. Ellenőrzés: {{ f.trialGrantsInPeriod }} próba-kiadás az időszakban
              (e-mail-napló, tesztfiókokkal együtt).</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5" role="group" aria-label="Hetek">
              @for (w of weekOptions; track w) {
                <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="weeks() === w" [class.text-white]="weeks() === w"
                  [class.text-text-muted]="weeks() !== w" [attr.aria-pressed]="weeks() === w" (click)="setWeeks(w)">{{ w }} hét</button>
              }
            </div>
            <button type="button" [class]="csvButton" (click)="exportCsv(f)">CSV letöltése</button>
          </div>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm" data-testid="trial-cohorts">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Hét</th><th class="pr-3 text-right">Regisztrált</th><th class="pr-3 text-right">Próbát kezdett</th>
                <th class="pr-3 text-right">Próba lejárt</th><th class="pr-3 text-right">Próba után fizetett</th><th class="pr-3 text-right">Átváltás</th>
                <th class="text-right">Próba nélkül fizetett</th>
              </tr>
            </thead>
            <tbody>
              @for (c of f.cohorts; track c.weekStart) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ c.weekStart | date: 'yyyy.MM.dd.' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.registered }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialStarted }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialEnded }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialPaid }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialStarted ? (c.trialPaid / c.trialStarted | percent: '1.0-0') : '–' }}</td>
                  <td class="text-right tabular-nums">{{ c.paidWithoutTrial }}</td>
                </tr>
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
export class AdminNovekedesProbaComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);
  readonly csvButton = CSV_BUTTON;
  readonly weekOptions = [12, 26];
  readonly weeks = signal(12);
  readonly data = signal<TrialFunnel | null>(null);
  readonly error = signal<string | null>(null);

  /** Összesítő; az átváltás csak azokon a heteken, ahol minden próba lejárt (különben a futó próbák lehúznák). */
  readonly totals = computed(() => {
    const cohorts = this.data()?.cohorts ?? [];
    const sum = (f: (c: TrialFunnel['cohorts'][number]) => number) => cohorts.reduce((s, c) => s + f(c), 0);
    const closed = cohorts.filter((c) => c.trialStarted > 0 && c.trialEnded === c.trialStarted);
    const closedTrials = closed.reduce((s, c) => s + c.trialStarted, 0);
    return {
      registered: sum((c) => c.registered),
      trialStarted: sum((c) => c.trialStarted),
      paidWithoutTrial: sum((c) => c.paidWithoutTrial),
      conversion: closedTrials === 0 ? null : closed.reduce((s, c) => s + c.trialPaid, 0) / closedTrials,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  setWeeks(weeks: number): void {
    this.weeks.set(weeks);
    this.load();
  }

  private load(): void {
    this.api.getTrialFunnel(this.weeks()).subscribe({ next: (f) => this.data.set(f), error: () => this.error.set('A próba-tölcsér betöltése nem sikerült.') });
  }

  exportCsv(f: TrialFunnel): void {
    downloadCsv('proba-tolcser.csv', ['Hét', 'Regisztrált', 'Próbát kezdett', 'Próba lejárt', 'Próba után fizetett', 'Próba nélkül fizetett'],
      f.cohorts.map((c) => [c.weekStart, c.registered, c.trialStarted, c.trialEnded, c.trialPaid, c.paidWithoutTrial]));
  }
}

/** Egységgazdaság: MI-költség aktív / fizető felhasználónként, árrés, legnagyobb költségforrások. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-egyseg',
  standalone: true,
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
          <button type="button" [class]="csvButton" (click)="exportCsv(u)">CSV letöltése</button>
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
export class AdminNovekedesEgysegComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);
  private readonly locale = inject(LOCALE_ID);
  readonly csvButton = CSV_BUTTON;
  readonly data = signal<UnitEconomics | null>(null);
  readonly error = signal<string | null>(null);
  readonly rowsDesc = computed(() => [...(this.data()?.months ?? [])].reverse());
  readonly label = sourceLabel;

  ngOnInit(): void {
    this.api.getUnitEconomics(12).subscribe({ next: (u) => this.data.set(u), error: () => this.error.set('Az egységgazdasági adatok betöltése nem sikerült.') });
  }

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

/** Ajánlóprogram: meghívások, fizetett meghívottak, jóváírt jutalmak, függő (14 napos) jutalmak, legjobb ajánlók. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-ajanlo',
  standalone: true,
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
          <button type="button" [class]="csvButton" (click)="exportCsv(r)">CSV letöltése</button>
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
export class AdminNovekedesAjanloComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);
  readonly csvButton = CSV_BUTTON;
  readonly data = signal<ReferralReport | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getReferrals().subscribe({ next: (r) => this.data.set(r), error: () => this.error.set('Az ajánlóprogram adatainak betöltése nem sikerült.') });
  }

  exportCsv(r: ReferralReport): void {
    downloadCsv('ajanlok.csv', ['Felhasználó Id', 'E-mail', 'Meghívott', 'Fizetett', 'Jutalom-hónap', 'Függő'],
      r.topInviters.map((i) => [i.userId, i.email, i.invited, i.converted, i.rewardMonths, i.pending]));
  }
}
