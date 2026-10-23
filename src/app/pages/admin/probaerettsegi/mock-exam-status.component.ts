import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { UtcPipe } from '../../../shared/utc/utc.pipe';
import { AdminMockExamStatus } from '../../../models/mock-exam.model';

const DAY_LABELS = ['1. nap', '2. nap', '3. nap', '4. nap', '5. nap', '6. nap', '7. nap'];

/**
 * Egy próbaérettségi élő státusza: kitöltés (KPI-k), MI-keret sáv 50/80%-kal és „Keret emelése”, a hét napjai
 * %-eloszlással, értékelési hibák. A gazda-elem `display: contents`, a blokkok közvetlenül a szülő elrendezésében állnak.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-mock-exam-status',
  imports: [DatePipe, DecimalPipe, UtcPipe],
  styles: ':host { display: contents; }',
  template: `
    @let s = status();
    <div class="grid gap-3 grid-cols-2 md:grid-cols-6 mb-4" data-testid="mock-kpis">
      <div class="card p-4"><p class="text-xs text-text-muted">Jelentkezett</p><p class="text-2xl font-bold tabular-nums">{{ s.registrations.kozep + s.registrations.emelt }}</p>
        <p class="text-xs text-text-muted">közép {{ s.registrations.kozep }} · emelt {{ s.registrations.emelt }}</p></div>
      <div class="card p-4"><p class="text-xs text-text-muted">Tanári</p><p class="text-2xl font-bold tabular-nums">{{ s.registrations.teacherSourced }}</p>
        <p class="text-xs text-text-muted">{{ s.registrations.groups }} csoport</p></div>
      <div class="card p-4"><p class="text-xs text-text-muted">Elkezdte</p><p class="text-2xl font-bold tabular-nums">{{ s.started }}</p>
        <p class="text-xs text-text-muted">most írja: {{ s.inProgress }}</p></div>
      <div class="card p-4"><p class="text-xs text-text-muted">Beadta</p><p class="text-2xl font-bold tabular-nums">{{ s.submitted }}</p>
        <p class="text-xs text-text-muted">elhagyta: {{ s.abandoned }}</p></div>
      <div class="card p-4"><p class="text-xs text-text-muted">Értékelve</p><p class="text-2xl font-bold tabular-nums">{{ s.graded }}</p>
        <p class="text-xs text-text-muted">vár: {{ s.pendingGrading }}</p></div>
      <div class="card p-4"><p class="text-xs text-text-muted">Jelvény</p><p class="text-2xl font-bold tabular-nums">{{ s.badgesAwarded.participant }}</p>
        <p class="text-xs text-text-muted">ezüst {{ s.badgesAwarded.silver }} · arany {{ s.badgesAwarded.gold }}</p></div>
    </div>

    <div class="card p-5 mb-4" data-testid="mock-budget">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <h3 class="font-bold">MI-keret
          @if (s.budgetAlerts.exhausted) { <span class="badge badge-danger ml-1">elfogyott</span> }
          @else if (s.budgetAlerts.at80) { <span class="badge badge-warning ml-1">80%</span> }
          @else if (s.budgetAlerts.at50) { <span class="badge badge-neutral ml-1">50%</span> }
        </h3>
        <button type="button" class="btn btn-primary" (click)="raiseBudget()" data-testid="mock-raise">Keret emelése</button>
      </div>
      <div class="relative h-3 rounded-full bg-bg-element mt-3" role="img"
           [attr.aria-label]="'Elköltve ' + s.costTotalUsd + ' $ / ' + s.totalBudgetUsd + ' $, vetítve ' + s.projectedTotalUsd + ' $'">
        <span class="absolute inset-y-0 left-0 rounded-full" [class.bg-danger]="s.budgetUsedPercent >= 80" [class.bg-primary]="s.budgetUsedPercent < 80"
              [style.width.%]="clamp(s.budgetUsedPercent)"></span>
        <span class="absolute -inset-y-1 w-0.5 bg-text-muted" style="left: 50%" title="50%"></span>
        <span class="absolute -inset-y-1 w-0.5 bg-warning" style="left: 80%" title="80%"></span>
        @if (s.totalBudgetUsd > 0) {
          <span class="absolute -inset-y-1.5 w-0.5 bg-text-primary" [style.left.%]="clamp(100 * s.projectedTotalUsd / s.totalBudgetUsd)" title="vetített összköltés"></span>
        }
      </div>
      <p class="text-sm mt-2 tabular-nums">
        <strong>{{ s.costTotalUsd | number: '1.2-2' }} $</strong> / {{ s.totalBudgetUsd | number: '1.0-2' }} $ ({{ s.budgetUsedPercent }}%) · ma {{ s.costTodayUsd | number: '1.2-2' }} $ ·
        vetítve {{ s.projectedTotalUsd | number: '1.0-2' }} $
      </p>
      @if (s.queuedForAi.count) {
        <p class="text-sm text-warning mt-1" data-testid="mock-queue">
          MI-re vár: {{ s.queuedForAi.count }} beadás (a legrégebbi {{ s.queuedForAi.oldestSubmittedAt | utc | date: 'MMM d. HH:mm' }}) - a kiürítéshez kb. {{ s.neededToClearQueueUsd | number: '1.0-2' }} $ kell.
        </p>
      }
      <p class="text-xs text-text-muted mt-1">Értékelő sor (Hangfire): {{ s.queueLength < 0 ? 'nem olvasható' : s.queueLength }}</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 mb-4">
      <div class="card p-5">
        <h3 class="font-bold mb-2">A hét napjai</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-text-muted"><th class="py-1">Nap</th><th class="text-right">Indult</th><th class="text-right">Beadva</th><th class="pl-3">%-eloszlás (0–100)</th></tr></thead>
          <tbody>
            @for (d of dayLabels; track $index; let i = $index) {
              <tr class="border-t border-border-default">
                <td class="py-1">{{ d }}</td><td class="text-right tabular-nums">{{ s.dailyStarts[i] }}</td><td class="text-right tabular-nums">{{ s.dailySubmits[i] }}</td>
                <td class="pl-3"><span class="inline-flex items-end gap-px h-5" [attr.aria-label]="'eloszlás: ' + s.dailyPercentHistogram[i].join(', ')">
                  @for (b of s.dailyPercentHistogram[i]; track $index) {
                    <span class="w-1.5 bg-primary rounded-t-sm" [style.height.%]="barHeight(b, s.dailyPercentHistogram[i])"></span>
                  }
                </span></td>
              </tr>
            }
          </tbody>
        </table>
        <p class="text-xs text-text-muted mt-2">Ha egy napon az eloszlás hirtelen felfelé tolódik, a feladatok kiszivároghattak.</p>
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-2">Értékelési hibák ({{ s.gradingErrors.length }})</h3>
        @for (e of s.gradingErrors; track $index) {
          <p class="text-sm border-t border-border-default py-1"><span class="text-text-muted">#{{ e.sessionId }}</span> {{ e.taskTitle }} – {{ e.error ?? 'ismeretlen hiba' }}</p>
        } @empty {
          <p class="text-sm text-text-muted">Nincs hiba.</p>
        }
      </div>
    </div>
  `,
})
export class MockExamStatusComponent {
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly status = input.required<AdminMockExamStatus>();
  /** Az új MI-összkeret (bekérve, ellenőrizve és megerősítve) - a hívás és az újratöltés a szülőé. */
  readonly budgetRaise = output<number>();

  readonly dayLabels = DAY_LABELS;

  async raiseBudget(): Promise<void> {
    const s = this.status();
    const suggested = Math.ceil(s.totalBudgetUsd + Math.max(s.neededToClearQueueUsd, s.totalBudgetUsd * 0.2));
    const input = window.prompt(`Új MI-összkeret ($) - most ${s.totalBudgetUsd} $, a sor kiürítéséhez kb. ${s.neededToClearQueueUsd} $ kell:`, String(suggested));
    if (input === null) return;
    const amount = Number(input.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= s.totalBudgetUsd) {
      this.toast.danger(`A keret csak emelhető (most ${s.totalBudgetUsd} $).`);
      return;
    }
    if (!(await this.confirm.ask({
      title: 'Emeled a keretet?', message: `${s.totalBudgetUsd} $ → ${amount} $. A várakozó beadások ezután azonnal értékelődnek.`, confirmLabel: 'Emelés',
    }))) return;
    this.budgetRaise.emit(amount);
  }

  clamp(percent: number): number {
    return Math.max(0, Math.min(100, percent));
  }

  barHeight(value: number, all: number[]): number {
    const max = Math.max(1, ...all);
    return value === 0 ? 4 : Math.max(10, (100 * value) / max);
  }
}
