import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminPracticeGradesStore } from '../../services/admin/admin-practice-grades.store';
import { PRACTICE_KIND_LABELS, PRACTICE_TIER_LABELS, PracticeGradeBucket } from '../../models/practice-grades.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

/** Dollár-összeg az AI-költés pult formájában ($0.012 / $1.25). */
export function fmtUsd(v: number): string {
  return '$' + v.toFixed(v < 1 ? 3 : 2);
}

/**
 * Gyakorló értékelések (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b): napi/havi darab és költség típusonként (kód/SQL/irodai)
 * és csomagonként, keret-kihasználtság (hány diák érte el a plafont), toplista a legtöbbet kérő fiókokról és a Failed arány.
 * A költséget a rendszer fizeti (tulajdonosi döntés, 2026-10-10), ezért kell rá külön figyelni.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-gyakorlo-ertekelesek',
  standalone: true,
  imports: [DatePipe, PercentPipe, RouterLink, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Gyakorló értékelések</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        A gyakorló módban kért MI-értékelések (kód, SQL, irodai/weblap) darabja és költsége, a keretek kihasználtsága és a
        legtöbbet kérő fiókok. Vizsgához kötött értékelés nincs benne.
      </p>
      <div class="hairline"></div>

      <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5 mb-5" role="group" aria-label="Időszak">
        @for (d of dayOptions; track d) {
          <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="store.days() === d" [class.text-white]="store.days() === d"
            [class.text-text-muted]="store.days() !== d" [attr.aria-pressed]="store.days() === d" (click)="store.load(d)">{{ d }} nap</button>
        }
      </div>

      @if (store.error()) { <p class="text-danger text-sm mb-4">{{ store.error() }}</p> }
      @if (store.loading() && !store.overview()) {
        <app-local-spinner />
      } @else if (store.overview(); as o) {
        <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6" data-testid="practice-kpis">
          <div class="card p-4"><p class="text-xs text-text-muted">Értékelés ({{ o.days }} nap)</p><p class="text-2xl font-bold tabular-nums">{{ o.totalCount }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Költség ({{ o.days }} nap)</p><p class="text-2xl font-bold tabular-nums">{{ usd(o.totalCostUsd) }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Hibás (Failed)</p>
            <p class="text-2xl font-bold tabular-nums" [class.text-danger]="(store.failedRate() ?? 0) >= failedAlert" data-testid="practice-failed-rate">
              {{ store.failedRate() === null ? '–' : (store.failedRate() | percent: '1.0-1') }}
              <span class="text-sm text-text-muted font-semibold">({{ o.failedCount }})</span></p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Plafonon ma (diák)</p><p class="text-2xl font-bold tabular-nums">{{ atLimitToday() }}</p></div>
        </div>

        <div class="grid gap-6 md:grid-cols-2 mb-6">
          @for (table of bucketTables(); track table.title) {
            <div class="card p-5">
              <h2 class="font-bold">{{ table.title }}</h2>
              <div class="overflow-x-auto mt-3">
                <table class="w-full text-sm" [attr.data-testid]="table.testId">
                  <thead>
                    <tr class="text-left text-xs text-text-muted">
                      <th class="py-2 pr-3"></th><th class="pr-3 text-right">Ma</th><th class="pr-3 text-right">Ma $</th>
                      <th class="pr-3 text-right">Hónap</th><th class="text-right">Hónap $</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of table.rows; track b.key) {
                      <tr class="border-t border-border-default">
                        <td class="py-1.5 pr-3">{{ table.labels[b.key] ?? b.key }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ b.today.count }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ usd(b.today.costUsd) }}</td>
                        <td class="pr-3 text-right tabular-nums">{{ b.month.count }}</td>
                        <td class="text-right tabular-nums">{{ usd(b.month.costUsd) }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="py-3 text-text-muted">Még nem volt gyakorló értékelés.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <div class="card p-5 mb-6">
          <h2 class="font-bold">Keret-kihasználtság</h2>
          <p class="text-xs text-text-muted mt-0.5">Hány diák kért értékelést, és közülük hány érte el a napi vagy havi plafont (a failed és a gyorsítótár-találat nem számít bele).</p>
          <div class="overflow-x-auto mt-3">
            <table class="w-full text-sm" data-testid="practice-quota">
              <thead>
                <tr class="text-left text-xs text-text-muted">
                  <th class="py-2 pr-3">Típus</th><th class="pr-3">Csomag</th><th class="pr-3 text-right">Keret (nap / hó)</th>
                  <th class="pr-3 text-right">Kért ma</th><th class="pr-3 text-right">Plafonon ma</th>
                  <th class="pr-3 text-right">Kért a hónapban</th><th class="text-right">Havi plafonon</th>
                </tr>
              </thead>
              <tbody>
                @for (q of o.quota; track q.kind + q.tier) {
                  <tr class="border-t border-border-default">
                    <td class="py-1.5 pr-3">{{ kindLabels[q.kind] ?? q.kind }}</td>
                    <td class="pr-3">{{ tierLabels[q.tier] ?? q.tier }}</td>
                    <td class="pr-3 text-right tabular-nums">{{ q.dailyLimit }} / {{ q.monthlyLimit ?? '–' }}</td>
                    <td class="pr-3 text-right tabular-nums">{{ q.activeToday }}</td>
                    <td class="pr-3 text-right tabular-nums" [class.text-danger]="q.atDailyLimitToday > 0">{{ q.atDailyLimitToday }}</td>
                    <td class="pr-3 text-right tabular-nums">{{ q.activeThisMonth }}</td>
                    <td class="text-right tabular-nums" [class.text-danger]="q.atMonthlyLimit > 0">{{ q.monthlyLimit === null ? '–' : q.atMonthlyLimit }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="card p-5">
            <h2 class="font-bold">Napi bontás</h2>
            <div class="mt-3 space-y-1" data-testid="practice-daily">
              @for (d of dailyDesc(); track d.date) {
                <div class="grid grid-cols-[6.5rem_1fr_7rem] items-center gap-3 text-sm">
                  <span class="tabular-nums">{{ d.date | date: 'yyyy.MM.dd.' }}</span>
                  <span class="h-2 rounded-full bg-bg-element overflow-hidden"><span class="block h-full bg-primary" [style.width.%]="dayWidth(d.count)"></span></span>
                  <span class="text-right tabular-nums">{{ d.count }}@if (d.failed) { <span class="text-danger"> ({{ d.failed }}✗)</span> } · {{ usd(d.costUsd) }}</span>
                </div>
              } @empty {
                <p class="text-sm text-text-muted">Nincs adat ebben az időszakban.</p>
              }
            </div>
          </div>

          <div class="card p-5">
            <h2 class="font-bold">Legtöbbet kérő fiókok <span class="text-xs text-text-muted font-normal">({{ o.days }} nap)</span></h2>
            <p class="text-xs text-text-muted mt-0.5">Visszaélés-figyelés: a keret 1 karakteres módosításokkal is leszívható.</p>
            <div class="overflow-x-auto mt-3">
              <table class="w-full text-sm" data-testid="practice-top">
                <thead>
                  <tr class="text-left text-xs text-text-muted">
                    <th class="py-2 pr-3">Fiók</th><th class="pr-3">Csomag</th><th class="pr-3 text-right">Db</th><th class="pr-3 text-right">Failed</th>
                    <th class="pr-3 text-right">$</th><th class="text-right">Utoljára</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of o.topUsers; track u.userId) {
                    <tr class="border-t border-border-default">
                      <td class="py-1.5 pr-3"><a [routerLink]="['/users', u.userId]" class="text-primary hover:underline">{{ u.name || u.email }}</a></td>
                      <td class="pr-3">{{ tierLabels[u.tier] ?? u.tier }}</td>
                      <td class="pr-3 text-right tabular-nums font-semibold">{{ u.count }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ u.failed }}</td>
                      <td class="pr-3 text-right tabular-nums">{{ usd(u.costUsd) }}</td>
                      <td class="text-right whitespace-nowrap">{{ u.lastAt | date: 'MM.dd. HH:mm' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="py-3 text-text-muted">Nincs adat ebben az időszakban.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminGyakorloErtekelesekComponent implements OnInit {
  readonly store = inject(AdminPracticeGradesStore);

  readonly dayOptions = [7, 30, 90];
  /** E fölött a Failed arány pirossal jelenik meg (MI- vagy Judge0-hiba gyanúja). */
  readonly failedAlert = 0.1;
  readonly kindLabels = PRACTICE_KIND_LABELS;
  readonly tierLabels = PRACTICE_TIER_LABELS;
  readonly usd = fmtUsd;

  readonly bucketTables = computed(() => {
    const o = this.store.overview();
    return [
      { title: 'Típusonként', testId: 'practice-by-kind', labels: this.kindLabels, rows: o?.byKind ?? ([] as PracticeGradeBucket[]) },
      { title: 'Csomagonként', testId: 'practice-by-tier', labels: this.tierLabels, rows: o?.byTier ?? ([] as PracticeGradeBucket[]) },
    ];
  });

  /** Hány diák érte el ma valamelyik napi plafont (típusonként összeadva). */
  readonly atLimitToday = computed(() => (this.store.overview()?.quota ?? []).reduce((s, q) => s + q.atDailyLimitToday, 0));

  /** A legfrissebb nap legfelül. */
  readonly dailyDesc = computed(() => [...(this.store.overview()?.daily ?? [])].sort((a, b) => b.date.localeCompare(a.date)));

  private readonly maxDay = computed(() => Math.max(1, ...(this.store.overview()?.daily ?? []).map((d) => d.count)));

  ngOnInit(): void {
    this.store.load();
  }

  dayWidth(count: number): number {
    return (count / this.maxDay()) * 100;
  }
}
