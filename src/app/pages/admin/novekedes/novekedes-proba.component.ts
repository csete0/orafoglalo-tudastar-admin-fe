import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminGrowthService } from '../../../services/admin/admin-growth.service';
import { TrialFunnel } from '../../../models/growth.model';
import { downloadCsv } from '../../../shared/csv/csv';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { latestValue } from '../../../shared/resource/latest-value';

/** Próba-tölcsér: regisztrált → próbát kezdett → fizetett, heti kohorszonként; a fül megnyitásakor tölt. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-novekedes-proba',
  imports: [DatePipe, PercentPipe, LocalSpinnerComponent],
  template: `
    @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
    @if (data(); as f) {
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6" data-testid="trial-kpis">
        <div class="card p-4"><p class="text-xs text-text-muted">Regisztrált</p><p class="text-2xl font-bold tabular-nums">{{ totals().registered }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próbát kezdett</p><p class="text-2xl font-bold tabular-nums">{{ totals().trialStarted }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próba → fizetés (lejárt próbák)</p>
          <p class="text-2xl font-bold tabular-nums">{{ totals().conversion === null ? '–' : (totals().conversion | percent: '1.0-0') }}</p></div>
        <div class="card p-4"><p class="text-xs text-text-muted">Próba nélkül fizetett</p><p class="text-2xl font-bold tabular-nums">{{ totals().paidWithoutTrial }}</p></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold">Próba → fizetés heti kohorszonként</h2>
            <p class="text-xs text-text-muted mt-0.5 max-w-2xl">A regisztráció hete szerint. Átváltás: a próbázók közül hányan fizettek (vagy aktiváltak
              ajándékot) – a még futó próbák miatt a friss hetek alacsonyabbak. Ellenőrzés: {{ f.trialGrantsInPeriod }} próba-kiadás az időszakban
              (e-mail-napló, tesztfiókokkal együtt).</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5" role="group" aria-label="Hetek">
              @for (w of weekOptions; track w) {
                <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="weeks() === w" [class.text-white]="weeks() === w"
                  [class.text-text-muted]="weeks() !== w" [attr.aria-pressed]="weeks() === w" (click)="setWeeks(w)">{{ w }} hét</button>
              }
            </div>
            <button type="button" class="text-xs font-bold text-primary hover:underline" (click)="exportCsv(f)">CSV letöltése</button>
          </div>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="w-full text-sm" data-testid="trial-cohorts">
            <thead>
              <tr class="text-left text-xs text-text-muted">
                <th class="py-2 pr-3">Hét</th><th class="pr-3 text-right">Regisztrált</th><th class="pr-3 text-right">Próbát kezdett</th>
                <th class="pr-3 text-right">Próba lejárt</th><th class="pr-3 text-right">Próba után fizetett</th><th class="pr-3 text-right">Átváltás</th>
                <th class="text-right">Próba nélkül fizetett</th>
              </tr>
            </thead>
            <tbody>
              @for (c of f.cohorts; track c.weekStart) {
                <tr class="border-t border-border-default">
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ c.weekStart | date: 'yyyy.MM.dd.' }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.registered }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialStarted }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialEnded }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialPaid }}</td>
                  <td class="pr-3 text-right tabular-nums">{{ c.trialStarted ? (c.trialPaid / c.trialStarted | percent: '1.0-0') : '–' }}</td>
                  <td class="text-right tabular-nums">{{ c.paidWithoutTrial }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else if (!error()) {
      <app-local-spinner />
    }
  `,
})
export class AdminNovekedesProbaComponent {
  private readonly api = inject(AdminGrowthService);
  readonly weekOptions = [12, 26];
  readonly weeks = signal(12);
  private readonly funnel = rxResource({ params: () => this.weeks(), stream: ({ params: weeks }) => this.api.getTrialFunnel(weeks) });
  /** Hét-váltás közben és hiba után a korábbi tölcsér marad. */
  readonly data = latestValue(this.funnel);
  readonly error = computed(() => (this.funnel.error() ? 'A próba-tölcsér betöltése nem sikerült.' : null));

  /** Összesítő; az átváltás csak azokon a heteken, ahol minden próba lejárt (különben a futó próbák lehúznák). */
  readonly totals = computed(() => {
    const cohorts = this.data()?.cohorts ?? [];
    const sum = (f: (c: TrialFunnel['cohorts'][number]) => number) => cohorts.reduce((s, c) => s + f(c), 0);
    const closed = cohorts.filter((c) => c.trialStarted > 0 && c.trialEnded === c.trialStarted);
    const closedTrials = closed.reduce((s, c) => s + c.trialStarted, 0);
    return {
      registered: sum((c) => c.registered),
      trialStarted: sum((c) => c.trialStarted),
      paidWithoutTrial: sum((c) => c.paidWithoutTrial),
      conversion: closedTrials === 0 ? null : closed.reduce((s, c) => s + c.trialPaid, 0) / closedTrials,
    };
  });

  /** Az aktív hét újrakattintása is újratölt (mint eddig). */
  setWeeks(weeks: number): void {
    if (weeks === this.weeks()) this.funnel.reload();
    else this.weeks.set(weeks);
  }

  exportCsv(f: TrialFunnel): void {
    downloadCsv('proba-tolcser.csv', ['Hét', 'Regisztrált', 'Próbát kezdett', 'Próba lejárt', 'Próba után fizetett', 'Próba nélkül fizetett'],
      f.cohorts.map((c) => [c.weekStart, c.registered, c.trialStarted, c.trialEnded, c.trialPaid, c.paidWithoutTrial]));
  }
}
