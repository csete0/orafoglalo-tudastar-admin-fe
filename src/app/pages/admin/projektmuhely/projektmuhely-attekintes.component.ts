import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProjectAdminOverview, RUNTIME_LABELS } from '../../../models/projektmuhely.model';
import { BarChartColumn, BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';
import { UsdPipe } from '../../../shared/format/usd.pipe';
import { formatUsdFine } from '../../../shared/format/number-utils';

/**
 * A Projektműhely áttekintése: projektenkénti haladás (sorból a tölcsér nyitható) és a napi Judge0-futtatások diagramja az
 * összesítővel. A gazda-elem `display: contents`, a kártyák közvetlenül a pult elrendezésében állnak.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-projektmuhely-attekintes',
  imports: [BarChartComponent, UsdPipe],
  styles: ':host { display: contents; }',
  template: `
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
            @for (p of overview().projects; track p.slug) {
              <tr class="border-t border-border-default">
                <td class="py-2 pr-3 font-semibold">{{ p.title }} @if (!p.isPublished) { <span class="text-xs text-text-muted">(nem publikált)</span> }</td>
                <td class="pr-3 text-right tabular-nums">{{ p.started }}</td>
                <td class="pr-3 text-right tabular-nums">{{ p.completed }}</td>
                <td class="pr-3 text-right tabular-nums">{{ p.active7 }} / {{ p.active30 }}</td>
                <td class="pr-3 text-xs text-text-muted">{{ runtimes(p.byRuntime) }}</td>
                <td class="text-right"><button type="button" class="text-xs font-bold text-primary" (click)="funnelOpen.emit(p.slug)">Tölcsér →</button></td>
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
      <svg app-bar-chart [columns]="columns()" [height]="200" class="w-full h-auto block mt-3" role="img"
        aria-label="Napi Judge0-futtatások: Ellenőrzés és előnézet"></svg>
      <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-default text-xs text-text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm inline-block" style="background: var(--series-grading)"></span>
          Ellenőrzés <strong class="text-text-primary">{{ totals().checks }}</strong></span>
        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm inline-block" style="background: var(--series-classtest)"></span>
          Előnézet (C#/Java) <strong class="text-text-primary">{{ totals().previews }}</strong></span>
        <span>AI: <strong class="text-text-primary">{{ totals().aiRequests }}</strong> kérés, <strong class="text-text-primary">{{ totals().aiCostUsd | usd: 'fine' }}</strong></span>
      </div>
    </div>
  `,
})
export class ProjektmuhelyAttekintesComponent {
  readonly overview = input.required<ProjectAdminOverview>();
  /** A sor „Tölcsér →” gombja: a projekt slugja. */
  readonly funnelOpen = output<string>();

  readonly totals = computed(() =>
    this.overview().daily.reduce(
      (t, d) => ({ checks: t.checks + d.checks, previews: t.previews + d.previews, aiRequests: t.aiRequests + d.aiRequests, aiCostUsd: t.aiCostUsd + d.aiCostUsd }),
      { checks: 0, previews: 0, aiRequests: 0, aiCostUsd: 0 },
    ),
  );

  /** Napi oszlop: alul az ellenőrzések, fölötte az előnézetek; a súgóban az AI-költés is. */
  readonly columns = computed<BarChartColumn[]>(() =>
    this.overview().daily.map((d) => {
      const label = new Date(d.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
      return {
        key: d.date,
        title: `${label} · Ellenőrzés: ${d.checks} · előnézet: ${d.previews} · AI: ${d.aiRequests} kérés, ${formatUsdFine(d.aiCostUsd)}`,
        segments: [
          { value: d.checks, color: 'var(--series-grading)' },
          { value: d.previews, color: 'var(--series-classtest)' },
        ],
      };
    }),
  );

  runtimes(byRuntime: Record<string, number>): string {
    return Object.entries(byRuntime).map(([k, v]) => `${RUNTIME_LABELS[k] ?? k} ${v}`).join(' · ') || '–';
  }
}
