import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import {
  ProjectAdminCosts,
  ProjectAdminFunnel,
  ProjectAdminOverview,
  RUNTIME_LABELS,
} from '../../models/projektmuhely.model';
import { sourceColor, sourceLabel } from '../../models/ai-spending.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

type Tab = 'attekintes' | 'tolcser' | 'koltseg';

const CHART_WIDTH = 860;
const CHART_HEIGHT = 200;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

/**
 * Projektműhely (PATRICKS-PROJEKTMUHELY-2-TERV.md, A fázis): haladás projektenként, a tölcsér (hol akadnak el a
 * diákok), és a költség - AI (OpenRouter, USD) és Judge0-futtatások (saját gép: darab és CPU-idő).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-projektmuhely',
  standalone: true,
  imports: [DecimalPipe, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Projektműhely</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        Ki hol tart a projektekben, melyik lépésnél akadnak el, és mennyibe kerül egy aktív diák (AI + Judge0).
      </p>
      <div class="hairline"></div>

      <div class="flex items-end justify-between gap-4 flex-wrap border-b border-border-default mb-6">
        <nav class="flex gap-5 overflow-x-auto" role="tablist">
          @for (tab of tabs; track tab.id) {
            <button type="button" role="tab" [attr.aria-selected]="activeTab() === tab.id" class="tab-btn whitespace-nowrap"
              [class.tab-btn-active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">{{ tab.label }}</button>
          }
        </nav>
        @if (activeTab() !== 'tolcser') {
          <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5 mb-2" role="group" aria-label="Időszak">
            @for (d of dayOptions; track d) {
              <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="days() === d"
                [class.text-white]="days() === d" [class.text-text-muted]="days() !== d" [attr.aria-pressed]="days() === d"
                (click)="setDays(d)">{{ d }} nap</button>
            }
          </div>
        }
      </div>

      @if (error()) {
        <p class="text-danger text-sm mb-4">{{ error() }}</p>
      }
      @if (loading()) {
        <app-local-spinner />
      } @else {
        @switch (activeTab()) {
          @case ('attekintes') {
            @if (overview(); as ov) {
              <div class="card p-5 mb-6">
                <h2 class="font-bold">Projektek</h2>
                <div class="overflow-x-auto mt-3">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-text-muted">
                        <th class="py-2 pr-3">Projekt</th><th class="pr-3 text-right">Elkezdte</th><th class="pr-3 text-right">Befejezte</th>
                        <th class="pr-3 text-right">Aktív (7 / 30 nap)</th><th class="pr-3">Nyelvek</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of ov.projects; track p.slug) {
                        <tr class="border-t border-border-default">
                          <td class="py-2 pr-3 font-semibold">{{ p.title }} @if (!p.isPublished) { <span class="text-xs text-text-muted">(nem publikált)</span> }</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.started }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.completed }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.active7 }} / {{ p.active30 }}</td>
                          <td class="pr-3 text-xs text-text-muted">{{ runtimes(p.byRuntime) }}</td>
                          <td class="text-right"><button type="button" class="text-xs font-bold text-primary" (click)="openFunnel(p.slug)">Tölcsér →</button></td>
                        </tr>
                      } @empty {
                        <tr><td colspan="6" class="py-3 text-text-muted">Még nincs projekt.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card p-5">
                <h2 class="font-bold">Napi futtatások</h2>
                <p class="text-xs text-text-muted mt-0.5">Ellenőrzések és hibrid (C#/Java) előnézet-kérések a Judge0-n; az oszlopra mutatva az AI-költés is.</p>
                <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" class="w-full h-auto block mt-3" role="img"
                  aria-label="Napi Judge0-futtatások: Ellenőrzés és előnézet">
                  @for (tick of yTicks(); track tick.y) {
                    <line [attr.x1]="padLeft" [attr.x2]="chartWidth - padRight" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--color-border-default)" stroke-width="1" />
                    <text [attr.x]="padLeft - 6" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--color-text-muted)">{{ tick.label }}</text>
                  }
                  @for (bar of bars(); track bar.date) {
                    <rect [attr.x]="bar.x" [attr.y]="bar.checksY" [attr.width]="bar.width" [attr.height]="bar.checksH" fill="var(--series-grading)" rx="2" />
                    <rect [attr.x]="bar.x" [attr.y]="bar.previewsY" [attr.width]="bar.width" [attr.height]="bar.previewsH" fill="var(--series-classtest)" rx="2" />
                    <rect [attr.x]="bar.x" [attr.y]="padTop" [attr.width]="bar.width" [attr.height]="chartHeight - padTop - padBottom" fill="transparent">
                      <title>{{ bar.label }} · Ellenőrzés: {{ bar.checks }} · előnézet: {{ bar.previews }} · AI: {{ bar.aiRequests }} kérés, {{ fmtUsd(bar.aiCostUsd) }}</title>
                    </rect>
                  }
                </svg>
                <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-default text-xs text-text-muted">
                  <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm inline-block" style="background: var(--series-grading)"></span>
                    Ellenőrzés <strong class="text-text-primary">{{ totals().checks }}</strong></span>
                  <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm inline-block" style="background: var(--series-classtest)"></span>
                    Előnézet (C#/Java) <strong class="text-text-primary">{{ totals().previews }}</strong></span>
                  <span>AI: <strong class="text-text-primary">{{ totals().aiRequests }}</strong> kérés, <strong class="text-text-primary">{{ fmtUsd(totals().aiCostUsd) }}</strong></span>
                </div>
              </div>
            }
          }

          @case ('tolcser') {
            <div class="flex items-center gap-3 mb-4">
              <label class="text-sm font-semibold" for="pm-funnel-project">Projekt</label>
              <select id="pm-funnel-project" class="input max-w-xs" [value]="funnelSlug()" (change)="openFunnel($any($event.target).value)">
                @for (p of overview()?.projects ?? []; track p.slug) { <option [value]="p.slug">{{ p.title }}</option> }
              </select>
            </div>
            @if (funnel(); as f) {
              <div class="card p-5">
                <h2 class="font-bold">{{ f.title }} – {{ f.started }} diák kezdte el</h2>
                <p class="text-xs text-text-muted mt-0.5">A sáv: a lépést teljesítők aránya az elkezdőkhöz képest. A legnagyobb lemorzsolódás kiemelve – ott érdemes a tartalmon javítani.</p>
                <div class="overflow-x-auto mt-3">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-text-muted">
                        <th class="py-2 pr-3">Lépés</th><th class="pr-3 w-1/4">Teljesítette</th><th class="pr-3 text-right">Eljutott</th>
                        <th class="pr-3 text-right">Ellenőrzés / fő</th><th class="pr-3 text-right">Tipp · hely · kód</th><th class="pr-3 text-right">Medián idő</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of f.milestones; track m.orderNo) {
                        <tr class="border-t border-border-default" [class.bg-bg-element]="m.orderNo === worstDrop()">
                          <td class="py-2 pr-3"><span class="text-text-muted tabular-nums">{{ m.orderNo }}.</span> {{ m.title }}
                            @if (m.orderNo === worstDrop()) { <span class="ml-1 text-xs font-bold text-warning">legnagyobb lemorzsolódás</span> }</td>
                          <td class="pr-3">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-bg-elevated overflow-hidden">
                                <div class="h-full bg-primary" [style.width.%]="percent(m.passed, f.started)"></div>
                              </div>
                              <span class="tabular-nums text-xs w-14 text-right">{{ m.passed }} ({{ percent(m.passed, f.started) | number: '1.0-0' }}%)</span>
                            </div>
                          </td>
                          <td class="pr-3 text-right tabular-nums">{{ m.reached }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ m.avgChecks | number: '1.0-1' }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ m.hint1 }} · {{ m.hint2 }} · {{ m.hint3 }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ fmtMinutes(m.medianMinutesToPass) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            } @else {
              <p class="text-sm text-text-muted">Válassz projektet.</p>
            }
          }

          @case ('koltseg') {
            @if (costs(); as c) {
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div class="card p-4"><p class="text-xs text-text-muted font-semibold">AI-költés ({{ c.days }} nap)</p>
                  <p class="text-2xl font-extrabold mt-1">{{ fmtUsd(c.totalAiUsd) }}</p></div>
                <div class="card p-4"><p class="text-xs text-text-muted font-semibold">Ellenőrzések</p>
                  <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ c.checks }}</p></div>
                <div class="card p-4"><p class="text-xs text-text-muted font-semibold">Előnézet-futtatások (C#/Java)</p>
                  <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ c.previews }}</p></div>
                <div class="card p-4"><p class="text-xs text-text-muted font-semibold">Judge0 CPU-idő</p>
                  <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ fmtSeconds(c.judge0CpuSeconds) }}</p></div>
              </div>

              <div class="card p-5 mb-6">
                <h2 class="font-bold">AI forrásonként</h2>
                <ul class="mt-3 flex flex-col gap-2">
                  @for (s of c.bySource; track s.source) {
                    <li class="flex items-center gap-3 text-sm">
                      <span class="w-2.5 h-2.5 rounded-sm inline-block" [style.background]="color(s.source)"></span>
                      <span class="flex-1">{{ label(s.source) }}</span>
                      <span class="tabular-nums text-text-muted">{{ s.requests }} kérés</span>
                      <strong class="tabular-nums w-20 text-right">{{ fmtUsd(s.costUsd) }}</strong>
                    </li>
                  }
                </ul>
                @if (c.unattributedAiUsd > 0) {
                  <p class="text-xs text-text-muted mt-3">Ebből {{ fmtUsd(c.unattributedAiUsd) }} projekthez nem köthető (a hozzárendelés bevezetése előtti kérések).</p>
                }
              </div>

              <div class="card p-5">
                <h2 class="font-bold">Projektenként</h2>
                <p class="text-xs text-text-muted mt-0.5">Aktív diák: aki az időszakban dolgozott a projekten. A Judge0 saját gépen fut – annak nincs pénzbeli költsége, csak terhelése.</p>
                <div class="overflow-x-auto mt-3">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-text-muted">
                        <th class="py-2 pr-3">Projekt</th><th class="pr-3 text-right">Aktív diák</th><th class="pr-3 text-right">AI-kérés</th>
                        <th class="pr-3 text-right">AI-költés</th><th class="pr-3 text-right">AI / aktív diák</th>
                        <th class="pr-3 text-right">Ellenőrzés</th><th class="pr-3 text-right">Előnézet</th><th class="pr-3 text-right">CPU-idő</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of c.byProject; track p.slug) {
                        <tr class="border-t border-border-default">
                          <td class="py-2 pr-3 font-semibold">{{ p.title }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.activeStudents }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.aiRequests }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ fmtUsd(p.aiCostUsd) }}</td>
                          <td class="pr-3 text-right tabular-nums font-bold">{{ fmtUsd(p.aiCostPerActiveStudentUsd) }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.checks }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ p.previews }}</td>
                          <td class="pr-3 text-right tabular-nums">{{ fmtSeconds(p.judge0CpuSeconds) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
        }
      }
    </div>
  `,
})
export class AdminProjektmuhelyComponent implements OnInit {
  private readonly api = inject(AdminProjektmuhelyService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'attekintes', label: 'Áttekintés' },
    { id: 'tolcser', label: 'Tölcsér' },
    { id: 'koltseg', label: 'Költség' },
  ];
  readonly dayOptions = [7, 30, 90];
  readonly chartWidth = CHART_WIDTH;
  readonly chartHeight = CHART_HEIGHT;
  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;
  readonly padTop = PAD_TOP;
  readonly padBottom = PAD_BOTTOM;

  readonly activeTab = signal<Tab>('attekintes');
  readonly days = signal(30);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<ProjectAdminOverview | null>(null);
  readonly costs = signal<ProjectAdminCosts | null>(null);
  readonly funnel = signal<ProjectAdminFunnel | null>(null);
  readonly funnelSlug = signal('');

  readonly totals = computed(() =>
    (this.overview()?.daily ?? []).reduce(
      (t, d) => ({ checks: t.checks + d.checks, previews: t.previews + d.previews, aiRequests: t.aiRequests + d.aiRequests, aiCostUsd: t.aiCostUsd + d.aiCostUsd }),
      { checks: 0, previews: 0, aiRequests: 0, aiCostUsd: 0 },
    ),
  );

  private readonly maxRuns = computed(() => Math.max(4, ...(this.overview()?.daily ?? []).map((d) => d.checks + d.previews)));

  readonly yTicks = computed(() => {
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const max = this.maxRuns();
    return [0, 1, 2, 3, 4].map((i) => ({ y: PAD_TOP + plotH - (i / 4) * plotH, label: String(Math.round((max / 4) * i)) }));
  });

  readonly bars = computed(() => {
    const daily = this.overview()?.daily ?? [];
    const plotW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = plotW / Math.max(1, daily.length);
    const width = Math.max(2, Math.min(18, step * 0.7));
    const max = this.maxRuns();
    return daily.map((d, i) => {
      const checksH = (d.checks / max) * plotH;
      const previewsH = (d.previews / max) * plotH;
      const base = PAD_TOP + plotH;
      return {
        ...d,
        x: PAD_LEFT + i * step + (step - width) / 2,
        width,
        checksY: base - checksH,
        checksH,
        previewsY: base - checksH - previewsH,
        previewsH,
        label: new Date(d.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
      };
    });
  });

  /** A tölcsérben a legnagyobb esés (az előző teljesítőkhöz képest) lépése. */
  readonly worstDrop = computed(() => {
    const f = this.funnel();
    if (!f || f.started === 0) return null;
    let worst: { orderNo: number; drop: number } | null = null;
    let previous = f.started;
    for (const m of f.milestones) {
      const drop = previous - m.passed;
      if (drop > 0 && (!worst || drop > worst.drop)) worst = { orderNo: m.orderNo, drop };
      previous = m.passed;
    }
    return worst?.orderNo ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async setDays(days: number): Promise<void> {
    this.days.set(days);
    await this.load();
  }

  async openFunnel(slug: string): Promise<void> {
    this.activeTab.set('tolcser');
    this.funnelSlug.set(slug);
    this.error.set(null);
    try {
      this.funnel.set(await firstValueFrom(this.api.getFunnel(slug)));
    } catch {
      this.error.set('A tölcsért nem sikerült betölteni.');
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [overview, costs] = await Promise.all([
        firstValueFrom(this.api.getOverview(this.days())),
        firstValueFrom(this.api.getCosts(this.days())),
      ]);
      this.overview.set(overview);
      this.costs.set(costs);
      const first = overview.projects[0]?.slug;
      if (!this.funnelSlug() && first) {
        this.funnelSlug.set(first);
        this.funnel.set(await firstValueFrom(this.api.getFunnel(first)));
      }
    } catch {
      this.error.set('A Projektműhely adatait nem sikerült betölteni.');
    } finally {
      this.loading.set(false);
    }
  }

  runtimes(byRuntime: Record<string, number>): string {
    return Object.entries(byRuntime).map(([k, v]) => `${RUNTIME_LABELS[k] ?? k} ${v}`).join(' · ') || '–';
  }

  percent(part: number, whole: number): number {
    return whole === 0 ? 0 : (part / whole) * 100;
  }

  label = sourceLabel;
  color = sourceColor;

  fmtUsd(v: number): string {
    return '$' + v.toFixed(v < 1 ? 3 : 2);
  }

  fmtSeconds(s: number): string {
    return s < 120 ? `${s.toFixed(0)} mp` : `${(s / 60).toFixed(1)} perc`;
  }

  fmtMinutes(m: number | null): string {
    if (m === null) return '–';
    return m < 90 ? `${Math.round(m)} perc` : m < 60 * 48 ? `${(m / 60).toFixed(1)} óra` : `${(m / 1440).toFixed(1)} nap`;
  }
}
