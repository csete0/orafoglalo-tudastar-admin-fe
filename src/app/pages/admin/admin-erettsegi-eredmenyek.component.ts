import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { ExamOutcomeQuote, ExamOutcomeSummary, PUBLIC_MIN_COUNT } from '../../models/exam-outcomes.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

const GRADE_NAMES = ['elégtelen', 'elégséges', 'közepes', 'jó', 'jeles'];

/**
 * Érettségi-eredmények (PATRICKS-EREDMENYEK-ES-NOVEKEDES-TERV.md, 1.6): a diákok/szülők által megadott valódi
 * eredmények összesítve (csak hozzájárulással), aktív hetek szerinti szegmensek, az előrejelzés pontossága, az
 * idézetek moderálása és névtelen CSV. Nyilvánosan csak 20 eredmény fölött és csak jóváhagyott idézet használható.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-erettsegi-eredmenyek',
  standalone: true,
  imports: [DatePipe, DecimalPipe, PercentPipe, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Érettségi-eredmények</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        A diákok (és szüleik) által nyáron megadott valódi eredmények – és hogy mennyire talált az előrejelzésünk.
      </p>
      <div class="hairline"></div>

      @if (error()) { <p class="text-danger text-sm mb-4">{{ error() }}</p> }
      @if (loading()) {
        <app-local-spinner />
      } @else if (summary(); as s) {
        <div class="flex items-center gap-3 flex-wrap mb-4">
          <label class="text-sm">Év
            <select class="ml-2 border border-border-default rounded px-2 py-1 bg-bg-element" (change)="load(+$any($event.target).value)">
              @for (y of years(s); track y) { <option [value]="y" [selected]="y === s.year">{{ y }}</option> }
            </select>
          </label>
          <button type="button" class="text-sm font-bold text-primary" (click)="download(s.year)" [disabled]="s.usable === 0">CSV letöltése</button>
        </div>

        <div class="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
          <div class="card p-4"><p class="text-xs text-text-muted">Válasz</p><p class="text-2xl font-bold tabular-nums">{{ s.responses }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Felhasználható eredmény</p><p class="text-2xl font-bold tabular-nums">{{ s.usable }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">Szülő adta meg</p><p class="text-2xl font-bold tabular-nums">{{ s.fromParents }}</p></div>
          <div class="card p-4"><p class="text-xs text-text-muted">„Nem érettségiztem”</p><p class="text-2xl font-bold tabular-nums">{{ s.notTaken }}</p></div>
        </div>
        @if (s.usable < publicMin) {
          <p class="text-sm text-warning mb-4" data-testid="small-sample">Még csak {{ s.usable }} eredmény van – {{ publicMin }} alatt nyilvánosan ne idézzünk átlagot.</p>
        }

        <div class="grid gap-4 md:grid-cols-2 mb-6">
          @for (l of s.levels; track l.level) {
            <div class="card p-5" [attr.data-testid]="'level-' + l.level">
              <h2 class="font-bold">{{ l.level === 'emelt' ? 'Emelt szint' : 'Középszint' }}
                <span class="text-sm text-text-muted font-normal">· {{ l.count }} eredmény @if (l.averagePercent !== null) { · átlag {{ l.averagePercent | number: '1.0-1' }}% }</span></h2>
              <div class="mt-3 space-y-1">
                @for (n of l.grades; track $index; let i = $index) {
                  <div class="grid grid-cols-[6rem_1fr_2rem] items-center gap-2 text-xs">
                    <span>{{ i + 1 }} – {{ gradeNames[i] }}</span>
                    <span class="h-2 rounded-full bg-bg-element overflow-hidden"><span class="block h-full bg-primary" [style.width.%]="l.count ? (n / l.count) * 100 : 0"></span></span>
                    <span class="text-right tabular-nums">{{ n }}</span>
                  </div>
                }
              </div>
              <table class="w-full text-sm mt-4">
                <thead><tr class="text-left text-xs text-text-muted"><th class="py-1">Aktív hetek az érettségi előtt</th><th class="text-right">Diák</th><th class="text-right">Átlag</th></tr></thead>
                <tbody>
                  @for (seg of l.segments; track seg.label) {
                    <tr class="border-t border-border-default"><td class="py-1">{{ seg.label }}</td><td class="text-right tabular-nums">{{ seg.count }}</td>
                      <td class="text-right tabular-nums">{{ seg.averagePercent === null ? '–' : (seg.averagePercent | number: '1.0-1') + '%' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="card p-5 mb-6" data-testid="accuracy">
          <h2 class="font-bold">Az előrejelzés pontossága</h2>
          @if (s.accuracy.count === 0) {
            <p class="text-sm text-text-muted mt-1">Még nincs olyan eredmény, amelyhez azonos szintű előrejelzés tartozott.</p>
          } @else {
            <p class="text-sm mt-2">{{ s.accuracy.count }} diáknál: átlagos eltérés <strong>{{ s.accuracy.meanAbsoluteError | number: '1.0-1' }} százalékpont</strong>
              (előjellel {{ s.accuracy.meanSignedError! > 0 ? '+' : '' }}{{ s.accuracy.meanSignedError | number: '1.0-1' }} – pozitív: a valóság jobb lett)
              @if (s.accuracy.withinBandShare !== null) {, a becsült sávba esett: <strong>{{ s.accuracy.withinBandShare | percent: '1.0-0' }}</strong> }.</p>
          }
        </div>

        <div class="card p-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <h2 class="font-bold">Idézetek</h2>
            <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5" role="group" aria-label="Állapot">
              @for (st of statuses; track st.id) {
                <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="quoteStatus() === st.id" [class.text-white]="quoteStatus() === st.id"
                  [class.text-text-muted]="quoteStatus() !== st.id" (click)="loadQuotes(st.id)">{{ st.label }}</button>
              }
            </div>
          </div>
          <p class="text-xs text-text-muted mt-0.5">Név nélkül jelenhetnek meg („Emelt szintű érettségiző, {{ s.year }}”), csak jóváhagyás után.</p>
          <ul class="mt-3 space-y-3" data-testid="quotes">
            @for (q of quotes(); track q.id) {
              <li class="border-t border-border-default pt-3">
                <p class="text-sm">„{{ q.quote }}”</p>
                <p class="text-xs text-text-muted mt-1">{{ q.level === 'emelt' ? 'Emelt szint' : 'Középszint' }}, {{ q.year }} · {{ q.percent }}% · {{ q.updatedAt | date: 'yyyy.MM.dd.' }}</p>
                @if (q.status === 'pending') {
                  <div class="flex gap-3 mt-1.5">
                    <button type="button" class="text-xs font-bold text-primary" (click)="moderate(q, true)">Jóváhagyom</button>
                    <button type="button" class="text-xs font-bold text-danger" (click)="moderate(q, false)">Elutasítom</button>
                  </div>
                }
              </li>
            } @empty {
              <li class="text-sm text-text-muted">Nincs ilyen idézet.</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class AdminErettsegiEredmenyekComponent implements OnInit {
  private readonly api = inject(AdminGrowthService);

  readonly gradeNames = GRADE_NAMES;
  readonly publicMin = PUBLIC_MIN_COUNT;
  readonly statuses = [
    { id: 'pending', label: 'Moderálásra vár' },
    { id: 'approved', label: 'Jóváhagyott' },
    { id: 'rejected', label: 'Elutasított' },
  ];
  readonly summary = signal<ExamOutcomeSummary | null>(null);
  readonly quotes = signal<ExamOutcomeQuote[]>([]);
  readonly quoteStatus = signal('pending');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load(null);
    this.loadQuotes('pending');
  }

  load(year: number | null): void {
    this.api.getOutcomeSummary(year).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Az érettségi-eredmények betöltése nem sikerült.');
        this.loading.set(false);
      },
    });
  }

  loadQuotes(status: string): void {
    this.quoteStatus.set(status);
    this.api.getQuotes(status).subscribe({ next: (q) => this.quotes.set(q), error: () => this.error.set('Az idézetek betöltése nem sikerült.') });
  }

  moderate(q: ExamOutcomeQuote, approved: boolean): void {
    this.api.setQuoteStatus(q.id, approved).subscribe({
      next: () => this.quotes.update((list) => list.filter((x) => x.id !== q.id)),
      error: () => this.error.set('A moderálás nem sikerült.'),
    });
  }

  /** Az év-választó: az adatos évek, és ha még nincs adat, az aktuális. */
  years(s: ExamOutcomeSummary): number[] {
    return s.years.length ? s.years : [s.year];
  }

  download(year: number): void {
    this.api.exportCsv(year).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `erettsegi-eredmenyek-${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('A CSV letöltése nem sikerült.'),
    });
  }
}
