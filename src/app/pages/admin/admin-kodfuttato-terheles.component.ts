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

const CHART_WIDTH = 860;
const CHART_HEIGHT = 180;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

interface Column {
  key: string;
  label: string;
  rows: { kind: string; stats: Judge0LoadStats }[];
}

interface Bar {
  key: string;
  x: number;
  width: number;
  label: string;
  title: string;
  segments: { y: number; h: number; color: string }[];
}

/**
 * Kódfuttató terhelés (10-18): a Judge0 futások óránkénti statisztikája fajtánként - mikor éri meg külön Judge0 gépet venni.
 * Állapot + javaslat a BE küszöbei alapján, napi oszlopdiagram és táblázat, egy kiválasztott nap óránként.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-kodfuttato-terheles',
  imports: [LocalSpinnerComponent],
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
            <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" class="w-full h-auto block mt-3" role="img" aria-label="Napi Judge0-futások fajtánként">
              @for (tick of dailyTicks(); track tick.y) {
                <line [attr.x1]="padLeft" [attr.x2]="chartWidth - padRight" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--color-border-default)" stroke-width="1" />
                <text [attr.x]="padLeft - 6" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--color-text-muted)">{{ tick.label }}</text>
              }
              @for (bar of dailyBars(); track bar.key) {
                @for (s of bar.segments; track $index) {
                  <rect [attr.x]="bar.x" [attr.y]="s.y" [attr.width]="bar.width" [attr.height]="s.h" [attr.fill]="s.color" rx="2" />
                }
                <rect [attr.x]="bar.x" [attr.y]="padTop" [attr.width]="bar.width" [attr.height]="chartHeight - padTop - padBottom" fill="transparent"
                  class="cursor-pointer" (click)="selectedDay.set(bar.key)"><title>{{ bar.title }}</title></rect>
              }
            </svg>
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
              <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" class="w-full h-auto block mt-3" role="img" aria-label="Óránkénti Judge0-futások">
                @for (tick of hourlyTicks(); track tick.y) {
                  <line [attr.x1]="padLeft" [attr.x2]="chartWidth - padRight" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--color-border-default)" stroke-width="1" />
                  <text [attr.x]="padLeft - 6" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--color-text-muted)">{{ tick.label }}</text>
                }
                @for (bar of hourlyBars(); track bar.key) {
                  @for (s of bar.segments; track $index) {
                    <rect [attr.x]="bar.x" [attr.y]="s.y" [attr.width]="bar.width" [attr.height]="s.h" [attr.fill]="s.color" rx="2" />
                  }
                  <text [attr.x]="bar.x + bar.width / 2" [attr.y]="chartHeight - 6" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">{{ bar.label }}</text>
                  <rect [attr.x]="bar.x" [attr.y]="padTop" [attr.width]="bar.width" [attr.height]="chartHeight - padTop - padBottom" fill="transparent"><title>{{ bar.title }}</title></rect>
                }
              </svg>
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
  readonly chartWidth = CHART_WIDTH;
  readonly chartHeight = CHART_HEIGHT;
  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;
  readonly padTop = PAD_TOP;
  readonly padBottom = PAD_BOTTOM;

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

  private readonly dailyColumns = computed<Column[]>(() => {
    const byDate = new Map<string, Column>();
    for (const d of this.report()?.daily ?? []) {
      const col = byDate.get(d.date) ?? { key: d.date, label: this.dayLabel(d.date), rows: [] };
      col.rows.push(d);
      byDate.set(d.date, col);
    }
    return [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  private readonly hourlyColumns = computed<Column[]>(() => {
    const rows = this.hourlyRows();
    return Array.from({ length: 24 }, (_, h) => {
      const hh = String(h).padStart(2, '0');
      return { key: hh, label: h % 3 === 0 ? hh : '', rows: rows.filter((r) => r.hour.slice(11, 13) === hh) };
    });
  });

  readonly dailyBars = computed(() => this.bars(this.dailyColumns()));
  readonly dailyTicks = computed(() => this.ticks(this.dailyColumns()));
  readonly hourlyBars = computed(() => this.bars(this.hourlyColumns()));
  readonly hourlyTicks = computed(() => this.ticks(this.hourlyColumns()));

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

  private maxRuns(columns: Column[]): number {
    return Math.max(4, ...columns.map((c) => c.rows.reduce((s, r) => s + r.stats.runs, 0)));
  }

  private ticks(columns: Column[]) {
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const max = this.maxRuns(columns);
    return [0, 1, 2, 3, 4].map((i) => ({ y: PAD_TOP + plotH - (i / 4) * plotH, label: String(Math.round((max / 4) * i)) }));
  }

  /** Halmozott oszlopok fajtánként (a Projektműhely-oldal SVG-mintája). */
  private bars(columns: Column[]): Bar[] {
    const plotW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = plotW / Math.max(1, columns.length);
    const width = Math.max(2, Math.min(18, step * 0.7));
    const max = this.maxRuns(columns);
    return columns.map((c, i) => {
      let base = PAD_TOP + plotH;
      const segments = JUDGE0_KINDS.flatMap((k) => {
        const runs = c.rows.filter((r) => r.kind === k.key).reduce((s, r) => s + r.stats.runs, 0);
        if (!runs) return [];
        const h = (runs / max) * plotH;
        base -= h;
        return [{ y: base, h, color: k.color }];
      });
      const parts = c.rows.map((r) => `${judge0KindLabel(r.kind)}: ${r.stats.runs} futás, p95 ${fmtMs(r.stats.p95Ms)}`);
      return { key: c.key, x: PAD_LEFT + i * step + (step - width) / 2, width, label: c.label, title: [c.key, ...parts].join(' · '), segments };
    });
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
