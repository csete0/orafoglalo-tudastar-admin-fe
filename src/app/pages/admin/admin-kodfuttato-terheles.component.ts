import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';
import {
  JUDGE0_KINDS,
  JUDGE0_STATUS_CLASSES,
  JUDGE0_STATUS_LABELS,
  Judge0LoadReport,
  Judge0LoadStats,
  fmtMs,
  judge0KindLabel,
} from '../../models/judge0-load.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { BarChartColumn, BarChartComponent } from '../../shared/bar-chart/bar-chart.component';

type StatRow = { kind: string; stats: Judge0LoadStats };

/** Halmozott oszlop fajtánként (JUDGE0_KINDS sorrendben), súgóban a fajtánkénti futásszám és p95. */
function column(key: string, rows: StatRow[]): BarChartColumn {
  const parts = rows.map((r) => `${judge0KindLabel(r.kind)}: ${r.stats.runs} futás, p95 ${fmtMs(r.stats.p95Ms)}`);
  return {
    key,
    title: [key, ...parts].join(' · '),
    segments: JUDGE0_KINDS.map((k) => ({ value: rows.filter((r) => r.kind === k.key).reduce((s, r) => s + r.stats.runs, 0), color: k.color })),
  };
}

/**
 * Kódfuttató terhelés (10-18): a Judge0 futások óránkénti statisztikája fajtánként - mikor éri meg külön Judge0 gépet venni.
 * Állapot + javaslat a BE küszöbei alapján, napi oszlopdiagram és táblázat, egy kiválasztott nap óránként.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-kodfuttato-terheles',
  imports: [LocalSpinnerComponent, BarChartComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Kódfuttató terhelés</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        A Judge0 futások várakozási és futási ideje, a „túlterhelt” elutasítások és a sor mélysége – ebből látszik, mikor kell külön Judge0 gép.
      </p>
      <div class="hairline"></div>

      <div class="flex justify-end mb-4">
        <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5" role="group" aria-label="Időszak">
          @for (d of dayOptions; track d) {
            <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="days() === d"
              [class.text-white]="days() === d" [class.text-text-muted]="days() !== d" [attr.aria-pressed]="days() === d"
              (click)="setDays(d)">{{ d }} nap</button>
          }
        </div>
      </div>

      @if (error()) {
        <p class="text-danger text-sm mb-4">{{ error() }}</p>
      }
      @if (loading()) {
        <app-local-spinner />
      } @else if (report(); as r) {
        <div class="card p-5 mb-6 border-l-4" [class.border-success]="r.status === 'green'" [class.border-warning]="r.status === 'yellow'"
          [class.border-danger]="r.status === 'red'">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold" [class]="badgeClass(r.status)">{{ statusLabel(r.status) }}</span>
            <h2 class="font-bold">{{ r.recommendation }}</h2>
          </div>
          @if (r.reasons.length) {
            <ul class="mt-3 text-sm list-disc pl-5 flex flex-col gap-1">
              @for (reason of r.reasons; track reason) { <li>{{ reason }}</li> }
            </ul>
          }
          <p class="text-xs text-text-muted mt-3">
            Sárga: a futtatások munkaidős ({{ r.thresholds.workHourStart }}–{{ r.thresholds.workHourEnd }} óra) p95-e valamelyik nap
            {{ fmt(r.thresholds.yellowP95Ms) }} fölött, vagy volt „túlterhelt” elutasítás vagy rendszerhiba. Piros: p95 {{ fmt(r.thresholds.redP95Ms) }} fölött,
            az elutasítások aránya {{ r.thresholds.redBusyRatio * 100 }}% vagy a rendszerhibáké {{ r.thresholds.redSystemErrorRatio * 100 }}% fölött. A p95 csak legalább
            {{ r.thresholds.minRunsForP95 }} futásos napon számít; a hisztogramból becsült érték (≤1, 2, 3, 5, 10, 30 s rekeszek).
          </p>
        </div>

        @if (r.status === 'none') {
          <div class="card p-5 text-sm text-text-muted">
            Még nincs mérési adat ebben az időszakban. Az API minden Judge0 futást összesít, és percenként kiírja – az első futás után itt megjelenik.
          </div>
        } @else {
          <div class="card p-5 mb-6">
            <h2 class="font-bold">Napi futások</h2>
            <p class="text-xs text-text-muted mt-0.5">Fajtánként; az oszlopra kattintva a nap óránként.</p>
            <svg app-bar-chart [columns]="dailyColumns()" clickable (barClick)="selectedDay.set($event)" class="w-full h-auto block mt-3" role="img"
              aria-label="Napi Judge0-futások fajtánként"></svg>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-default text-xs text-text-muted">
              @for (k of kinds; track k.key) {
                <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm inline-block" [style.background]="k.color"></span>{{ k.label }}</span>
              }
            </div>
          </div>

          <div class="card p-5 mb-6">
            <h2 class="font-bold">Naponként</h2>
            <div class="overflow-x-auto mt-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-text-muted">
                    <th class="py-2 pr-3">Nap</th><th class="pr-3">Fajta</th><th class="pr-3 text-right">Futás</th>
                    <th class="pr-3 text-right">p50</th><th class="pr-3 text-right">p95</th><th class="pr-3 text-right">p95 munkaidőben</th>
                    <th class="pr-3 text-right">Max</th><th class="pr-3 text-right">Túlterhelt</th><th class="pr-3 text-right">Időtúllépés</th>
                    <th class="pr-3 text-right">Rendszerhiba</th><th class="pr-3 text-right">Max sor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of dailyRows(); track d.date + d.kind) {
                    <tr class="border-t border-border-default cursor-pointer" [class.bg-bg-element]="d.date === selectedDay()" (click)="selectedDay.set(d.date)">
                      <td class="py-2 pr-3 whitespace-nowrap">{{ dayLabel(d.date) }}</td>
                      <td class="pr-3">{{ kindLabel(d.kind) }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ d.stats.runs }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ fmt(d.stats.p50Ms) }}</td>
                      <td class="pr-3 text-right tabular-nums font-bold">{{ fmt(d.stats.p95Ms) }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ fmt(d.workHoursP95Ms) }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ fmt(d.stats.maxMs) }}</td>
                      <td class="pr-3 text-right tabular-nums" [class.text-warning]="d.stats.busy > 0">{{ d.stats.busy }}</td>
                      <td class="pr-3 text-right tabular-nums" [class.text-warning]="d.stats.timeouts > 0">{{ d.stats.timeouts }}</td>
                      <td class="pr-3 text-right tabular-nums" [class.text-danger]="d.stats.systemErrors > 0">{{ d.stats.systemErrors }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ d.stats.maxQueueDepth }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (selectedDay(); as day) {
            <div class="card p-5">
              <h2 class="font-bold">{{ dayLabel(day) }} óránként</h2>
              <svg app-bar-chart [columns]="hourlyColumns()" class="w-full h-auto block mt-3" role="img" aria-label="Óránkénti Judge0-futások"></svg>
              <div class="overflow-x-auto mt-3">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-text-muted">
                      <th class="py-2 pr-3">Óra</th><th class="pr-3">Fajta</th><th class="pr-3 text-right">Futás</th><th class="pr-3 text-right">p50</th>
                      <th class="pr-3 text-right">p95</th><th class="pr-3 text-right">Átl. várakozás</th><th class="pr-3 text-right">Max</th>
                      <th class="pr-3 text-right">Túlterhelt</th><th class="pr-3 text-right">Időtúllépés</th><th class="pr-3 text-right">Rendszerhiba</th>
                      <th class="pr-3 text-right">Max sor</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (h of hourlyRows(); track h.hour + h.kind) {
                      <tr class="border-t border-border-default">
                        <td class="py-2 pr-3 tabular-nums">{{ h.hour.slice(11, 16) }}</td>
                        <td class="pr-3">{{ kindLabel(h.kind) }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ h.stats.runs }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ fmt(h.stats.p50Ms) }}</td>
                        <td class="pr-3 text-right tabular-nums font-bold">{{ fmt(h.stats.p95Ms) }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ fmt(h.stats.avgWaitMs) }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ fmt(h.stats.maxMs) }}</td>
                        <td class="pr-3 text-right tabular-nums" [class.text-warning]="h.stats.busy > 0">{{ h.stats.busy }}</td>
                        <td class="pr-3 text-right tabular-nums" [class.text-warning]="h.stats.timeouts > 0">{{ h.stats.timeouts }}</td>
                        <td class="pr-3 text-right tabular-nums" [class.text-danger]="h.stats.systemErrors > 0">{{ h.stats.systemErrors }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ h.stats.maxQueueDepth }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class AdminKodfuttatoTerhelesComponent implements OnInit {
  private readonly api = inject(AdminJudge0LoadService);

  readonly dayOptions = [7, 30, 90];
  readonly kinds = JUDGE0_KINDS;

  readonly days = signal(7);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly report = signal<Judge0LoadReport | null>(null);
  /** A kiválasztott nap („2026-10-18”); alapból a legutolsó nap adattal. */
  readonly selectedDay = signal<string | null>(null);

  /** Legfrissebb nap elöl. */
  readonly dailyRows = computed(() => [...(this.report()?.daily ?? [])].sort((a, b) => b.date.localeCompare(a.date)));

  readonly hourlyRows = computed(() => {
    const day = this.selectedDay();
    return (this.report()?.hourly ?? []).filter((h) => h.hour.startsWith(day ?? '-'));
  });

  /** Napi oszlopok, időrendben. */
  readonly dailyColumns = computed<BarChartColumn[]>(() => {
    const daily = this.report()?.daily ?? [];
    const dates = [...new Set(daily.map((d) => d.date))].sort();
    return dates.map((date) => column(date, daily.filter((d) => d.date === date)));
  });

  /** A kiválasztott nap 24 órája; felirat minden 3. órán. */
  readonly hourlyColumns = computed<BarChartColumn[]>(() => {
    const rows = this.hourlyRows();
    return Array.from({ length: 24 }, (_, h) => {
      const hh = String(h).padStart(2, '0');
      return { ...column(hh, rows.filter((r) => r.hour.slice(11, 13) === hh)), label: h % 3 === 0 ? hh : '' };
    });
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async setDays(days: number): Promise<void> {
    this.days.set(days);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const report = await firstValueFrom(this.api.getReport(this.days()));
      this.report.set(report);
      this.selectedDay.set(report.daily.length ? report.daily[report.daily.length - 1].date : null);
    } catch {
      this.error.set('A kódfuttató terhelés-adatait nem sikerült betölteni.');
    } finally {
      this.loading.set(false);
    }
  }

  dayLabel(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' });
  }

  kindLabel = judge0KindLabel;
  fmt = fmtMs;

  statusLabel(status: Judge0LoadReport['status']): string {
    return JUDGE0_STATUS_LABELS[status];
  }

  badgeClass(status: Judge0LoadReport['status']): string {
    return JUDGE0_STATUS_CLASSES[status];
  }
}
