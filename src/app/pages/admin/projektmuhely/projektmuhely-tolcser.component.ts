import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ProjectAdminFunnel, ProjectAdminProjectRow } from '../../../models/projektmuhely.model';
import { PercentOfPipe } from '../../../shared/format/percent-of.pipe';

/**
 * A Projektműhely tölcsére: projekt-választó és lépésenként a teljesítők aránya; a legnagyobb lemorzsolódás kiemelve.
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-projektmuhely-tolcser',
  imports: [DecimalPipe, PercentOfPipe],
  styles: ':host { display: contents; }',
  template: `
    <div class="flex items-center gap-3 mb-4">
      <label class="text-sm font-semibold" for="pm-funnel-project">Projekt</label>
      <select id="pm-funnel-project" class="input max-w-xs" [value]="slug()" #funnelSelect (change)="projectChange.emit(funnelSelect.value)">
        @for (p of projects(); track p.slug) { <option [value]="p.slug">{{ p.title }}</option> }
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
                        <div class="h-full bg-primary" [style.width.%]="m.passed | percentOf: f.started"></div>
                      </div>
                      <span class="tabular-nums text-xs w-14 text-right">{{ m.passed }} ({{ m.passed | percentOf: f.started | number: '1.0-0' }}%)</span>
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
  `,
})
export class ProjektmuhelyTolcserComponent {
  readonly projects = input.required<readonly ProjectAdminProjectRow[]>();
  /** A kiválasztott projekt slugja. */
  readonly slug = input.required<string>();
  readonly funnel = input.required<ProjectAdminFunnel | null>();
  readonly projectChange = output<string>();

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

  fmtMinutes(m: number | null): string {
    if (m === null) return '–';
    return m < 90 ? `${Math.round(m)} perc` : m < 60 * 48 ? `${(m / 60).toFixed(1)} óra` : `${(m / 1440).toFixed(1)} nap`;
  }
}
