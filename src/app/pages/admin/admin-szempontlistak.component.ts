import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminRubricsService } from '../../services/admin/admin-rubrics.service';
import {
  LEVEL_LABELS,
  RUBRIC_STATUS_LABELS,
  RubricDetail,
  RubricItem,
  RubricTaskRow,
  TASK_TYPE_LABELS,
} from '../../models/rubrics.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';

/** A részletnézet blokkjai: szakaszonként az önálló szempontok és az állításcsoportok (állítások + küszöbök). */
export interface RubricBlock {
  section: string | null;
  kind: 'criterion' | 'group';
  item?: RubricItem;
  statements?: RubricItem[];
  thresholds?: RubricItem[];
}

export function toBlocks(items: RubricItem[]): RubricBlock[] {
  const blocks: RubricBlock[] = [];
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    if (item.kind === 'criterion') {
      blocks.push({ section: item.section, kind: 'criterion', item });
      continue;
    }
    let group = blocks.find((b) => b.kind === 'group' && b.statements?.[0]?.groupNo === item.groupNo
      || b.kind === 'group' && b.thresholds?.[0]?.groupNo === item.groupNo);
    if (!group) {
      group = { section: item.section, kind: 'group', statements: [], thresholds: [] };
      blocks.push(group);
    }
    (item.kind === 'statement' ? group.statements! : group.thresholds!).push(item);
  }
  return blocks;
}

