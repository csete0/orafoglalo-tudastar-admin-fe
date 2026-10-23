import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminMockExamMarketing, AdminMockExamSourceRow } from '../../../models/mock-exam.model';

/** Konverzió (0–100), ha van nevező. */
export function conversion(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((100 * part) / whole) : null;
}

interface FunnelStep { label: string; value: number; rate: number | null; width: number }

/**
 * A próbaérettségi marketing-megtérülése forrásonkénti tölcsérrel:
 * `<div app-mock-exam-marketing class="card p-5" data-testid="mock-marketing" [marketing]="…"></div>`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-mock-exam-marketing]',
  imports: [DecimalPipe],
  template: `
    @let m = marketing();
    <h3 class="font-bold">Marketing</h3>
    @if (!m.roiAvailable) {
      <p class="text-xs text-text-muted mt-0.5">A megtérülés (fizetők, bevétel) a közzététel után számolódik. Tesztfiókok nélkül.</p>
    }
    <div class="grid gap-3 grid-cols-2 md:grid-cols-6 mt-3">
      <div><p class="text-xs text-text-muted">Új fiók az eseményből</p><p class="text-xl font-bold tabular-nums">{{ m.newAccountsFromEvent }}</p>
        <p class="text-xs text-text-muted">tanárin át: {{ m.newAccountsViaTeacher }}</p></div>
      <div><p class="text-xs text-text-muted">Fizető 7 nap</p><p class="text-xl font-bold tabular-nums">{{ m.payers7 }}</p></div>
      <div><p class="text-xs text-text-muted">Fizető 30 nap</p><p class="text-xl font-bold tabular-nums">{{ m.payers30 }}</p>
        <p class="text-xs text-text-muted">{{ m.participants }} résztvevőből</p></div>
      <div><p class="text-xs text-text-muted">Bevétel 30 nap</p><p class="text-xl font-bold tabular-nums">{{ m.revenue30 | number: '1.0-0' }} Ft</p></div>
      <div><p class="text-xs text-text-muted">MI-költség</p><p class="text-xl font-bold tabular-nums">{{ m.aiCostUsd | number: '1.2-2' }} $</p></div>
      <div><p class="text-xs text-text-muted">Bevétel / MI-költség</p><p class="text-xl font-bold tabular-nums">{{ m.revenueToAiCostRatio === null ? '–' : (m.revenueToAiCostRatio | number: '1.1-1') + '×' }}</p></div>
    </div>
    <div class="overflow-x-auto mt-4">
      <table class="w-full text-sm" data-testid="mock-sources">
        <thead><tr class="text-left text-xs text-text-muted">
          <th class="py-2 pr-3">Forrás</th><th class="pr-3">Jelentkező → induló → beadó → fizető (30 nap)</th><th class="pr-3 text-right">Bevétel</th>
        </tr></thead>
        <tbody>
          @for (r of m.bySource; track r.source) {
            <tr class="border-t border-border-default">
              <td class="py-1.5 pr-3 whitespace-nowrap">{{ sourceLabel(r.source) }}</td>
              <td class="pr-3">
                <div class="flex items-center gap-2 text-xs tabular-nums">
                  @for (step of funnel(r); track step.label) {
                    <span class="inline-flex items-center gap-1" [title]="step.label">
                      <span class="h-2 rounded-full bg-primary" [style.width.px]="step.width"></span>{{ step.value }}
                      @if (step.rate !== null) { <span class="text-text-muted">({{ step.rate }}%)</span> }
                    </span>
                  }
                </div>
              </td>
              <td class="pr-3 text-right tabular-nums">{{ r.revenue30 | number: '1.0-0' }} Ft</td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="py-3 text-text-muted">Még nincs jelentkező.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MockExamMarketingComponent {
  readonly marketing = input.required<AdminMockExamMarketing>();

  sourceLabel(source: string): string {
    if (source === 'self') return 'Önálló (UTM nélkül)';
    if (source === 'teacher') return 'Tanári jelentkeztetés';
    return source.replace(/^utm:/, 'UTM: ');
  }

  /** A forrás tölcsére: jelentkező → induló → beadó → fizető (30 nap), az előző lépéshez mért %-kal. */
  funnel(r: AdminMockExamSourceRow): FunnelStep[] {
    const top = Math.max(1, r.registered);
    const steps = [
      { label: 'jelentkező', value: r.registered, prev: null as number | null },
      { label: 'induló', value: r.started, prev: r.registered },
      { label: 'beadó', value: r.submitted, prev: r.started },
      { label: 'fizető (30 nap)', value: r.payers30, prev: r.submitted },
    ];
    return steps.map((s) => ({ label: s.label, value: s.value, rate: s.prev === null ? null : conversion(s.value, s.prev),
      width: Math.max(2, Math.round((60 * s.value) / top)) }));
  }
}
