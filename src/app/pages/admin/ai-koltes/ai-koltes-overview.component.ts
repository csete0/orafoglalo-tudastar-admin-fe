import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AI_SOURCES, AiSpendingDayDto, sourceColor, sourceLabel } from '../../../models/ai-spending.model';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { UsdPipe } from '../../../shared/format/usd.pipe';
import { BytesPipe } from '../../../shared/format/bytes.pipe';
import { AiKoltesOverviewState } from './ai-koltes-overview.state';
import { AiKoltesDailyChartComponent } from './ai-koltes-daily-chart.component';

/**
 * AI-költés pult, Áttekintés fül: KPI-csempék + OpenRouter-egyenleg, napi diagram (7/30 nap), havi megoszlás, top költők,
 * teljes vizsga, dolgozat-pontozás. Az adat az `AiKoltesOverviewState`-ben (pult-szintű, fülváltáskor megmarad).
 * A gazda-elem `display: contents`, így a blokkok elrendezése ugyanaz, mintha közvetlenül a pult sablonjában lennének.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-overview',
  imports: [LocalSpinnerComponent, UsdPipe, BytesPipe, AiKoltesDailyChartComponent],
  styles: ':host { display: contents; }',
  template: `
    @if (state.overviewError()) {
      <p class="text-danger text-sm mb-4">{{ state.overviewError() }}</p>
    }
    @if (state.overviewLoading()) {
      <app-local-spinner />
    } @else if (state.overview(); as ov) {
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Ma összesen</p>
          <p class="text-2xl font-extrabold mt-1">{{ ov.todayTotalUsd | usd }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Ez a hónap</p>
          <p class="text-2xl font-extrabold mt-1">{{ ov.monthTotalUsd | usd }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Saját (admin) költésem</p>
          <p class="text-2xl font-extrabold mt-1">{{ ov.myOwnMonthUsd | usd }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Automatizmusok (e hónap)</p>
          <p class="text-2xl font-extrabold mt-1">{{ ov.automationMonthUsd | usd }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">OpenRouter egyenleg</p>
          @if (state.creditsError()) {
            <p class="text-xs text-danger mt-1">Nem sikerült lekérni.</p>
          } @else if (state.credits(); as c) {
            <p class="text-2xl font-extrabold mt-1">{{ c.remainingCredits | usd }}</p>
            <p class="text-xs text-text-muted mt-0.5">/ {{ c.totalCredits | usd }} feltöltve</p>
          } @else {
            <p class="text-2xl font-extrabold mt-1 text-text-muted">...</p>
          }
        </div>
      </div>

      <div class="card p-5 mb-6">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 class="font-bold">Napi költés, forrás szerint</h2>
            <p class="text-xs text-text-muted mt-0.5">OpenRouter-hívások becsült USD-értéke</p>
          </div>
          <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5">
            @for (d of rangeOptions; track d) {
              <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold"
                [class.bg-primary]="state.rangeDays() === d" [class.text-white]="state.rangeDays() === d"
                [class.text-text-muted]="state.rangeDays() !== d" (click)="state.rangeDays.set(d)">{{ d }} nap</button>
            }
          </div>
        </div>

        <svg app-ai-koltes-daily-chart [days]="visibleDays()" class="w-full h-auto block" role="img"
          aria-label="Napi AI-költés forrás szerinti bontásban, sávdiagram"></svg>

        <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-default">
          @for (s of sourceLegend(); track s.source) {
            <span class="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <span class="w-2 h-2 rounded-sm inline-block" [style.background]="s.color"></span>
              {{ s.label }} <strong class="text-text-primary">{{ s.totalUsd | usd }}</strong>
            </span>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="card p-4">
          <h2 class="font-bold mb-3">Havi megoszlás forrás szerint</h2>
          @for (s of ov.monthTotalsBySource; track s.source) {
            <div class="mb-2.5">
              <div class="flex justify-between text-xs mb-1">
                <span>{{ sourceLabel(s.source) }}</span>
                <strong>{{ s.totalUsd | usd }}</strong>
              </div>
              <div class="h-2 rounded-full bg-bg-element overflow-hidden">
                <div class="h-full rounded-full" [style.background]="sourceColor(s.source)"
                  [style.width.%]="monthBarPercent(s.totalUsd, ov.monthTotalsBySource)"></div>
              </div>
            </div>
          } @empty {
            <p class="text-xs text-text-muted">Nincs adat ebben a hónapban.</p>
          }
        </div>

        <div class="card p-4">
          <h2 class="font-bold mb-1">Legtöbbet költő felhasználók</h2>
          <p class="text-xs text-text-muted mb-3">utolsó 30 nap</p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-text-muted uppercase">
                <th class="text-left font-bold pb-2">Felhasználó</th>
                <th class="text-right font-bold pb-2">Kérés</th>
                <th class="text-right font-bold pb-2">Költés</th>
              </tr>
            </thead>
            <tbody>
              @for (u of state.topSpenders(); track u.userId) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 truncate max-w-[10rem]">{{ u.userName }}</td>
                  <td class="py-1.5 text-right tabular-nums">{{ u.requestCount }}</td>
                  <td class="py-1.5 text-right tabular-nums font-semibold">{{ u.totalUsd | usd }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="py-3 text-center text-text-muted text-xs">Nincs adat.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (state.fullExam(); as fe) {
        <div class="card p-4 mt-4" data-testid="full-exam-usage">
          <h2 class="font-bold mb-1">Teljes vizsga értékelése</h2>
          <p class="text-xs text-text-muted mb-3">
            irodai/weblap feladatok MI-pontozása - a rendszer állja, a diák havi darabkerete (ingyenes 1 / standard 4 / prémium 10) számít
          </p>
          @if (fe.dailyAlert) {
            <p class="text-sm text-danger font-semibold mb-2" role="alert">
              A mai irodai MI-pontozás elérte a riasztási küszöböt ({{ fe.dailyAlertUsd | usd }}).
            </p>
          }
          <div class="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <div class="text-xs text-text-muted uppercase">E hónapban</div>
              <div class="font-semibold tabular-nums">{{ fe.gradedExamsThisMonth }} vizsga · {{ fe.studentsThisMonth }} diák</div>
            </div>
            <div>
              <div class="text-xs text-text-muted uppercase">Költés ma / 30 nap</div>
              <div class="font-semibold tabular-nums">
                {{ fe.examCostTodayUsd | usd }} vizsga + {{ fe.practiceCostTodayUsd | usd }} gyakorlás / {{ fe.last30DaysCostUsd | usd }}
              </div>
            </div>
            <div>
              <div class="text-xs text-text-muted uppercase">Feltöltések tárhelye</div>
              <div class="font-semibold tabular-nums">{{ fe.storageBytes | bytes: 'MB' }} MB · {{ fe.storageFiles }} fájl</div>
              <div class="text-xs text-text-muted">+{{ fe.storageLast30DaysBytes | bytes: 'MB' }} MB az elmúlt 30 napban</div>
            </div>
          </div>
        </div>
      }

      <div class="card p-4 mt-4" data-testid="class-test-usage">
        <h2 class="font-bold mb-1">Dolgozat-pontozás tanáronként</h2>
        <p class="text-xs text-text-muted mb-3">
          ebben a hónapban beadott dolgozatok a tanári havi keretből - a költést a rendszer állja, a „Dolgozat AI-pontozás” sávban látszik
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-text-muted uppercase">
                <th class="text-left font-bold pb-2">Tanár</th>
                <th class="text-left font-bold pb-2">Iskola</th>
                <th class="text-right font-bold pb-2">Havi keret</th>
              </tr>
            </thead>
            <tbody>
              @for (t of state.classTestUsage(); track t.teacherUserId) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5">
                    {{ t.teacherName }}
                    <span class="block text-xs text-text-muted">{{ t.email }}</span>
                  </td>
                  <td class="py-1.5 text-text-muted">{{ t.institutionName || '–' }}</td>
                  <td class="py-1.5 text-right tabular-nums font-semibold"
                    [class.text-danger]="t.gradedThisMonth >= t.monthlyLimit">
                    {{ t.gradedThisMonth }} / {{ t.monthlyLimit }}
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="py-3 text-center text-text-muted text-xs">Ebben a hónapban még nem volt beadott dolgozat.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class AiKoltesOverviewComponent {
  protected readonly state = inject(AiKoltesOverviewState);

  protected readonly rangeOptions = [30, 7] as const;
  protected readonly sourceLabel = sourceLabel;
  protected readonly sourceColor = sourceColor;

  readonly visibleDays = computed<AiSpendingDayDto[]>(() => {
    const days = this.state.overview()?.dailyBySource ?? [];
    return days.slice(Math.max(0, days.length - this.state.rangeDays()));
  });

  readonly sourceLegend = computed(() => {
    const days = this.visibleDays();
    return AI_SOURCES.map((s) => ({
      source: s.key,
      label: s.label,
      color: s.color,
      totalUsd: days.reduce((sum, d) => sum + (d.bySource[s.key] ?? 0), 0),
    })).filter((s) => s.totalUsd > 0.0001);
  });

  protected monthBarPercent(value: number, all: { totalUsd: number }[]): number {
    const max = Math.max(0.0001, ...all.map((a) => a.totalUsd));
    return (value / max) * 100;
  }
}
