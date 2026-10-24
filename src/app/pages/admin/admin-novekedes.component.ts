import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { GrowthCohort } from '../../models/growth.model';
import { ratio } from '../../shared/format/number-utils';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { latestValue } from '../../shared/resource/latest-value';
import { TabBarComponent, TabItem } from '../../shared/tab-bar/tab-bar.component';
import { AdminNovekedesAjanloComponent } from './novekedes/novekedes-ajanlo.component';
import { AdminNovekedesBevetelComponent } from './novekedes/novekedes-bevetel.component';
import { AdminNovekedesEgysegComponent } from './novekedes/novekedes-egyseg.component';
import { AdminNovekedesProbaComponent } from './novekedes/novekedes-proba.component';

export type GrowthTab = 'kohorszok' | 'bevetel' | 'proba' | 'egyseg' | 'ajanlo';

/**
 * Növekedés (PATRICKS-EREDMENYEK-ES-NOVEKEDES-TERV.md, 3.): heti regisztrációs kohorszok → aktiválódás (munka az első 7
 * napban) → fizetés → megmaradás (aktív volt-e az 1./4./8. héten), és hogy a lemondók miért mondanak le. Tesztfiókok nélkül.
 * A további fülek a tulajdonosi irányítópult: bevétel, próba → fizetés, egységgazdaság, ajánlóprogram (novekedes/; mindegyik a
 * megnyitásakor tölt). A kohorsz-adat az oldalon él, így fülváltáskor megmarad.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes',
  imports: [
    DatePipe, PercentPipe, LocalSpinnerComponent, TabBarComponent,
    AdminNovekedesBevetelComponent, AdminNovekedesProbaComponent, AdminNovekedesEgysegComponent, AdminNovekedesAjanloComponent,
  ],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Növekedés</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        Hány új diák jön, hányan kezdenek el ténylegesen dolgozni, hányan fizetnek, ki marad meg – és miért mondanak le; mennyi a bevétel,
        mennyibe kerül az MI, és hogyan működik az ajánlóprogram.
      </p>
      <div class="hairline"></div>

      <nav app-tab-bar class="flex gap-5 overflow-x-auto border-b border-border-default mb-6" role="tablist" data-testid="growth-tabs"
        [tabs]="tabs" [(active)]="tab"></nav>

      @switch (tab()) {
        @case ('bevetel') { <app-admin-novekedes-bevetel /> }
        @case ('proba') { <app-admin-novekedes-proba /> }
        @case ('egyseg') { <app-admin-novekedes-egyseg /> }
        @case ('ajanlo') { <app-admin-novekedes-ajanlo /> }
        @default {
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
        }
      }
    </div>
  `,
})
export class AdminNovekedesComponent {
  private readonly api = inject(AdminGrowthService);

  readonly tabs: readonly TabItem<GrowthTab>[] = [
    { id: 'kohorszok', label: 'Kohorszok' },
    { id: 'bevetel', label: 'Bevétel' },
    { id: 'proba', label: 'Próba → fizetés' },
    { id: 'egyseg', label: 'Egységgazdaság' },
    { id: 'ajanlo', label: 'Ajánlóprogram' },
  ];
  readonly tab = signal<GrowthTab>('kohorszok');
  readonly weekOptions = [12, 26];
  readonly weeks = signal(12);

  /** Egyszer, az oldal megnyitásakor. */
  private readonly summary = rxResource({
    stream: () => forkJoin({ overview: this.api.getOverview(), cancellations: this.api.getCancellations(90) }),
  });
  /** A kulcs a hetek száma; hét-váltás közben és hiba után a korábbi táblázat marad. */
  private readonly cohortsResource = rxResource({ params: () => this.weeks(), stream: ({ params: weeks }) => this.api.getCohorts(weeks) });
  private readonly latestCohorts = latestValue(this.cohortsResource);

  /** A tartalom csak akkor látszik, ha az összesítő és a kohorszok is megjöttek (mint a régi közös betöltésnél). */
  private readonly ready = computed(() => this.summary.hasValue() && this.latestCohorts() !== undefined);
  readonly overview = computed(() => (this.ready() ? this.summary.value()?.overview ?? null : null));
  readonly cancellations = computed(() => (this.ready() ? this.summary.value()?.cancellations ?? null : null));
  readonly cohorts = computed(() => this.latestCohorts() ?? []);
  /** Az első betöltés bármely hibája az egész fület hibának mutatja; a későbbi hét-váltásé csak a kohorszokat. */
  readonly error = computed(() => {
    const cohortsFailed = this.cohortsResource.error() !== undefined;
    if (this.summary.error() !== undefined || (cohortsFailed && this.latestCohorts() === undefined)) return 'A növekedési adatok betöltése nem sikerült.';
    return cohortsFailed ? 'A kohorszok betöltése nem sikerült.' : null;
  });
  readonly loading = computed(() => !this.ready() && this.error() === null);

  private readonly maxReason = computed(() => Math.max(1, ...(this.cancellations()?.reasons ?? []).map((r) => r.count)));

  readonly ratioOf = ratio;

  /** Az aktív hét újrakattintása is újratölt (mint eddig). */
  setWeeks(weeks: number): void {
    if (weeks === this.weeks()) this.cohortsResource.reload();
    else this.weeks.set(weeks);
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
