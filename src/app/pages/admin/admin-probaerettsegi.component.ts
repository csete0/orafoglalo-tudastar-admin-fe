import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminMockExamService } from '../../services/admin/admin-mock-exam.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';
import {
  AdminMockExam, AdminMockExamSourceRow, AdminMockExamStatus, AdminMockExamTaskSetOption, AdminMockExamUpsert, asUtc, toBudapestInput,
} from '../../models/mock-exam.model';

/** Konverzió (0–100), ha van nevező. */
export function conversion(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((100 * part) / whole) : null;
}

const LIVE_REFRESH_MS = 60_000;
const DAY_LABELS = ['1. nap', '2. nap', '3. nap', '4. nap', '5. nap', '6. nap', '7. nap'];

/**
 * Próbaérettségi – admin (PATRICKS-PROBAERETTSEGI-TERV.md F): esemény létrehozása/módosítása (budapesti idővel), sötét indítás,
 * élő státusz (kitöltés, értékelési sor és hibák, keret-sáv 50/80%-kal, „Keret emelése”), kényszerített közzététel,
 * felszabadítás, és a marketing-megtérülés forrás-tölcsérrel. Az esemény hetében 60 mp-enként frissül.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-probaerettsegi',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LocalSpinnerComponent],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Próbaérettségi</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">Esemény, kitöltés, MI-keret és megtérülés. Az időpontokat budapesti idővel add meg.</p>
      <div class="hairline"></div>

      @if (loading()) {
        <app-local-spinner />
      } @else {
        <div class="flex items-center gap-2 flex-wrap mb-5">
          @for (e of events(); track e.id) {
            <button type="button" class="btn" [class.btn-primary]="selected()?.id === e.id" [class.btn-ghost]="selected()?.id !== e.id" (click)="select(e)">
              {{ e.title }} @if (!e.isPublished) { <span class="badge badge-neutral ml-1">rejtett</span> }
            </button>
          }
          <button type="button" class="btn btn-ghost" (click)="startCreate()" data-testid="mock-new">+ Új esemény</button>
        </div>

        @if (form(); as f) {
          <form #mf="ngForm" class="card p-5 mb-6 grid gap-3 md:grid-cols-2" (ngSubmit)="save(mf.valid === true)" data-testid="mock-form">
            <h2 class="font-bold md:col-span-2">{{ editingId() ? 'Esemény módosítása' : 'Új esemény' }}</h2>
            @if (editingHasSessions()) {
              <p class="text-xs text-warning md:col-span-2">Már elindult: csak a cím, az eredmény és a gyakorló időpontja módosítható. A keretet a „Keret emelése” gombbal.</p>
            }
            <label class="text-sm">Cím<input class="input" name="title" [(ngModel)]="f.title" required maxlength="120" /></label>
            <label class="text-sm">Azonosító (slug)<input class="input" name="slug" [(ngModel)]="f.slug" required pattern="[a-z0-9-]{3,60}" /></label>
            <label class="text-sm">Jelentkezés nyílik<input class="input" type="datetime-local" name="reg" [(ngModel)]="f.registrationOpensAt" required /></label>
            <label class="text-sm">Kezdés nyílik<input class="input" type="datetime-local" name="opens" [(ngModel)]="f.opensAt" required /></label>
            <label class="text-sm">Kezdési határ<input class="input" type="datetime-local" name="closes" [(ngModel)]="f.startClosesAt" required /></label>
            <label class="text-sm">Eredmény közzététele<input class="input" type="datetime-local" name="results" [(ngModel)]="f.resultsPlannedAt" required /></label>
            <label class="text-sm">Gyakorlóként felszabadul<input class="input" type="datetime-local" name="practice" [(ngModel)]="f.practiceReleaseAt" required /></label>
            <label class="text-sm">MI-összkeret ($)<input class="input" type="number" min="0" step="1" name="budget" [(ngModel)]="f.totalBudgetUsd" /></label>
            <label class="text-sm">Középszint feladatsora
              <select class="input" name="kozep" [(ngModel)]="f.kozepTaskSetId">
                @for (o of taskSetOptions(); track o.id) { <option [ngValue]="o.id">#{{ o.id }} {{ o.title }}</option> }
              </select></label>
            <label class="text-sm">Emelt szint feladatsora
              <select class="input" name="emelt" [(ngModel)]="f.emeltTaskSetId">
                @for (o of taskSetOptions(); track o.id) { <option [ngValue]="o.id">#{{ o.id }} {{ o.title }}</option> }
              </select></label>
            <label class="text-sm">Közép időkeret (perc)<input class="input" type="number" min="10" max="300" name="kozepMin" [ngModel]="f.kozepTimeLimitSeconds / 60" (ngModelChange)="f.kozepTimeLimitSeconds = $event * 60" /></label>
            <label class="text-sm">Emelt időkeret (perc)<input class="input" type="number" min="10" max="300" name="emeltMin" [ngModel]="f.emeltTimeLimitSeconds / 60" (ngModelChange)="f.emeltTimeLimitSeconds = $event * 60" /></label>
            <label class="text-sm">Jelvény-előtag (pl. MOCKEXAM_2026OSZ)<input class="input" name="badge" [(ngModel)]="f.badgeKeyPrefix" pattern="[A-Z0-9_]{3,40}" /></label>
            <div class="md:col-span-2 flex gap-2 justify-end">
              <button type="button" class="btn btn-ghost" (click)="form.set(null)">Mégse</button>
              <button type="submit" class="btn btn-primary" [disabled]="busy()">Mentés</button>
            </div>
          </form>
        }

        @if (status(); as s) {
          <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 class="text-lg font-bold">{{ s.event.title }}</h2>
              <p class="text-xs text-text-muted">
                kezdhető {{ asUtc(s.event.opensAt) | date: 'MMM d. HH:mm' }} – {{ asUtc(s.event.startClosesAt) | date: 'MMM d. HH:mm' }} ·
                eredmény {{ asUtc(s.event.resultsPlannedAt) | date: 'MMM d. HH:mm' }}
                @if (s.event.resultsPublishedAt) { · <span class="text-success font-semibold">közzétéve</span> }
                @if (s.event.releasedAsPracticeAt) { · <span class="text-success font-semibold">gyakorlóként kint</span> }
              </p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button type="button" class="btn btn-ghost" (click)="startEdit(s.event)">Módosítás</button>
              <button type="button" class="btn" [class.btn-primary]="!s.event.isPublished" [class.btn-ghost]="s.event.isPublished" (click)="togglePublished(s.event)"
                      data-testid="mock-publish">{{ s.event.isPublished ? 'Elrejtés' : 'Közzététel (sötét indítás vége)' }}</button>
              @if (!s.event.resultsPublishedAt) {
                <button type="button" class="btn btn-ghost" (click)="publishResults(s.event)">Eredmény közzététele most</button>
              } @else if (!s.event.releasedAsPracticeAt) {
                <button type="button" class="btn btn-ghost" (click)="releasePractice(s.event)">Felszabadítás gyakorlóként</button>
              }
              @if (!s.event.hasSessions) {
                <button type="button" class="btn btn-danger" (click)="remove(s.event)">Törlés</button>
              }
            </div>
          </div>

          <div class="grid gap-3 grid-cols-2 md:grid-cols-6 mb-4" data-testid="mock-kpis">
            <div class="card p-4"><p class="text-xs text-text-muted">Jelentkezett</p><p class="text-2xl font-bold tabular-nums">{{ s.registrations.kozep + s.registrations.emelt }}</p>
              <p class="text-xs text-text-muted">közép {{ s.registrations.kozep }} · emelt {{ s.registrations.emelt }}</p></div>
            <div class="card p-4"><p class="text-xs text-text-muted">Tanári</p><p class="text-2xl font-bold tabular-nums">{{ s.registrations.teacherSourced }}</p>
              <p class="text-xs text-text-muted">{{ s.registrations.groups }} csoport</p></div>
            <div class="card p-4"><p class="text-xs text-text-muted">Elkezdte</p><p class="text-2xl font-bold tabular-nums">{{ s.started }}</p>
              <p class="text-xs text-text-muted">most írja: {{ s.inProgress }}</p></div>
            <div class="card p-4"><p class="text-xs text-text-muted">Beadta</p><p class="text-2xl font-bold tabular-nums">{{ s.submitted }}</p>
              <p class="text-xs text-text-muted">elhagyta: {{ s.abandoned }}</p></div>
            <div class="card p-4"><p class="text-xs text-text-muted">Értékelve</p><p class="text-2xl font-bold tabular-nums">{{ s.graded }}</p>
              <p class="text-xs text-text-muted">vár: {{ s.pendingGrading }}</p></div>
            <div class="card p-4"><p class="text-xs text-text-muted">Jelvény</p><p class="text-2xl font-bold tabular-nums">{{ s.badgesAwarded.participant }}</p>
              <p class="text-xs text-text-muted">ezüst {{ s.badgesAwarded.silver }} · arany {{ s.badgesAwarded.gold }}</p></div>
          </div>

          <div class="card p-5 mb-4" data-testid="mock-budget">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <h3 class="font-bold">MI-keret
                @if (s.budgetAlerts.exhausted) { <span class="badge badge-danger ml-1">elfogyott</span> }
                @else if (s.budgetAlerts.at80) { <span class="badge badge-warning ml-1">80%</span> }
                @else if (s.budgetAlerts.at50) { <span class="badge badge-neutral ml-1">50%</span> }
              </h3>
              <button type="button" class="btn btn-primary" (click)="raiseBudget(s)" data-testid="mock-raise">Keret emelése</button>
            </div>
            <div class="relative h-3 rounded-full bg-bg-element mt-3" role="img"
                 [attr.aria-label]="'Elköltve ' + s.costTotalUsd + ' $ / ' + s.totalBudgetUsd + ' $, vetítve ' + s.projectedTotalUsd + ' $'">
              <span class="absolute inset-y-0 left-0 rounded-full" [class.bg-danger]="s.budgetUsedPercent >= 80" [class.bg-primary]="s.budgetUsedPercent < 80"
                    [style.width.%]="clamp(s.budgetUsedPercent)"></span>
              <span class="absolute -inset-y-1 w-0.5 bg-text-muted" style="left: 50%" title="50%"></span>
              <span class="absolute -inset-y-1 w-0.5 bg-warning" style="left: 80%" title="80%"></span>
              @if (s.totalBudgetUsd > 0) {
                <span class="absolute -inset-y-1.5 w-0.5 bg-text-primary" [style.left.%]="clamp(100 * s.projectedTotalUsd / s.totalBudgetUsd)" title="vetített összköltés"></span>
              }
            </div>
            <p class="text-sm mt-2 tabular-nums">
              <strong>{{ s.costTotalUsd | number: '1.2-2' }} $</strong> / {{ s.totalBudgetUsd | number: '1.0-2' }} $ ({{ s.budgetUsedPercent }}%) · ma {{ s.costTodayUsd | number: '1.2-2' }} $ ·
              vetítve {{ s.projectedTotalUsd | number: '1.0-2' }} $
            </p>
            @if (s.queuedForAi.count) {
              <p class="text-sm text-warning mt-1" data-testid="mock-queue">
                MI-re vár: {{ s.queuedForAi.count }} beadás (a legrégebbi {{ asUtc(s.queuedForAi.oldestSubmittedAt!) | date: 'MMM d. HH:mm' }}) - a kiürítéshez kb. {{ s.neededToClearQueueUsd | number: '1.0-2' }} $ kell.
              </p>
            }
            <p class="text-xs text-text-muted mt-1">Értékelő sor (Hangfire): {{ s.queueLength < 0 ? 'nem olvasható' : s.queueLength }}</p>
          </div>

          <div class="grid gap-4 md:grid-cols-2 mb-4">
            <div class="card p-5">
              <h3 class="font-bold mb-2">A hét napjai</h3>
              <table class="w-full text-sm">
                <thead><tr class="text-left text-xs text-text-muted"><th class="py-1">Nap</th><th class="text-right">Indult</th><th class="text-right">Beadva</th><th class="pl-3">%-eloszlás (0–100)</th></tr></thead>
                <tbody>
                  @for (d of dayLabels; track $index; let i = $index) {
                    <tr class="border-t border-border-default">
                      <td class="py-1">{{ d }}</td><td class="text-right tabular-nums">{{ s.dailyStarts[i] }}</td><td class="text-right tabular-nums">{{ s.dailySubmits[i] }}</td>
                      <td class="pl-3"><span class="inline-flex items-end gap-px h-5" [attr.aria-label]="'eloszlás: ' + s.dailyPercentHistogram[i].join(', ')">
                        @for (b of s.dailyPercentHistogram[i]; track $index) {
                          <span class="w-1.5 bg-primary rounded-t-sm" [style.height.%]="barHeight(b, s.dailyPercentHistogram[i])"></span>
                        }
                      </span></td>
                    </tr>
                  }
                </tbody>
              </table>
              <p class="text-xs text-text-muted mt-2">Ha egy napon az eloszlás hirtelen felfelé tolódik, a feladatok kiszivároghattak.</p>
            </div>
            <div class="card p-5">
              <h3 class="font-bold mb-2">Értékelési hibák ({{ s.gradingErrors.length }})</h3>
              @for (e of s.gradingErrors; track $index) {
                <p class="text-sm border-t border-border-default py-1"><span class="text-text-muted">#{{ e.sessionId }}</span> {{ e.taskTitle }} – {{ e.error ?? 'ismeretlen hiba' }}</p>
              } @empty {
                <p class="text-sm text-text-muted">Nincs hiba.</p>
              }
            </div>
          </div>

          <div class="card p-5" data-testid="mock-marketing">
            <h3 class="font-bold">Marketing</h3>
            @if (!s.marketing.roiAvailable) {
              <p class="text-xs text-text-muted mt-0.5">A megtérülés (fizetők, bevétel) a közzététel után számolódik. Tesztfiókok nélkül.</p>
            }
            <div class="grid gap-3 grid-cols-2 md:grid-cols-6 mt-3">
              <div><p class="text-xs text-text-muted">Új fiók az eseményből</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.newAccountsFromEvent }}</p>
                <p class="text-xs text-text-muted">tanárin át: {{ s.marketing.newAccountsViaTeacher }}</p></div>
              <div><p class="text-xs text-text-muted">Fizető 7 nap</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.payers7 }}</p></div>
              <div><p class="text-xs text-text-muted">Fizető 30 nap</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.payers30 }}</p>
                <p class="text-xs text-text-muted">{{ s.marketing.participants }} résztvevőből</p></div>
              <div><p class="text-xs text-text-muted">Bevétel 30 nap</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.revenue30 | number: '1.0-0' }} Ft</p></div>
              <div><p class="text-xs text-text-muted">MI-költség</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.aiCostUsd | number: '1.2-2' }} $</p></div>
              <div><p class="text-xs text-text-muted">Bevétel / MI-költség</p><p class="text-xl font-bold tabular-nums">{{ s.marketing.revenueToAiCostRatio === null ? '–' : (s.marketing.revenueToAiCostRatio | number: '1.1-1') + '×' }}</p></div>
            </div>
            <div class="overflow-x-auto mt-4">
              <table class="w-full text-sm" data-testid="mock-sources">
                <thead><tr class="text-left text-xs text-text-muted">
                  <th class="py-2 pr-3">Forrás</th><th class="pr-3">Jelentkező → induló → beadó → fizető (30 nap)</th><th class="pr-3 text-right">Bevétel</th>
                </tr></thead>
                <tbody>
                  @for (r of s.marketing.bySource; track r.source) {
                    <tr class="border-t border-border-default">
                      <td class="py-1.5 pr-3 whitespace-nowrap">{{ sourceLabel(r.source) }}</td>
                      <td class="pr-3">
                        <div class="flex items-center gap-2 text-xs tabular-nums">
                          @for (step of funnel(r); track step.label) {
                            <span class="inline-flex items-center gap-1" [title]="step.label">
                              <span class="h-2 rounded-full bg-primary" [style.width.px]="step.width"></span>{{ step.value }}
                              @if (step.rate !== null) { <span class="text-text-muted">({{ step.rate }}%)</span> }
                            </span>
                          }
                        </div>
                      </td>
                      <td class="pr-3 text-right tabular-nums">{{ r.revenue30 | number: '1.0-0' }} Ft</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="py-3 text-text-muted">Még nincs jelentkező.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else if (!form() && !events().length) {
          <p class="text-text-muted">Még nincs próbaérettségi. Hozz létre egyet az „Új esemény” gombbal.</p>
        }
      }
    </div>
  `,
})
export class AdminProbaerettsegiComponent implements OnInit {
  private readonly api = inject(AdminMockExamService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<AdminMockExam[]>([]);
  readonly taskSetOptions = signal<AdminMockExamTaskSetOption[]>([]);
  readonly selected = signal<AdminMockExam | null>(null);
  readonly status = signal<AdminMockExamStatus | null>(null);
  readonly form = signal<AdminMockExamUpsert | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly dayLabels = DAY_LABELS;
  readonly asUtc = asUtc;
  readonly editingHasSessions = computed(() => !!this.editingId() && !!this.events().find((e) => e.id === this.editingId())?.hasSessions);

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loading.set(false);
    const timer = setInterval(() => {
      const ev = this.selected();
      // Élő frissítés az esemény hetében (és az eredményig).
      if (ev && Date.now() >= asUtc(ev.opensAt).getTime() && Date.now() <= asUtc(ev.resultsPlannedAt).getTime() + 86_400_000) void this.loadStatus(ev.id);
    }, LIVE_REFRESH_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async reload(selectId?: number): Promise<void> {
    try {
      const events = await firstValueFrom(this.api.list());
      this.events.set(events);
      const pick = events.find((e) => e.id === (selectId ?? this.selected()?.id)) ?? events[0] ?? null;
      if (pick) await this.select(pick);
    } catch (err) {
      this.toast.danger(extractErrorMessage(err, 'A próbaérettségik betöltése nem sikerült.'));
    }
  }

  async select(e: AdminMockExam): Promise<void> {
    this.selected.set(e);
    await this.loadStatus(e.id);
  }

  private async loadStatus(id: number): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.status(id)));
    } catch (err) {
      this.toast.danger(extractErrorMessage(err, 'A státusz betöltése nem sikerült.'));
    }
  }

  async startCreate(): Promise<void> {
    await this.loadOptions();
    this.editingId.set(null);
    this.form.set({
      slug: '', title: '', registrationOpensAt: '', opensAt: '', startClosesAt: '', resultsPlannedAt: '', practiceReleaseAt: '',
      kozepTaskSetId: this.taskSetOptions()[0]?.id ?? 0, emeltTaskSetId: this.taskSetOptions()[1]?.id ?? 0,
      kozepTimeLimitSeconds: 10800, emeltTimeLimitSeconds: 14400, totalBudgetUsd: 500, badgeKeyPrefix: null,
    });
  }

  async startEdit(e: AdminMockExam): Promise<void> {
    await this.loadOptions();
    // A saját (már esetleg közzétett) sorai is választhatók maradjanak.
    for (const id of [e.kozepTaskSetId, e.emeltTaskSetId]) {
      if (!this.taskSetOptions().some((o) => o.id === id)) this.taskSetOptions.update((all) => [{ id, title: '(az esemény sora)', level: null }, ...all]);
    }
    this.editingId.set(e.id);
    this.form.set({
      slug: e.slug, title: e.title, registrationOpensAt: toBudapestInput(e.registrationOpensAt), opensAt: toBudapestInput(e.opensAt),
      startClosesAt: toBudapestInput(e.startClosesAt), resultsPlannedAt: toBudapestInput(e.resultsPlannedAt),
      practiceReleaseAt: toBudapestInput(e.practiceReleaseAt), kozepTaskSetId: e.kozepTaskSetId, emeltTaskSetId: e.emeltTaskSetId,
      kozepTimeLimitSeconds: e.kozepTimeLimitSeconds, emeltTimeLimitSeconds: e.emeltTimeLimitSeconds, totalBudgetUsd: e.totalBudgetUsd,
      badgeKeyPrefix: e.badgeKeyPrefix,
    });
  }

  private async loadOptions(): Promise<void> {
    if (!this.taskSetOptions().length) this.taskSetOptions.set(await firstValueFrom(this.api.taskSetOptions()));
  }

  async save(valid = true): Promise<void> {
    const f = this.form();
    if (!f) return;
    // Üres időpontnál a szerver nyers, angol JSON-hibát adna - előbb itt, érthetően.
    if (!valid) {
      this.toast.danger('Tölts ki minden kötelező mezőt: a cím, az azonosító és mind az öt időpont (a „Gyakorlóként felszabadul” is) kötelező.');
      return;
    }
    const request = { ...f, badgeKeyPrefix: f.badgeKeyPrefix?.trim() || null };
    await this.run(async () => {
      const id = this.editingId();
      const saved = await firstValueFrom(id ? this.api.update(id, request) : this.api.create(request));
      this.form.set(null);
      this.toast.success(id ? 'Mentve.' : 'Létrehozva (rejtve - a közzétételig csak admin látja).');
      await this.reload(saved.id);
    });
  }

  async togglePublished(e: AdminMockExam): Promise<void> {
    if (!e.isPublished && !(await this.confirm.ask({
      title: 'Közzéteszed az eseményt?', message: 'Utána mindenki látja a /probaerettsegi oldalon, és jelentkezhet.', confirmLabel: 'Közzététel',
    }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.setPublished(e.id, !e.isPublished));
      await this.reload(e.id);
    });
  }

  async raiseBudget(s: AdminMockExamStatus): Promise<void> {
    const suggested = Math.ceil(s.totalBudgetUsd + Math.max(s.neededToClearQueueUsd, s.totalBudgetUsd * 0.2));
    const input = window.prompt(`Új MI-összkeret ($) - most ${s.totalBudgetUsd} $, a sor kiürítéséhez kb. ${s.neededToClearQueueUsd} $ kell:`, String(suggested));
    if (input === null) return;
    const amount = Number(input.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= s.totalBudgetUsd) {
      this.toast.danger(`A keret csak emelhető (most ${s.totalBudgetUsd} $).`);
      return;
    }
    if (!(await this.confirm.ask({
      title: 'Emeled a keretet?', message: `${s.totalBudgetUsd} $ → ${amount} $. A várakozó beadások ezután azonnal értékelődnek.`, confirmLabel: 'Emelés',
    }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.raiseBudget(s.event.id, amount));
      this.toast.success('Keret emelve - a várakozó beadások értékelése elindult.');
      await this.loadStatus(s.event.id);
    });
  }

  async publishResults(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Közzéteszed most az eredményt?', message: 'A rangsor most rögzül; a később értékelt beadások ehhez mérve kapnak helyezést.', confirmLabel: 'Közzététel', danger: true,
    }))) return;
    await this.run(async () => {
      const done = await firstValueFrom(this.api.publishResults(e.id));
      this.toast.success(done ? 'Az eredmény közzétéve.' : 'Már közzé volt téve.');
      await this.reload(e.id);
    });
  }

  async releasePractice(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Felszabadítod gyakorlóként?', message: 'A két feladatsor (fizetős) gyakorlóként megjelenik a „Próbaérettségi feladatsorok” kategóriában.', confirmLabel: 'Felszabadítás',
    }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.releasePractice(e.id));
      this.toast.success('Felszabadítva.');
      await this.reload(e.id);
    });
  }

  async remove(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Törlöd az eseményt?', message: e.title, confirmLabel: 'Törlés', danger: true }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.delete(e.id));
      this.selected.set(null);
      this.status.set(null);
      await this.reload();
    });
  }

  clamp(percent: number): number {
    return Math.max(0, Math.min(100, percent));
  }

  barHeight(value: number, all: number[]): number {
    const max = Math.max(1, ...all);
    return value === 0 ? 4 : Math.max(10, (100 * value) / max);
  }

  sourceLabel(source: string): string {
    if (source === 'self') return 'Önálló (UTM nélkül)';
    if (source === 'teacher') return 'Tanári jelentkeztetés';
    return source.replace(/^utm:/, 'UTM: ');
  }

  /** A forrás tölcsére: jelentkező → induló → beadó → fizető (30 nap), az előző lépéshez mért %-kal. */
  funnel(r: AdminMockExamSourceRow): { label: string; value: number; rate: number | null; width: number }[] {
    const top = Math.max(1, r.registered);
    const steps = [
      { label: 'jelentkező', value: r.registered, prev: null as number | null },
      { label: 'induló', value: r.started, prev: r.registered },
      { label: 'beadó', value: r.submitted, prev: r.started },
      { label: 'fizető (30 nap)', value: r.payers30, prev: r.submitted },
    ];
    return steps.map((s) => ({ label: s.label, value: s.value, rate: s.prev === null ? null : conversion(s.value, s.prev),
      width: Math.max(2, Math.round((60 * s.value) / top)) }));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.toast.danger(extractErrorMessage(err, 'A művelet nem sikerült.'));
    } finally {
      this.busy.set(false);
    }
  }
}
