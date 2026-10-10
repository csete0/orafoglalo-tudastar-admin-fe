import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminGradeDisputeService } from '../../services/admin/admin-grade-dispute.service';
import { GradeDispute, GradeDisputeFile, GradeDisputeItem, GradeItemCorrection } from '../../models/grade-dispute.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * „Szerintem hibás az értékelés” várólista (PATRICKS-TELJES-VIZSGA-TERV.md, H4): a diák indoka, a beadott fájlok (letölthetők),
 * az MI összegzése és a pontot vesztett szempontok az indokkal; lezáráskor a válasz értesítésként megy a diáknak. M2: a diák által
 * jelölt (vagy pontot vesztett) tételek tételenként javíthatók - a javítás újraszámolja az értékelést, és tanulóeset lesz belőle.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-grade-disputes',
  standalone: true,
  imports: [DatePipe, FormsModule, LocalSpinnerComponent],
  template: `
    <div class="flex gap-2 mb-6 text-sm flex-wrap">
      @for (option of filterOptions; track option.value) {
        <button (click)="setOnlyOpen(option.value)"
          class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
          [class.bg-primary]="onlyOpen() === option.value"
          [class.text-white]="onlyOpen() === option.value"
          [class.border-primary]="onlyOpen() === option.value"
          [class.border-border-default]="onlyOpen() !== option.value"
          [class.text-text-muted]="onlyOpen() !== option.value">
          {{ option.label }}
        </button>
      }
      <span class="w-px bg-border-default mx-1" aria-hidden="true"></span>
      @for (option of kindOptions; track option.label) {
        <button (click)="setKind(option.value)" [attr.aria-pressed]="kind() === option.value"
          class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
          [class.bg-primary]="kind() === option.value"
          [class.text-white]="kind() === option.value"
          [class.border-primary]="kind() === option.value"
          [class.border-border-default]="kind() !== option.value"
          [class.text-text-muted]="kind() !== option.value">
          {{ option.label }}
        </button>
      }
    </div>

    @if (error()) {
      <p class="text-danger text-sm mb-4">{{ error() }}</p>
    }
    @if (loading()) {
      <app-local-spinner />
    } @else {
      <ul class="space-y-3">
        @for (d of disputes(); track d.id) {
          <li class="card p-4" data-testid="grade-dispute-row">
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="min-w-0">
                <p class="font-semibold">{{ d.taskSetTitle }} – {{ d.taskTitle }}</p>
                <p class="text-xs text-text-muted mt-0.5">
                  {{ d.studentName || d.studentEmail }} ({{ d.studentEmail }}) ·
                  {{ d.examSessionId ? 'vizsga #' + d.examSessionId : 'gyakorlás' }}{{ d.kind === 'code' ? ' (kód/SQL)' : '' }} ·
                  {{ d.rawPoints }}/{{ d.rawTotal }} nyers pont · {{ d.model }}{{ d.rubricStatus === 'draft' ? ' · vázlat-útmutató' : '' }}
                </p>
              </div>
              <span class="text-xs text-text-muted shrink-0">{{ d.createdAt | date: 'yyyy.MM.dd HH:mm' }}</span>
            </div>

            <p class="text-sm mb-2"><span class="font-semibold">A diák szerint:</span> {{ d.reason || '(nem írt indoklást)' }}</p>
            @if (d.summary) {
              <p class="text-xs text-text-muted mb-2"><span class="font-semibold">MI-összegzés:</span> {{ d.summary }}</p>
            }

            <div class="flex flex-wrap gap-2 mb-2">
              @for (f of d.files; track f.id) {
                <button (click)="download(d, f)" class="btn btn-ghost !px-2 !py-1 !text-xs">
                  Letöltés: {{ f.name }} ({{ kb(f.sizeBytes) }} KB)
                </button>
              }
            </div>

            <details class="text-xs mb-3">
              <summary class="cursor-pointer font-semibold">Pontot vesztett szempontok ({{ lost(d).length }} / {{ d.items.length }})</summary>
              <ul class="mt-2 space-y-1">
                @for (item of lost(d); track item.itemId) {
                  <li>
                    <span class="font-semibold">{{ item.kind === 'statement' ? '✗' : item.points + '/' + item.maxPoints }}</span>
                    {{ item.text }}
                    @if (item.reason) { <span class="text-text-muted">– {{ item.reason }}</span> }
                  </li>
                }
              </ul>
            </details>

            @if (!d.resolvedAt && correctable(d).length) {
              <div class="text-xs mb-3 rounded-lg border border-border-default p-2" data-testid="grade-corrections">
                <p class="font-semibold mb-1">
                  Javítás tételenként ({{ d.disputedItemIds.length ? 'a diák által jelölt tételek' : 'a pontot vesztett tételek' }}) – csak ha a diáknak igaza van:
                </p>
                <ul class="space-y-1">
                  @for (item of correctable(d); track item.itemId) {
                    <li class="flex items-center gap-2">
                      @if (item.kind === 'statement') {
                        <label class="flex items-center gap-1 shrink-0">
                          <input type="checkbox" [ngModel]="corrected(d, item).ok" (ngModelChange)="setCorrection(d, item, null, $event)" />
                          igaz
                        </label>
                      } @else {
                        <input type="number" min="0" [max]="item.maxPoints" class="input !w-16 !py-0.5 text-xs shrink-0"
                          [attr.aria-label]="'Helyes pont: ' + item.text"
                          [ngModel]="corrected(d, item).points" (ngModelChange)="setCorrection(d, item, $event, null)" />
                        <span class="shrink-0">/ {{ item.maxPoints }}</span>
                      }
                      <span class="min-w-0">{{ item.text }} @if (item.reason) { <span class="text-text-muted">– {{ item.reason }}</span> }</span>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (d.resolvedAt) {
              <span class="badge badge-success text-xs">Lezárva {{ d.resolvedAt | date: 'yyyy.MM.dd' }}</span>
              @if (d.resolution) { <p class="text-xs text-text-muted mt-1">Válasz: {{ d.resolution }}</p> }
            } @else {
              <textarea rows="2" maxlength="1000" class="input w-full text-sm mb-2" [attr.aria-label]="'Válasz a diáknak: ' + d.taskTitle"
                placeholder="Válasz a diáknak (értesítésként kapja meg; nem kötelező)" [(ngModel)]="answers[d.id]"></textarea>
              <button (click)="resolve(d)" [disabled]="pending()" class="btn btn-primary !px-3 !py-1.5 !text-xs">Lezárás</button>
            }
          </li>
        } @empty {
          <li class="text-sm text-text-muted">Nincs {{ onlyOpen() ? 'nyitott ' : '' }}értékelési kifogás.</li>
        }
      </ul>

      @if (totalCount() > pageSize) {
        <div class="flex items-center gap-3 mt-4 text-sm">
          <button (click)="prevPage()" [disabled]="page() === 1" class="btn btn-ghost !px-3 !py-1.5">← Előző</button>
          <span>{{ page() }} / {{ totalPages() }}</span>
          <button (click)="nextPage()" [disabled]="page() >= totalPages()" class="btn btn-ghost !px-3 !py-1.5">Következő →</button>
        </div>
      }
    }
  `,
})
export class AdminGradeDisputesComponent implements OnInit {
  private readonly svc = inject(AdminGradeDisputeService);
  private readonly toast = inject(ToastService);

