import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AdminAiSpendingService } from '../../services/admin/admin-ai-spending.service';
import {
  AiSpendingMonthlyReportDto,
  MonthlyReportInstitutionDto,
  MonthlyReportPersonDto,
  sourceColor,
  sourceLabel,
} from '../../models/ai-spending.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { fmtUsd } from './admin-gyakorlo-ertekelesek.component';

type SortDir = 'desc' | 'asc';

interface PersonGroup {
  key: string;
  title: string;
  people: MonthlyReportPersonDto[];
}

const MONTHS_BACK = 12;

/** 'YYYY-MM' a böngésző helyi naptára szerint (a felhasználók Magyarországon vannak). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Ékezet- és kisbetű-független kereséshez. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * AI-költés pult - "Havi riport" fül: egy naptári hónap AI-költése intézményenként
 * (tanárok / diákok), majd az intézmény nélküli diákok, tanárok, egyéb felhasználók és a
 * senkihez nem köthető rendszer-hívások forrásonként; CSV-letöltéssel a számlázáshoz.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-ai-havi-riport',
  standalone: true,
  imports: [NgTemplateOutlet, LocalSpinnerComponent],
  template: `
    <div class="flex items-end justify-between gap-3 flex-wrap mb-4">
      <div>
        <h2 class="font-bold text-lg">Havi riport</h2>
        <p class="text-xs text-text-muted mt-0.5">Ki mennyi AI-költést okozott a hónapban - intézményenként, tanár és diák bontásban.</p>
      </div>
      <div class="flex gap-2 items-center flex-wrap">
        <label class="sr-only" for="havi-riport-honap">Hónap</label>
        <select id="havi-riport-honap" class="input !w-auto" data-testid="month-select"
          [value]="month()" (change)="setMonth($any($event.target).value)">
          @for (m of monthOptions; track m.key) {
            <option [value]="m.key">{{ m.label }}</option>
          }
        </select>
        <button type="button" class="btn btn-ghost !border !border-border-default !px-3 !py-1.5 !text-xs"
          data-testid="csv-download" [disabled]="downloading()" (click)="downloadCsv()">
          {{ downloading() ? 'Letöltés…' : 'CSV letöltése' }}
        </button>
      </div>
    </div>

    @if (error()) {
      <div class="card p-4 mb-4 flex items-center justify-between gap-3 flex-wrap" role="alert">
        <p class="text-danger text-sm">{{ error() }}</p>
        <button type="button" class="btn btn-ghost !px-3 !py-1.5 !text-xs" (click)="load()">Újra</button>
      </div>
    }

    @if (loading()) {
      <app-local-spinner />
    } @else if (report(); as r) {
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="report-tiles">
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Összesen</p>
          <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ fmtUsd(r.totalUsd) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Besorolt</p>
          <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ fmtUsd(r.attributedUsd) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Nem besorolt</p>
          <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ fmtUsd(r.unattributedUsd) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-text-muted font-semibold">Kérések</p>
          <p class="text-2xl font-extrabold mt-1 tabular-nums">{{ r.requestCount }}</p>
        </div>
      </div>

      @if (isEmpty()) {
        <p class="card p-6 text-center text-text-muted text-sm" data-testid="report-empty">Ebben a hónapban nem volt AI-költés.</p>
      } @else {
        <div class="flex gap-2 mb-4 flex-wrap items-center">
          <input class="input flex-1 min-w-[12rem] sm:!w-auto sm:flex-none" type="search" placeholder="Keresés név vagy e-mail szerint…"
            aria-label="Keresés név vagy e-mail szerint" data-testid="report-search"
            [value]="query()" (input)="query.set($any($event.target).value)" />
          <button type="button" class="btn btn-ghost !border !border-border-default !px-3 !py-1.5 !text-xs" data-testid="sort-toggle"
            [attr.aria-label]="'Rendezés költség szerint, ' + (sortDir() === 'desc' ? 'csökkenő' : 'növekvő')"
            (click)="toggleSort()">
            Költség {{ sortDir() === 'desc' ? '↓' : '↑' }}
          </button>
        </div>

        @for (inst of institutions(); track inst.schoolId) {
          <details class="card mb-3 group" data-testid="institution" [open]="searching()">
            <summary class="p-4 flex items-center justify-between gap-3 cursor-pointer list-none">
              <span class="min-w-0">
                <span class="text-text-muted text-xs mr-1 inline-block transition-transform group-open:rotate-90" aria-hidden="true">▶</span>
                <strong class="break-words">{{ inst.schoolName }}</strong>
              </span>
              <span class="text-right shrink-0 tabular-nums">
                <strong class="block">{{ fmtUsd(inst.totalUsd) }}</strong>
                <span class="text-xs text-text-muted">{{ inst.requestCount }} kérés</span>
              </span>
            </summary>
            <div class="px-4 pb-4">
              <ng-container *ngTemplateOutlet="peopleTable; context: { $implicit: inst.teachers, title: 'Tanárok' }" />
              <ng-container *ngTemplateOutlet="peopleTable; context: { $implicit: inst.students, title: 'Diákok' }" />
            </div>
          </details>
        }

        @for (g of personGroups(); track g.key) {
          <section class="card p-4 mb-3" [attr.data-testid]="'group-' + g.key">
            <ng-container *ngTemplateOutlet="peopleTable; context: { $implicit: g.people, title: g.title }" />
          </section>
        }

        @if (!searching() && r.unattributed.length) {
          <section class="card p-4 mb-3" data-testid="group-unattributed">
            <h3 class="font-bold text-sm mb-2">Nem besorolt (rendszer)</h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-text-muted uppercase">
                  <th class="text-left font-bold pb-2">Forrás</th>
                  <th class="text-right font-bold pb-2">Kérés</th>
                  <th class="text-right font-bold pb-2">Költség</th>
                </tr>
              </thead>
              <tbody>
                @for (u of unattributed(); track u.source) {
                  <tr class="border-t border-border-default">
                    <td class="py-1.5">
                      <span class="w-2 h-2 rounded-sm inline-block mr-1.5" [style.background]="sourceColor(u.source)"></span>{{ sourceLabel(u.source) }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums">{{ u.requestCount }}</td>
                    <td class="py-1.5 text-right tabular-nums font-semibold">{{ fmtUsd(u.totalUsd) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }

        @if (searching() && !institutions().length && !personGroups().length) {
          <p class="card p-6 text-center text-text-muted text-sm" data-testid="search-empty">Nincs a keresésnek megfelelő felhasználó.</p>
        }
      }
    }

    <ng-template #peopleTable let-people let-title="title">
      @if (people.length) {
        <h3 class="font-bold text-sm mt-2 mb-1">{{ title }} <span class="text-text-muted font-normal">({{ people.length }})</span></h3>
        <table class="w-full text-sm mb-2">
          <thead>
            <tr class="text-xs text-text-muted uppercase">
              <th class="text-left font-bold pb-1.5">Név</th>
              <th class="text-right font-bold pb-1.5 pl-2">Kérés</th>
              <th class="text-right font-bold pb-1.5 pl-2" [attr.aria-sort]="sortDir() === 'desc' ? 'descending' : 'ascending'">
                <button type="button" class="uppercase font-bold" (click)="toggleSort()">Költség {{ sortDir() === 'desc' ? '↓' : '↑' }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (p of people; track p.userId) {
              <tr class="border-t border-border-default align-top" data-testid="person-row">
                <td class="py-2 min-w-0">
                  <span class="block font-semibold break-words">{{ p.name }}</span>
                  <span class="block text-xs text-text-muted break-all">{{ p.email }}</span>
                  <span class="flex flex-wrap gap-1 mt-1">
                    @for (c of chips(p); track c.source) {
                      <span class="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-element px-2 py-0.5 text-[11px] text-text-muted"
                        data-testid="source-chip">
                        <span class="w-1.5 h-1.5 rounded-full inline-block" [style.background]="c.color"></span>
                        {{ c.label }} <strong class="text-text-primary tabular-nums">{{ fmtUsd(c.usd) }}</strong>
                      </span>
                    }
                  </span>
                </td>
                <td class="py-2 pl-2 text-right tabular-nums">{{ p.requestCount }}</td>
                <td class="py-2 pl-2 text-right tabular-nums font-semibold whitespace-nowrap">{{ fmtUsd(p.totalUsd) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </ng-template>
  `,
})
export class AdminAiHaviRiportComponent implements OnInit {
  private readonly svc = inject(AdminAiSpendingService);

  readonly monthOptions = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { key: monthKey(d), label: d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }) };
  });

  readonly month = signal(this.monthOptions[0].key);
  readonly report = signal<AiSpendingMonthlyReportDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly downloading = signal(false);
  readonly query = signal('');
  readonly sortDir = signal<SortDir>('desc');

  readonly searching = computed(() => this.query().trim() !== '');

  readonly isEmpty = computed(() => {
    const r = this.report();
    return (
      !!r &&
      !r.institutions.length &&
      !r.individualStudents.length &&
      !r.individualTeachers.length &&
      !r.otherUsers.length &&
      !r.unattributed.length
    );
  });

  /** Intézmények a kereséssel szűrve (az intézmény nevére is illeszt) és költség szerint rendezve. */
  readonly institutions = computed<MonthlyReportInstitutionDto[]>(() => {
    const r = this.report();
    if (!r) return [];
    const q = normalize(this.query().trim());
    const list = r.institutions
      .map((inst) =>
        !q || normalize(inst.schoolName).includes(q)
          ? { ...inst, teachers: this.sortByCost(inst.teachers), students: this.sortByCost(inst.students) }
          : { ...inst, teachers: this.filterPeople(inst.teachers, q), students: this.filterPeople(inst.students, q) },
      )
      .filter((inst) => !q || inst.teachers.length || inst.students.length);
    return this.sortByCost(list);
  });

  readonly personGroups = computed<PersonGroup[]>(() => {
    const r = this.report();
    if (!r) return [];
    const q = normalize(this.query().trim());
    return [
      { key: 'individual-students', title: 'Intézmény nélküli diákok', people: r.individualStudents },
      { key: 'individual-teachers', title: 'Intézmény nélküli tanárok', people: r.individualTeachers },
      { key: 'other-users', title: 'Egyéb felhasználók', people: r.otherUsers },
    ]
      .map((g) => ({ ...g, people: this.filterPeople(g.people, q) }))
      .filter((g) => g.people.length);
  });

  readonly unattributed = computed(() => this.sortByCost(this.report()?.unattributed ?? []));

  readonly fmtUsd = fmtUsd;
  readonly sourceLabel = sourceLabel;
  readonly sourceColor = sourceColor;

  ngOnInit(): void {
    this.load();
  }

  setMonth(month: string): void {
    if (month === this.month()) return;
    this.month.set(month);
    this.load();
  }

  toggleSort(): void {
    this.sortDir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  load(): void {
    const month = this.month();
    this.loading.set(true);
    this.error.set(null);
    this.svc.getMonthlyReport(month).subscribe({
      next: (data) => {
        if (month !== this.month()) return;
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => {
        if (month !== this.month()) return;
        this.report.set(null);
        this.error.set('A havi riport betöltése sikertelen.');
        this.loading.set(false);
      },
    });
  }

  downloadCsv(): void {
    const month = this.month();
    this.downloading.set(true);
    this.svc.downloadMonthlyReportCsv(month).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-koltes-${month}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.error.set('A CSV letöltése nem sikerült.');
        this.downloading.set(false);
      },
    });
  }

  /** Forrásonkénti bontás chipjei, a legnagyobb tétellel kezdve. */
  chips(p: MonthlyReportPersonDto): { source: string; label: string; color: string; usd: number }[] {
    return Object.entries(p.bySource)
      .sort(([, a], [, b]) => b - a)
      .map(([source, usd]) => ({ source, label: sourceLabel(source), color: sourceColor(source), usd }));
  }

  private filterPeople(people: MonthlyReportPersonDto[], q: string): MonthlyReportPersonDto[] {
    const hits = q ? people.filter((p) => normalize(`${p.name} ${p.email}`).includes(q)) : people;
    return this.sortByCost(hits);
  }

  private sortByCost<T extends { totalUsd: number }>(items: T[]): T[] {
    const sign = this.sortDir() === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => sign * (a.totalUsd - b.totalUsd));
  }
}
