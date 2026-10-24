import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProjectAdminCosts } from '../../../models/projektmuhely.model';
import { sourceColor, sourceLabel } from '../../../models/ai-spending.model';
import { UsdPipe } from '../../../shared/format/usd.pipe';

/**
 * A Projektműhely költsége: AI (OpenRouter, USD) forrásonként és projektenként, valamint a Judge0-futtatások (darab és CPU-idő).
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-projektmuhely-koltseg',
  imports: [UsdPipe],
  styles: ':host { display: contents; }',
  template: `
    @let c = costs();
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="card p-4"><p class="text-xs text-text-muted font-semibold">AI-költés ({{ c.days }} nap)</p>
        <p class="text-2xl font-extrabold mt-1">{{ c.totalAiUsd | usd: 'fine' }}</p></div>
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
            <strong class="tabular-nums w-20 text-right">{{ s.costUsd | usd: 'fine' }}</strong>
          </li>
        }
      </ul>
      @if (c.unattributedAiUsd > 0) {
        <p class="text-xs text-text-muted mt-3">Ebből {{ c.unattributedAiUsd | usd: 'fine' }} projekthez nem köthető (a hozzárendelés bevezetése előtti kérések).</p>
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
                <td class="pr-3 text-right tabular-nums">{{ p.aiCostUsd | usd: 'fine' }}</td>
                <td class="pr-3 text-right tabular-nums font-bold">{{ p.aiCostPerActiveStudentUsd | usd: 'fine' }}</td>
                <td class="pr-3 text-right tabular-nums">{{ p.checks }}</td>
                <td class="pr-3 text-right tabular-nums">{{ p.previews }}</td>
                <td class="pr-3 text-right tabular-nums">{{ fmtSeconds(p.judge0CpuSeconds) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ProjektmuhelyKoltsegComponent {
  readonly costs = input.required<ProjectAdminCosts>();

  readonly label = sourceLabel;
  readonly color = sourceColor;

  fmtSeconds(s: number): string {
    return s < 120 ? `${s.toFixed(0)} mp` : `${(s / 60).toFixed(1)} perc`;
  }
}
