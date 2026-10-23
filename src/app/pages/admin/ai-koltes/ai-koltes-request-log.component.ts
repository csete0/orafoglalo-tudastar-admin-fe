import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AI_SOURCES, sourceColor, sourceLabel } from '../../../models/ai-spending.model';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { UsdPipe } from '../../../shared/format/usd.pipe';
import { AiKoltesRequestLogState } from './ai-koltes-request-log.state';

/**
 * AI-költés pult, Kérésnapló fül: szűrő (felhasználó, forrás, dátumtartomány; minden mezőváltás azonnal tölt), táblázat,
 * lapozó „x–y / összes kérés” felirattal. Az állapot az `AiKoltesRequestLogState`-ben (pult-szintű, fülváltáskor megmarad).
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-request-log',
  imports: [DatePipe, DecimalPipe, FormsModule, LocalSpinnerComponent, UsdPipe],
  styles: ':host { display: contents; }',
  template: `
    <h2 class="font-bold text-lg mb-1">Kérésnapló</h2>
    <p class="text-xs text-text-muted mb-4">Minden egyes AI-hívás - ki, mikor, milyen forrásból, mennyiért.</p>

    <div class="flex gap-2 mb-4 flex-wrap items-center">
      <input class="input !w-auto min-w-[12rem]" type="text" placeholder="Felhasználó (email/név)..."
        [ngModel]="state.filter().userQuery" (ngModelChange)="state.setFilter({ userQuery: $event })" />
      <select class="input !w-auto" [ngModel]="state.filter().source" (ngModelChange)="state.setFilter({ source: $event })">
        <option [ngValue]="undefined">Minden forrás</option>
        @for (s of sourceOptions; track s.key) {
          <option [ngValue]="s.key">{{ s.label }}</option>
        }
      </select>
      <input class="input !w-auto" type="date" [ngModel]="state.filter().fromDate" (ngModelChange)="state.setFilter({ fromDate: $event })" />
      <span class="text-text-muted text-xs">–</span>
      <input class="input !w-auto" type="date" [ngModel]="state.filter().toDate" (ngModelChange)="state.setFilter({ toDate: $event })" />
      <button type="button" class="btn btn-ghost !px-3 !py-1.5 !text-xs" (click)="state.clearFilter()">Szűrés törlése</button>
    </div>

    @if (state.error()) {
      <p class="text-danger text-sm mb-4">{{ state.error() }}</p>
    }
    @if (state.loading()) {
      <app-local-spinner />
    } @else {
      <div class="card overflow-x-auto">
        <table class="w-full text-sm min-w-[46rem]">
          <thead>
            <tr class="text-xs text-text-muted uppercase border-b border-border-default">
              <th class="text-left font-bold px-3 py-2">Időpont</th>
              <th class="text-left font-bold px-3 py-2">Felhasználó</th>
              <th class="text-left font-bold px-3 py-2">Forrás</th>
              <th class="text-left font-bold px-3 py-2">Modell</th>
              <th class="text-right font-bold px-3 py-2">Prompt tok.</th>
              <th class="text-right font-bold px-3 py-2">Válasz tok.</th>
              <th class="text-right font-bold px-3 py-2">Költés</th>
            </tr>
          </thead>
          <tbody>
            @for (row of state.items(); track row.id) {
              <tr class="border-b border-border-default last:border-0">
                <td class="px-3 py-2 text-text-muted tabular-nums whitespace-nowrap">{{ row.createdAt | date: 'MM.dd. HH:mm' }}</td>
                <td class="px-3 py-2 truncate max-w-[9rem]">{{ row.userName }}</td>
                <td class="px-3 py-2">
                  <span class="w-2 h-2 rounded-sm inline-block mr-1.5" [style.background]="sourceColor(row.source)"></span>
                  {{ sourceLabel(row.source) }}
                </td>
                <td class="px-3 py-2 font-mono text-xs text-text-muted">{{ row.model }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.promptTokens | number: '1.0-0':'hu' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.completionTokens | number: '1.0-0':'hu' }}</td>
                <td class="px-3 py-2 text-right tabular-nums font-semibold">
                  {{ row.costUsd !== null ? (row.costUsd | usd) : '(becsült)' }}
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="py-6 text-center text-text-muted text-sm">Nincs a szűrésnek megfelelő kérés.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center mt-3 text-xs text-text-muted">
        <span>{{ state.rangeLabel() }}</span>
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost !px-3 !py-1.5 !text-xs" [disabled]="state.page() <= 1" (click)="state.changePage(-1)">Előző</button>
          <button type="button" class="btn btn-ghost !px-3 !py-1.5 !text-xs" [disabled]="!state.hasNextPage()" (click)="state.changePage(1)">Következő</button>
        </div>
      </div>
    }
  `,
})
export class AiKoltesRequestLogComponent {
  protected readonly state = inject(AiKoltesRequestLogState);

  protected readonly sourceOptions = AI_SOURCES;
  protected readonly sourceLabel = sourceLabel;
  protected readonly sourceColor = sourceColor;
}
