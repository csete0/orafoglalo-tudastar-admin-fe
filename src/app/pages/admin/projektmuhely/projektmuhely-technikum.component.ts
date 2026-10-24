import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EXAM_PART_LABELS, ProjectAdminTechnikumStats } from '../../../models/projektmuhely.model';

/**
 * A Fejlesztőműhely (technikumi vizsga) projektjei részenként: eredmények, átlag és bukási arány vizsgára és gyakorlásra.
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-projektmuhely-technikum',
  styles: ':host { display: contents; }',
  template: `
    @let t = stats();
    <p class="text-xs text-text-muted mb-4 max-w-2xl">
      A Technikumi vizsga projektjei részenként, a bírált eredmények alapján ({{ t.days }} nap; a függő és a rendszerhibás bírálat nem számít).
      Bukás: 40% alatti eredmény (a vizsga megfelelt-határa). Vizsga: önálló próbavizsga és dolgozat; gyakorlás: gyakorló ellenőrzés.
    </p>
    @for (p of t.projects; track p.slug) {
      <div class="card p-5 mb-4" [attr.data-testid]="'technikum-' + p.slug">
        <h2 class="font-bold">{{ p.title }}
          <span [class]="p.kind === 'exam' ? 'badge badge-primary ml-1' : 'badge badge-neutral ml-1'">{{ p.kind === 'exam' ? 'próbavizsga' : 'gyakorló' }}</span>
          @if (!p.isPublished) { <span class="text-xs text-text-muted">(nem publikált)</span> }
        </h2>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3" rowspan="2">Rész</th>
                <th class="pr-3 text-center border-b border-border-default" colspan="3">Vizsga</th>
                <th class="pr-3 text-center border-b border-border-default" colspan="3">Gyakorlás</th>
              </tr>
              <tr class="text-xs text-text-muted">
                <th class="py-1 pr-3 text-right">Eredmény (diák)</th><th class="pr-3 text-right">Átlag</th><th class="pr-3 text-right">Bukási arány</th>
                <th class="pr-3 text-right">Eredmény (diák)</th><th class="pr-3 text-right">Átlag</th><th class="pr-3 text-right">Bukási arány</th>
              </tr>
            </thead>
            <tbody>
              @for (part of p.parts; track part.partKey) {
                <tr class="border-t border-border-default">
                  <td class="py-2 pr-3 font-semibold">{{ partLabel(part.partKey) }} <span class="text-xs font-normal text-text-muted">({{ part.maxPoints }} pont)</span></td>
                  @for (s of [part.exam, part.practice]; track $index) {
                    <td class="pr-3 text-right tabular-nums">{{ s.results }} ({{ s.students }})</td>
                    <td class="pr-3 text-right tabular-nums">{{ fmtPercent(s.avgPercent) }}</td>
                    <td class="pr-3 text-right tabular-nums">{{ fmtPercent(s.failRatePercent) }}</td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="7" class="py-3 text-text-muted">A projektnek nincs vizsgarészhez kötött lépése.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @empty {
      <p class="text-sm text-text-muted">Még nincs technikumi vizsgaprojekt.</p>
    }
  `,
})
export class ProjektmuhelyTechnikumComponent {
  readonly stats = input.required<ProjectAdminTechnikumStats>();

  partLabel(key: string): string {
    return EXAM_PART_LABELS[key] ?? key;
  }

  fmtPercent(v: number | null): string {
    return v === null ? '–' : `${v.toFixed(1)}%`;
  }
}
