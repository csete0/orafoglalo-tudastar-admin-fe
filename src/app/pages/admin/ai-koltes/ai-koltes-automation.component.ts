import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { UsdPipe } from '../../../shared/format/usd.pipe';
import { AiKoltesAutomationState, automationTitle } from './ai-koltes-automation.state';

/**
 * AI-költés pult, Egyéb automatizmusok fül: az ütemezett, tokent fogyasztó háttérfolyamatok utolsó futása és kézi
 * újraindítása, valamint a tanár-indított kvíz-generálás tájékoztató kártyája. Az állapot az `AiKoltesAutomationState`-ben
 * (pult-szintű). A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-automation',
  imports: [DatePipe, LocalSpinnerComponent, UsdPipe],
  styles: ':host { display: contents; }',
  template: `
    <h2 class="font-bold text-lg mb-1">Token-fogyasztó háttérfolyamatok</h2>
    <p class="text-xs text-text-muted mb-4">
      A projektben jelenleg ez a 2 ütemezett feladat + 1 tanár-indított funkció éget AI-tokent
      az automata kvíz-karbantartáson kívül.
    </p>

    @if (state.loading()) {
      <app-local-spinner />
    } @else {
      @for (a of state.status(); track a.key) {
        <div class="card p-4 mb-3 flex gap-4 items-start">
          <div class="icon-tile icon-tile-warning">
            <span class="text-lg" aria-hidden="true">⏱</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex justify-between gap-3 flex-wrap items-baseline">
              <h3 class="font-bold text-sm">{{ title(a.key) }}</h3>
              <span class="badge badge-neutral">{{ a.scheduleDescription }}</span>
            </div>
            <p class="text-xs text-text-muted mt-1 mb-3">
              @if (a.lastRunAt) {
                Utoljára lefutott: {{ a.lastRunAt | date: 'yyyy.MM.dd. HH:mm' }}
                @if (a.lastRunCostUsd !== null) { · {{ a.lastRunCostUsd | usd }} }
              } @else {
                Még nem futott le AiRequestLog-bejegyzés szerint.
              }
            </p>
            <button type="button" class="btn btn-ghost !border !border-border-default !px-3 !py-1.5 !text-xs"
              [disabled]="state.triggering() === a.key" (click)="state.trigger(a.key)">
              {{ state.triggering() === a.key ? 'Indítás...' : 'Kézi újraindítás most' }}
            </button>
          </div>
        </div>
      }

      <div class="card p-4 flex gap-4 items-start">
        <div class="icon-tile icon-tile-secondary">
          <span class="text-lg" aria-hidden="true">✎</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between gap-3 flex-wrap items-baseline">
            <h3 class="font-bold text-sm">Kvíz-kérdés generálás (tanári)</h3>
            <span class="badge badge-neutral">nem ütemezett - tanár indítja</span>
          </div>
          <p class="text-xs text-text-muted mt-1">
            Nem háttérfolyamat, tanári kérésre fut - a költése a Kérésnaplóban szűrhető
            ("Kvíz-generálás (tanári)"), kézi indítás innen nem értelmezhető.
          </p>
        </div>
      </div>
    }

    <p class="text-xs text-text-muted mt-5 text-center">
      Ha a projektbe új, tokent fogyasztó háttérfolyamat kerül, ide kell felvenni - nincs ehhez
      automatikus felismerés.
    </p>
  `,
})
export class AiKoltesAutomationComponent {
  protected readonly state = inject(AiKoltesAutomationState);
  protected readonly title = automationTitle;
}
