import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { UsdPipe } from '../../../shared/format/usd.pipe';
import { AiKoltesMaintenanceState } from './ai-koltes-maintenance.state';

/**
 * AI-költés pult, Kvíz-karbantartás fül: futtatás-form költség-becsléssel, indítás, futtatási előzmények. Az „Eredmények”
 * gomb az `openRun` kimenettel kéri a pultot, hogy nyissa meg a futás döntéseit. Az állapot az `AiKoltesMaintenanceState`-ben
 * (pult-szintű). A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-koltes-maintenance',
  imports: [DatePipe, FormsModule, LocalSpinnerComponent, UsdPipe],
  styles: ':host { display: contents; }',
  template: `
    <div class="flex gap-3 p-4 rounded-xl bg-primary-subtle border border-primary/30 mb-6">
      <p class="text-sm">
        <strong class="block mb-0.5">Az automatikus ütemezés eltávolítva.</strong>
        A kvíz-kérdés karbantartás korábban 2 naponta, 03:00-kor magától lefutott - ez mostantól
        kizárólag innen, kézzel indítható.
      </p>
    </div>

    <div class="card p-5 mb-6">
      <h2 class="font-bold mb-3">Új futtatás indítása</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-text-muted block mb-1">Kérdés-tartomány kezdete</label>
          <input class="input" type="number" placeholder="üresen: alapértelmezett minta"
            [(ngModel)]="state.form.rangeStartId" (ngModelChange)="state.estimate.set(null)" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Kérdés-tartomány vége</label>
          <input class="input" type="number" placeholder="üresen: alapértelmezett minta"
            [(ngModel)]="state.form.rangeEndId" (ngModelChange)="state.estimate.set(null)" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Modell</label>
          <select class="input" [(ngModel)]="state.form.model" (ngModelChange)="state.estimate.set(null)">
            <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (olcsó, alap)</option>
            <option value="openai/gpt-4o">openai/gpt-4o (pontosabb)</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Mód</label>
          <select class="input" [(ngModel)]="state.form.dryRun">
            <option [ngValue]="true">Próbafuttatás (dry-run, nem ír adatot)</option>
            <option [ngValue]="false">Éles futtatás</option>
          </select>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <div class="text-xs text-text-muted">
          @if (state.estimating()) {
            Becslés...
          } @else if (state.estimate(); as est) {
            Becsült költség: <strong class="text-text-primary">{{ est.estimatedCostUsd | usd }}</strong>
            ({{ est.candidateCount }} kérdés · {{ state.form.model }})
          } @else {
            <button type="button" class="underline" (click)="state.loadEstimate()">Költség-becslés lekérése</button>
          }
        </div>
        <button type="button" class="btn btn-primary" [disabled]="state.running()" (click)="state.runMaintenance()">
          {{ state.running() ? 'Indítás...' : 'Futtatás indítása' }}
        </button>
      </div>
    </div>

    <h2 class="font-bold mb-1">Futtatási előzmények</h2>
    <p class="text-xs text-text-muted mb-3">Kézi és korábbi automata futások.</p>

    @if (state.runsLoading()) {
      <app-local-spinner />
    } @else {
      <div class="card divide-y divide-border-default">
        @for (run of state.runs(); track run.id) {
          <div class="p-4 flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap font-bold text-sm">
                #{{ run.id.slice(0, 8) }}
                <span class="badge" [class]="run.triggeredByUserId ? 'badge-primary' : 'badge-neutral'">
                  {{ run.triggeredByUserId ? 'kézi' : 'automata (archív)' }}
                </span>
                @if (run.dryRun) {
                  <span class="badge badge-warning">próbafuttatás</span>
                }
                @if (!run.completedAt) {
                  <span class="badge badge-primary">folyamatban…</span>
                } @else if (run.errorMessage) {
                  <span class="badge badge-danger">hiba</span>
                }
              </div>
              <p class="text-xs text-text-muted mt-1 tabular-nums">
                {{ run.startedAt | date: 'yyyy.MM.dd. HH:mm' }}
                @if (run.triggeredByName) { · {{ run.triggeredByName }} }
                · tartomány: {{ run.rangeStartId ? run.rangeStartId + '–' + run.rangeEndId : 'alapértelmezett' }}
                @if (run.completedAt) {
                  · {{ run.candidatesReviewed }} kérdés vizsgálva
                  @if (run.estimatedCostUsd !== null) { · {{ run.estimatedCostUsd | usd }} }
                }
              </p>
              <!-- UI-TT-236: egy futás-közbeni hiba korábban a sort örökre "folyamatban…" állapotban hagyta,
                   admin-jelzés nélkül - most a tényleges hibaüzenet is látszik. -->
              @if (run.errorMessage) {
                <p class="text-xs text-danger mt-1">{{ run.errorMessage }}</p>
              }
            </div>
            <button type="button" class="btn btn-ghost !border !border-border-default !px-3 !py-1.5 !text-xs shrink-0"
              (click)="openRun.emit(run.id)">
              Eredmények
            </button>
          </div>
        } @empty {
          <p class="p-6 text-center text-text-muted text-sm">Még nem volt karbantartó-futás.</p>
        }
      </div>
    }
  `,
})
export class AiKoltesMaintenanceComponent {
  protected readonly state = inject(AiKoltesMaintenanceState);
  /** Egy futás „Eredmények” gombja: a pult átvált az Eredmények fülre. */
  readonly openRun = output<string>();
}
