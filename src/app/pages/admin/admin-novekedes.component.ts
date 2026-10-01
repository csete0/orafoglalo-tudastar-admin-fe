import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { GrowthCancellations, GrowthCohort, GrowthOverview } from '../../models/growth.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

/** Arány (0–1), ha van nevező; különben null. */
export function ratio(part: number | null, whole: number): number | null {
  return part === null || whole === 0 ? null : part / whole;
}

/**
 * Növekedés (PATRICKS-EREDMENYEK-ES-NOVEKEDES-TERV.md, 3.): heti regisztrációs kohorszok → aktiválódás (munka az első 7
 * napban) → fizetés → megmaradás (aktív volt-e az 1./4./8. héten), és hogy a lemondók miért mondanak le. Tesztfiókok nélkül.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes',
  standalone: true,
  imports: [DatePipe, DecimalPipe, PercentPipe, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Növekedés</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        Hány új diák jön, hányan kezdenek el ténylegesen dolgozni, hányan fizetnek, ki marad meg – és miért mondanak le.
      </p>
      <div class="hairline"></div>

      @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
      @if (loading()) {
        <app-local-spinner />
      } @else if (overview(); as o) {
        <div class="grid gap-3 grid-cols-2 md:grid-cols-5 mb-6" data-testid="growth-kpis">
          <div class="card p-4"><p class="text-xs text-text-muted">Regisztráció (30 nap)</p><p class="text-2xl font-bold tabular-nums">{{ o.registrations30 }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Aktiválódás (7 napon belül)</p>
            <p class="text-2xl font-bold tabular-nums">{{ o.activationRate === null ? '–' : (o.activationRate | percent: '1.0-0') }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Új fizető (30 nap)</p><p class="text-2xl font-bold tabular-nums">{{ o.newPayers30 }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Most fizető</p><p class="text-2xl font-bold tabular-nums">{{ o.activePayers }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Lemondás (30 nap)</p>
            <p class="text-2xl font-bold tabular-nums">{{ o.cancellations30 }}
              @if (o.cancellationRate30 !== null) { <span class="text-sm text-text-muted font-semibold">({{ o.cancellationRate30 | percent: '1.0-0' }})</span> }</p></div>
        </div>

        <div class="card p-5 mb-6">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 class="font-bold">Heti kohorszok</h2>
              <p class="text-xs text-text-muted mt-0.5">A regisztráció hete szerint. Aktiválódott: feladatsort, kvízt vagy projektet indított az első 7 napban.
                Megmaradt: abban a héten is dolgozott. A cella színe az arányt mutatja.</p>
            </div>
            <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5" role="group" aria-label="Hetek">
              @for (w of weekOptions; track w) {
                <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="weeks() === w" [class.text-white]="weeks() === w"
                  [class.text-text-muted]="weeks() !== w" [attr.aria-pressed]="weeks() === w" (click)="setWeeks(w)">{{ w }} hét</button>
              }
            </div>
          </div>
          <div class="overflow-x-auto mt-3">
            <table class="w-full text-sm" data-testid="growth-cohorts">
              <thead>
                <tr class="text-left text-xs text-text-muted">
                  <th class="py-2 pr-3">Hét</th><th class="pr-3 text-right">Regisztrált</th><th class="pr-3 text-right">Aktiválódott</th>
                  <th class="pr-3 text-right">Fizetett</th><th class="pr-3 text-right">1. hét</th><th class="pr-3 text-right">4. hét</th><th class="text-right">8. hét</th>
                </tr>
              </thead>
              <tbody>
                @for (c of cohorts(); track c.weekStart) {
                  <tr class="border-t border-border-default">
                    <td class="py-1.5 pr-3 whitespace-nowrap">{{ c.weekStart | date: 'yyyy.MM.dd.' }}</td>
                    <td class="pr-3 text-right tabular-nums">{{ c.registered }}</td>
                    @for (v of cells(c); track $index) {
                      <td class="pr-3 text-right tabular-nums" [style.background]="heat(v, c.registered)">
                        @if (v === null) { <span class="text-text-muted">–</span> } @else {
                          {{ v }} @if (c.registered) { <span class="text-xs text-text-muted">({{ ratioOf(v, c.registered) | percent: '1.0-0' }})</span> }
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="py-3 text-text-muted">Ebben az időszakban nem volt regisztráció.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (cancellations(); as x) {
          <div class="card p-5">
            <h2 class="font-bold">Miért mondanak le? <span class="text-xs text-text-muted font-normal">(utolsó {{ x.days }} nap)</span></h2>
            <p class="text-xs text-text-muted mt-0.5">{{ x.total }} fizetős lemondás, ebből {{ x.withReason }} adott okot (nem kötelező).</p>
            <div class="mt-3 space-y-1.5" data-testid="growth-reasons">
              @for (r of x.reasons; track r.key) {
                <div class="grid grid-cols-[14rem_1fr_3rem] items-center gap-3 text-sm">
                  <span>{{ r.label }}</span>
                  <span class="h-2 rounded-full bg-bg-element overflow-hidden"><span class="block h-full bg-primary" [style.width.%]="reasonWidth(r.count)"></span></span>
                  <span class="text-right tabular-nums">{{ r.count }}</span>
                </div>
              }
            </div>
            @if (x.recent.length) {
              <h3 class="font-bold text-sm mt-5">Legutóbbi megjegyzések</h3>
              <ul class="mt-2 space-y-2 text-sm">
                @for (c of x.recent; track $index) {
                  <li class="border-l-2 border-border-default pl-3"><span class="text-xs text-text-muted">{{ c.createdAt | date: 'yyyy.MM.dd.' }} · {{ c.reason }}</span><br />{{ c.comment }}</li>
                }
              </ul>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AdminNovekedesComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);

  readonly weekOptions = [12, 26];
  readonly weeks = signal(12);
  readonly overview = signal<GrowthOverview | null>(null);
  readonly cohorts = signal<GrowthCohort[]>([]);
  readonly cancellations = signal<GrowthCancellations | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly maxReason = computed(() => Math.max(1, ...(this.cancellations()?.reasons ?? []).map((r) => r.count)));

  readonly ratioOf = ratio;

  ngOnInit(): void {
    forkJoin({ overview: this.api.getOverview(), cohorts: this.api.getCohorts(this.weeks()), cancellations: this.api.getCancellations(90) }).subscribe({
      next: (r) => {
        this.overview.set(r.overview);
        this.cohorts.set(r.cohorts);
        this.cancellations.set(r.cancellations);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('A növekedési adatok betöltése nem sikerült.');
        this.loading.set(false);
      },
    });
  }

  setWeeks(weeks: number): void {
    this.weeks.set(weeks);
    this.api.getCohorts(weeks).subscribe({ next: (c) => this.cohorts.set(c), error: () => this.error.set('A kohorszok betöltése nem sikerült.') });
  }

  cells(c: GrowthCohort): (number | null)[] {
    return [c.activated, c.paid, c.retainedWeek1, c.retainedWeek4, c.retainedWeek8];
  }

  /** A cella háttere az arány szerint (a primary szín áttetszőségével), üres/jövőbeli cellánál semmi. */
  heat(value: number | null, registered: number): string | null {
    const r = ratio(value, registered);
    return r === null || r === 0 ? null : `color-mix(in srgb, var(--color-primary) ${Math.round(8 + r * 40)}%, transparent)`;
  }

  reasonWidth(count: number): number {
    return (count / this.maxReason()) * 100;
  }
}