  readonly pageSize = 20;
  readonly disputes = signal<GradeDispute[]>([]);
  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly onlyOpen = signal(true);
  /** Fajta-szűrő: a gyakorló kód-értékelés kifogásai ugyanerre a várólistára jönnek (D9). */
  readonly kind = signal<'files' | 'code' | null>(null);
  readonly page = signal(1);
  readonly totalCount = signal(0);
  readonly totalPages = () => Math.max(1, Math.ceil(this.totalCount() / this.pageSize));
  readonly answers: Record<number, string> = {};
  /** Kifogásonként a tételek javított értéke (csak a módosítottak mennek el). */
  readonly corrections: Record<number, Record<number, GradeItemCorrection>> = {};

  readonly filterOptions = [
    { value: true, label: 'Csak nyitottak' },
    { value: false, label: 'Összes' },
  ];

  readonly kindOptions: { value: 'files' | 'code' | null; label: string }[] = [
    { value: null, label: 'Minden fajta' },
    { value: 'files', label: 'Irodai / weblap' },
    { value: 'code', label: 'Kód / SQL' },
  ];

  ngOnInit(): void {
    this.load();
  }

  setKind(value: 'files' | 'code' | null): void {
    this.kind.set(value);
    this.page.set(1);
    this.load();
  }

  setOnlyOpen(value: boolean): void {
    this.onlyOpen.set(value);
    this.page.set(1);
    this.load();
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); }
  }

  lost(d: GradeDispute): GradeDisputeItem[] {
    return d.items.filter(i => i.kind === 'statement' ? i.ok === false : i.points < i.maxPoints);
  }

  /** A javítható tételek: a diák által jelöltek, ha jelölt; különben a pontot vesztettek. */
  correctable(d: GradeDispute): GradeDisputeItem[] {
    return d.disputedItemIds.length ? d.items.filter(i => d.disputedItemIds.includes(i.itemId)) : this.lost(d);
  }

  corrected(d: GradeDispute, item: GradeDisputeItem): GradeItemCorrection {
    return this.corrections[d.id]?.[item.itemId] ?? { itemId: item.itemId, points: item.points, ok: item.ok };
  }

  setCorrection(d: GradeDispute, item: GradeDisputeItem, points: number | null, ok: boolean | null): void {
    const current = this.corrected(d, item);
    (this.corrections[d.id] ??= {})[item.itemId] = item.kind === 'statement'
      ? { ...current, points: null, ok: !!ok }
      : { ...current, points: Math.max(0, Math.min(item.maxPoints, Number(points) || 0)), ok: null };
  }

  /** Csak a ténylegesen megváltozott tételek. */
  changedCorrections(d: GradeDispute): GradeItemCorrection[] {
    return Object.values(this.corrections[d.id] ?? {}).filter(c => {
      const item = d.items.find(i => i.itemId === c.itemId)!;
      return item.kind === 'statement' ? c.ok !== item.ok : c.points !== item.points;
    });
  }

  kb(bytes: number): number {
    return Math.max(1, Math.round(bytes / 1024));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.onlyOpen(), this.page(), this.pageSize, this.kind()).subscribe({
      next: res => {
        this.disputes.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Nem sikerült betölteni a kifogásokat.');
        this.loading.set(false);
      },
    });
  }

  resolve(d: GradeDispute): void {
    this.pending.set(true);
    const corrections = this.changedCorrections(d);
    this.svc.resolve(d.id, this.answers[d.id]?.trim() || null, corrections).subscribe({
      next: () => {
        this.pending.set(false);
        this.toast.success(corrections.length
          ? `Lezárva - ${corrections.length} tétel javítva, a diák értesítést kapott.`
          : 'Lezárva - a diák értesítést kapott.');
        this.load();
      },
      error: () => { this.pending.set(false); this.toast.danger('Hiba történt.'); },
    });
  }

  download(d: GradeDispute, f: GradeDisputeFile): void {
    this.svc.file(d.id, f.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.danger('A fájl nem tölthető le.'),
    });
  }
}