/**
 * Szempontlisták (PATRICKS-TELJES-VIZSGA-TERV.md, B fázis): a hivatalos érettségi feladatok szempontlistái (az oktatas.hu
 * pontozótáblájából) - megtekintés, összeg-ellenőrzés, jóváhagyás vagy elutasítás megjegyzéssel. A jóváhagyott lista
 * alapján pontoz majd a teljes vizsga értékelése.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-szempontlistak',
  standalone: true,
  imports: [LocalSpinnerComponent],
  template: `
    <div class="max-w-7xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Szempontlisták</h1>
      <p class="text-sm text-text-muted mt-1 max-w-2xl">
        A hivatalos érettségi feladatok pontozási szempontjai az oktatas.hu javítási-értékelési útmutatója szerint. A jóváhagyott
        lista alapján pontoz majd a teljes vizsga értékelése.
      </p>
      <div class="hairline"></div>

      @if (error()) { <p class="text-danger text-sm mb-4" role="alert">{{ error() }}</p> }
      @if (loading()) {
        <app-local-spinner />
      } @else {
        <div class="flex items-center gap-4 flex-wrap mb-4 text-sm">
          <span data-testid="rubric-progress"><strong>{{ approvedCount() }}</strong> / {{ rows().length }} jóváhagyva</span>
          <label class="inline-flex items-center gap-2"><input type="checkbox" [checked]="onlyPending()" (change)="onlyPending.set(!onlyPending())" />
            Csak a jóváhagyásra várók</label>
        </div>
        <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div class="card p-3 max-h-[75vh] overflow-y-auto" data-testid="rubric-list">
            @for (r of visibleRows(); track r.taskId) {
              <button type="button" class="w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between gap-2"
                [class.bg-bg-element]="selectedId() === r.rubricId" [disabled]="!r.rubricId" (click)="open(r)" [attr.data-testid]="'rubric-row-' + r.taskId">
                <span class="min-w-0">
                  <span class="block font-semibold truncate">{{ r.setTitle }} · {{ levels[r.levelId] }}</span>
                  <span class="block text-xs text-text-muted truncate">{{ types[r.taskType] || r.taskType }} · {{ r.itemCount }} tétel</span>
                </span>
                <span class="text-xs shrink-0" [class.text-success]="r.hasApproved" [class.text-warning]="!r.hasApproved">
                  {{ r.status ? statusLabels[r.status] : 'nincs' }}</span>
              </button>
            } @empty {
              <p class="text-sm text-text-muted p-2">Nincs jóváhagyásra váró szempontlista.</p>
            }
          </div>

          <div class="card p-5 min-w-0">
            @if (detailLoading()) {
              <app-local-spinner />
            } @else if (detail(); as d) {
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 class="font-bold text-lg">{{ d.setTitle }} · {{ levels[d.levelId] }}szint · {{ types[d.taskType] || d.taskType }}</h2>
                  <p class="text-sm text-text-muted">{{ d.taskTitle }} · {{ d.version }}. verzió · {{ statusLabels[d.status] }}</p>
                </div>
                <p class="text-sm text-right" data-testid="rubric-totals">
                  Szempontok összesen: <strong>{{ d.itemPointSum }}</strong> / {{ d.rawTotal }} nyers pont<br />
                  Vizsgapont: <strong>{{ d.examPoints }}</strong> (a feladaté: {{ d.taskMaxPoints ?? '–' }})
                </p>
              </div>
              @if (d.problems.length) {
                <ul class="text-sm text-danger mt-3 list-disc pl-5" data-testid="rubric-problems">
                  @for (p of d.problems; track p) { <li>{{ p }}</li> }
                </ul>
              }
              @if (d.note) { <p class="text-sm mt-2">Megjegyzés: {{ d.note }}</p> }

              <div class="mt-4 space-y-1 text-sm" data-testid="rubric-items">
                @for (b of blocks(); track $index; let i = $index) {
                  @if (b.section && b.section !== blocks()[i - 1]?.section) {
                    <h3 class="font-bold mt-4 mb-1">{{ b.section }}</h3>
                  }
                  @if (b.kind === 'criterion') {
                    <div class="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 py-1 border-t border-border-default">
                      <span>{{ b.item!.text }}</span><span class="text-right tabular-nums">{{ b.item!.points }} p</span>
                    </div>
                  } @else {
                    <div class="py-1 border-t border-border-default" data-testid="rubric-group">
                      <ul class="list-disc pl-5 text-text-muted">
                        @for (s of b.statements; track s.id) { <li>{{ s.text }}</li> }
                      </ul>
                      @for (t of b.thresholds; track t.id) {
                        <div class="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 mt-1">
                          <span><span class="text-xs font-bold text-primary mr-1">{{ t.minCorrect ?? '?' }} / {{ b.statements!.length }}</span>{{ t.text }}</span>
                          <span class="text-right tabular-nums">{{ t.points }} p</span>
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              @if (d.status === 'draft' || d.status === 'rejected') {
                <div class="mt-6 pt-4 border-t border-border-default flex flex-col gap-2">
                  <label class="text-sm">Megjegyzés (elutasításnál kötelező)
                    <textarea class="w-full mt-1 border border-border-default rounded p-2 bg-bg-element text-sm" rows="2" maxlength="1000"
                      [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
                  </label>
                  <div class="flex gap-3">
                    <button type="button" class="btn btn-primary !py-1.5" [disabled]="busy() || d.problems.length > 0" (click)="review(true)">Jóváhagyom</button>
                    <button type="button" class="btn btn-ghost !py-1.5" [disabled]="busy() || !note().trim()" (click)="review(false)">Elutasítom</button>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-text-muted">Válassz egy feladatot a listából.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminSzempontlistakComponent implements OnInit {
  private readonly api = inject(AdminRubricsService);

  readonly levels = LEVEL_LABELS;
  readonly types = TASK_TYPE_LABELS;
  readonly statusLabels = RUBRIC_STATUS_LABELS;
  readonly rows = signal<RubricTaskRow[]>([]);
  readonly onlyPending = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly detail = signal<RubricDetail | null>(null);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly note = signal('');
  readonly error = signal<string | null>(null);

  readonly approvedCount = computed(() => this.rows().filter((r) => r.hasApproved).length);
  readonly visibleRows = computed(() => (this.onlyPending() ? this.rows().filter((r) => !r.hasApproved) : this.rows()));
  readonly blocks = computed(() => toBlocks(this.detail()?.items ?? []));

  ngOnInit(): void {
    this.api.listOfficial().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('A szempontlisták betöltése nem sikerült.');
        this.loading.set(false);
      },
    });
  }

  open(row: RubricTaskRow): void {
    if (!row.rubricId) return;
    this.selectedId.set(row.rubricId);
    this.note.set('');
    this.detailLoading.set(true);
    this.api.get(row.rubricId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: () => {
        this.error.set('A szempontlista betöltése nem sikerült.');
        this.detailLoading.set(false);
      },
    });
  }

  review(approve: boolean): void {
    const d = this.detail();
    if (!d) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.review(d.id, approve, this.note().trim() || null).subscribe({
      next: (updated) => {
        this.detail.set(updated);
        this.rows.update((rows) => rows.map((r) => (r.rubricId === updated.id
          ? { ...r, status: updated.status, hasApproved: r.hasApproved || updated.status === 'approved' } : r)));
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.errorMessage ?? 'A művelet nem sikerült.');
        this.busy.set(false);
      },
    });
  }
}
