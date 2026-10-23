import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAiSpendingService } from '../../services/admin/admin-ai-spending.service';
import {
  AutomationStatusDto,
  MAINTENANCE_ACTION_BADGES,
  MAINTENANCE_ACTION_LABELS,
  QuizMaintenanceDecisionDto,
  QuizMaintenanceRunDto,
} from '../../models/ai-spending.model';
import { AdminAiHaviRiportComponent } from './admin-ai-havi-riport.component';
import { AiKoltesOverviewComponent } from './ai-koltes/ai-koltes-overview.component';
import { AiKoltesOverviewState } from './ai-koltes/ai-koltes-overview.state';
import { AiKoltesRequestLogComponent } from './ai-koltes/ai-koltes-request-log.component';
import { AiKoltesRequestLogState } from './ai-koltes/ai-koltes-request-log.state';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { TabBarComponent, TabItem } from '../../shared/tab-bar/tab-bar.component';
import { UsdPipe } from '../../shared/format/usd.pipe';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';

type Tab = 'attekintes' | 'havi-riport' | 'naplo' | 'karbantartas' | 'eredmenyek' | 'automatizmus';

/**
 * AI-KOLTES-PULT: platform-admin "AI-költés Pult" - kérésenkénti OpenRouter-
 * költés (AiRequestLog) áttekintése, kvíz-kérdés karbantartás kézi indítása/
 * eredmény-kezelése (a korábbi 2-naponkénti automatikus Hangfire-ütemezés
 * 2026-09-21-én megszűnt - innentől KIZÁRÓLAG erről a felületről indítható),
 * és egyéb token-fogyasztó automatizmusok (tanulási terv, napi kihívás)
 * kézi újraindítása.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-ai-koltes',
  imports: [
    DatePipe,
    FormsModule,
    LocalSpinnerComponent,
    TabBarComponent,
    UsdPipe,
    AdminAiHaviRiportComponent,
    AiKoltesOverviewComponent,
    AiKoltesRequestLogComponent,
  ],
  // Fül-szintű állapot: a pulttal él, így fülváltáskor megmarad (lusta betöltés, szűrő, oldal, 7/30 nap).
  providers: [AiKoltesOverviewState, AiKoltesRequestLogState],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">AI-költés és automatizmusok</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        Minden AI-hívás (OpenRouter) kérésenkénti költsége, a saját és az automata felhasználás,
        valamint a token-fogyasztó háttérfolyamatok kézi indítása egy helyen.
      </p>
      <div class="hairline"></div>

      <nav app-tab-bar class="flex gap-5 border-b border-border-default mb-6 overflow-x-auto" role="tablist"
        [tabs]="tabs" [active]="activeTab()" (activeChange)="setTab($event)"></nav>

      @switch (activeTab()) {
        @case ('attekintes') {
          <app-ai-koltes-overview />
        }
        @case ('havi-riport') {
          <app-admin-ai-havi-riport />
        }
        @case ('naplo') {
          <app-ai-koltes-request-log />
        }
        <!-- ══════════════════ KVÍZ-KARBANTARTÁS ══════════════════ -->
        @case ('karbantartas') {
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
                  [(ngModel)]="maintenanceForm.rangeStartId" (ngModelChange)="estimate.set(null)" />
              </div>
              <div>
                <label class="text-xs text-text-muted block mb-1">Kérdés-tartomány vége</label>
                <input class="input" type="number" placeholder="üresen: alapértelmezett minta"
                  [(ngModel)]="maintenanceForm.rangeEndId" (ngModelChange)="estimate.set(null)" />
              </div>
              <div>
                <label class="text-xs text-text-muted block mb-1">Modell</label>
                <select class="input" [(ngModel)]="maintenanceForm.model" (ngModelChange)="estimate.set(null)">
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (olcsó, alap)</option>
                  <option value="openai/gpt-4o">openai/gpt-4o (pontosabb)</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-text-muted block mb-1">Mód</label>
                <select class="input" [ngModel]="maintenanceForm.dryRun" (ngModelChange)="maintenanceForm.dryRun = $event">
                  <option [ngValue]="true">Próbafuttatás (dry-run, nem ír adatot)</option>
                  <option [ngValue]="false">Éles futtatás</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 mt-4 flex-wrap">
              <div class="text-xs text-text-muted">
                @if (estimating()) {
                  Becslés...
                } @else if (estimate(); as est) {
                  Becsült költség: <strong class="text-text-primary">{{ est.estimatedCostUsd | usd }}</strong>
                  ({{ est.candidateCount }} kérdés · {{ maintenanceForm.model }})
                } @else {
                  <button type="button" class="underline" (click)="loadEstimate()">Költség-becslés lekérése</button>
                }
              </div>
              <button type="button" class="btn btn-primary" [disabled]="running()" (click)="runMaintenance()">
                {{ running() ? 'Indítás...' : 'Futtatás indítása' }}
              </button>
            </div>
          </div>

          <h2 class="font-bold mb-1">Futtatási előzmények</h2>
          <p class="text-xs text-text-muted mb-3">Kézi és korábbi automata futások.</p>

          @if (runsLoading()) {
            <app-local-spinner />
          } @else {
            <div class="card divide-y divide-border-default">
              @for (run of runs(); track run.id) {
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
                    <!-- UI-TT-236: korábban egy futás-közbeni hiba a sort örökre
                         "folyamatban…" állapotban hagyta, admin-jelzés nélkül -
                         most a tényleges hibaüzenet is látszik. -->
                    @if (run.errorMessage) {
                      <p class="text-xs text-danger mt-1">{{ run.errorMessage }}</p>
                    }
                  </div>
                  <button type="button" class="btn btn-ghost !border !border-border-default !px-3 !py-1.5 !text-xs shrink-0"
                    (click)="openRunDecisions(run.id)">
                    Eredmények
                  </button>
                </div>
              } @empty {
                <p class="p-6 text-center text-text-muted text-sm">Még nem volt karbantartó-futás.</p>
              }
            </div>
          }
        }

        <!-- ══════════════════ EREDMÉNYEK KEZELÉSE ══════════════════ -->
        @case ('eredmenyek') {
          <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 class="font-bold text-lg">Karbantartási eredmények</h2>
              @if (selectedRunId()) {
                <p class="text-xs text-text-muted mt-0.5">Futás: #{{ selectedRunId()!.slice(0, 8) }}</p>
              } @else {
                <p class="text-xs text-text-muted mt-0.5">Válassz egy futást a Kvíz-karbantartás fülön ("Eredmények" gomb).</p>
              }
            </div>
          </div>

          @if (selectedRunId()) {
            <div class="flex gap-2 mb-4 flex-wrap text-xs">
              <button type="button" class="btn btn-ghost !px-3 !py-1.5" [class.!bg-bg-element]="!decisionActionFilter()"
                (click)="setDecisionFilter(null)">Mind ({{ decisions().length }})</button>
              @for (a of maintenanceActions; track a) {
                <button type="button" class="btn btn-ghost !px-3 !py-1.5" [class.!bg-bg-element]="decisionActionFilter() === a"
                  (click)="setDecisionFilter(a)">
                  {{ actionLabel(a) }} ({{ countByAction(a) }})
                </button>
              }
            </div>

            <div class="flex items-center gap-3 mb-3">
              <span class="text-xs text-text-muted">
                {{ selectedForMerge().size === 2 ? '2 kérdés kijelölve - összevonhatók.' : 'Jelölj ki 2 kérdést az összevonáshoz (' + selectedForMerge().size + '/2).' }}
              </span>
              <button type="button" class="btn btn-primary !px-3 !py-1.5 !text-xs" [disabled]="selectedForMerge().size !== 2"
                (click)="openMergeModal()">
                Kijelöltek összevonása
              </button>
            </div>

            @if (decisionsLoading()) {
              <app-local-spinner />
            } @else {
              <div class="card divide-y divide-border-default">
                @for (d of filteredDecisions(); track d.questionId) {
                  <div class="p-4">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <input type="checkbox" [checked]="selectedForMerge().has(d.questionId)"
                        (change)="toggleMergeSelection(d.questionId)" />
                      <span class="badge" [class]="actionBadgeClass(d.action)">{{ actionLabel(d.action) }}</span>
                      @if (d.isTeacherOwned) {
                        <span class="badge badge-neutral">{{ d.teacherName }} tanár kérdése</span>
                      } @else {
                        <span class="badge badge-neutral">közös bank</span>
                      }
                    </div>
                    <p class="text-sm">{{ d.newQuestionText || d.oldQuestionText }}</p>
                    @if (d.reasoning) {
                      <p class="text-xs text-text-muted italic mt-1">{{ d.reasoning }}</p>
                    }
                    <div class="mt-2">
                      <button type="button" class="btn btn-danger !px-3 !py-1 !text-xs" (click)="deactivateQuestion(d)">Törlés</button>
                    </div>
                  </div>
                } @empty {
                  <p class="p-6 text-center text-text-muted text-sm">Nincs ebbe a szűrésbe eső döntés.</p>
                }
              </div>
            }
          }
        }

        <!-- ══════════════════ EGYÉB AUTOMATIZMUSOK ══════════════════ -->
        @case ('automatizmus') {
          <h2 class="font-bold text-lg mb-1">Token-fogyasztó háttérfolyamatok</h2>
          <p class="text-xs text-text-muted mb-4">
            A projektben jelenleg ez a 2 ütemezett feladat + 1 tanár-indított funkció éget AI-tokent
            az automata kvíz-karbantartáson kívül.
          </p>

          @if (automationLoading()) {
            <app-local-spinner />
          } @else {
            @for (a of automationStatus(); track a.key) {
              <div class="card p-4 mb-3 flex gap-4 items-start">
                <div class="icon-tile icon-tile-warning">
                  <span class="text-lg" aria-hidden="true">⏱</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex justify-between gap-3 flex-wrap items-baseline">
                    <h3 class="font-bold text-sm">{{ automationTitle(a.key) }}</h3>
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
                    [disabled]="triggering() === a.key" (click)="triggerAutomation(a.key)">
                    {{ triggering() === a.key ? 'Indítás...' : 'Kézi újraindítás most' }}
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
        }
      }
    </div>

    <!-- ── Összevonás modal ── -->
    @if (mergeModalOpen()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" (click)="closeMergeModal()">
        <div class="card w-full max-w-lg p-6" (click)="$event.stopPropagation()">
          <h2 class="font-bold text-lg mb-2">Kérdések összevonása</h2>
          <p class="text-xs text-text-muted mb-4">
            A megtartott kérdés marad a rendszerben, a duplikátum inaktiválódik.
          </p>

          @for (q of mergeCandidates(); track q.questionId) {
            <label class="flex gap-2.5 items-start p-3 border border-border-default rounded-lg cursor-pointer mb-2">
              <input type="radio" name="merge-target" class="mt-1"
                [checked]="mergeKeepId() === q.questionId" (change)="mergeKeepId.set(q.questionId)" />
              <span class="text-sm">
                <strong>{{ mergeKeepId() === q.questionId ? 'Megtartva:' : 'Duplikátum:' }}</strong>
                "{{ q.newQuestionText || q.oldQuestionText }}"
                @if (q.isTeacherOwned) {
                  <span class="badge badge-warning ml-1">{{ q.teacherName }} tanár kérdése</span>
                } @else {
                  <span class="badge badge-neutral ml-1">közös bank</span>
                }
              </span>
            </label>
          }

          @if (mergeDuplicateIsTeacherOwned()) {
            <div class="flex gap-3 p-3 rounded-lg bg-warning-subtle border border-warning/30 mt-3">
              <p class="text-xs">
                <strong class="block mb-0.5">Az egyik kérdés tanári tulajdon.</strong>
                A duplikátum nem törlődik, hanem inaktiválódik, és a tulajdonos tanár értesítést kap.
              </p>
            </div>
          }

          <div class="flex justify-end gap-2 mt-5">
            <button type="button" class="btn btn-ghost" (click)="closeMergeModal()">Mégse</button>
            <button type="button" class="btn btn-primary" [disabled]="!mergeKeepId() || merging()" (click)="confirmMerge()">
              {{ merging() ? 'Összevonás...' : 'Összevonás - tanár értesítése' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminAiKoltesComponent implements OnDestroy {
  private readonly svc = inject(AdminAiSpendingService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly requestLog = inject(AiKoltesRequestLogState);

  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'attekintes', label: 'Áttekintés' },
    { id: 'havi-riport', label: 'Havi riport' },
    { id: 'naplo', label: 'Kérésnapló' },
    { id: 'karbantartas', label: 'Kvíz-karbantartás' },
    { id: 'eredmenyek', label: 'Eredmények kezelése' },
    { id: 'automatizmus', label: 'Egyéb automatizmusok' },
  ];
  readonly maintenanceActions = ['Fixed', 'Deactivated', 'FlaggedForTeacher', 'ReplacementAdded', 'NoAction'];

  readonly activeTab = signal<Tab>('attekintes');

  // ── Kvíz-karbantartás ────────────────────────────────────────────
  maintenanceForm: { rangeStartId: number | null; rangeEndId: number | null; model: string; dryRun: boolean } = {
    rangeStartId: null,
    rangeEndId: null,
    model: 'openai/gpt-4o-mini',
    dryRun: true,
  };
  readonly estimate = signal<{ candidateCount: number; estimatedCostUsd: number } | null>(null);
  readonly estimating = signal(false);
  readonly running = signal(false);
  readonly runs = signal<QuizMaintenanceRunDto[]>([]);
  readonly runsLoading = signal(false);
  // UI-TT-235: a futtatás a háttérben zajlik (ld. runMaintenance() doksi-
  // kommentje) - ez a timer csak addig figyeli a futás státuszát, amíg a
  // konkrét indított runId be nem fejeződik (vagy le nem jár a türelmi idő).
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ── Eredmények kezelése ──────────────────────────────────────────
  readonly selectedRunId = signal<string | null>(null);
  readonly decisions = signal<QuizMaintenanceDecisionDto[]>([]);
  readonly decisionsLoading = signal(false);
  readonly decisionActionFilter = signal<string | null>(null);
  readonly selectedForMerge = signal<Set<number>>(new Set());
  readonly mergeModalOpen = signal(false);
  readonly mergeKeepId = signal<number | null>(null);
  readonly merging = signal(false);

  readonly filteredDecisions = computed(() => {
    const filter = this.decisionActionFilter();
    const all = this.decisions();
    return filter ? all.filter((d) => d.action === filter) : all;
  });

  readonly mergeCandidates = computed(() => {
    const ids = this.selectedForMerge();
    return this.decisions().filter((d) => ids.has(d.questionId));
  });

  readonly mergeDuplicateIsTeacherOwned = computed(() => {
    const keepId = this.mergeKeepId();
    return this.mergeCandidates().some((q) => q.questionId !== keepId && q.isTeacherOwned);
  });

  // ── Egyéb automatizmusok ─────────────────────────────────────────
  readonly automationStatus = signal<AutomationStatusDto[]>([]);
  readonly automationLoading = signal(false);
  readonly triggering = signal<string | null>(null);

  ngOnDestroy(): void {
    if (this.pollTimeoutId !== null) clearTimeout(this.pollTimeoutId);
  }

  private runsLoadedOnce = false;
  private automationLoadedOnce = false;

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    // Egy `loaded`-jelző, NEM a lista `.length === 0`-ja dönti el az első
    // betöltést - egy legitim ÜRES eredményhalmaz (pl. nincs egyetlen AI-
    // hívás sem a szűrésnek megfelelően) különben minden fülváltáskor
    // újra lekérdezné az adatot.
    if (tab === 'naplo') this.requestLog.start();
    if (tab === 'karbantartas' && !this.runsLoadedOnce) {
      this.runsLoadedOnce = true;
      this.loadRuns();
    }
    if (tab === 'automatizmus' && !this.automationLoadedOnce) {
      this.automationLoadedOnce = true;
      this.loadAutomationStatus();
    }
  }

  // ── Kvíz-karbantartás ────────────────────────────────────────────
  loadEstimate(): void {
    this.estimating.set(true);
    this.svc
      .estimateMaintenanceRun({
        rangeStartId: this.maintenanceForm.rangeStartId,
        rangeEndId: this.maintenanceForm.rangeEndId,
        model: this.maintenanceForm.model,
      })
      .subscribe({
        next: (est) => {
          this.estimate.set(est);
          this.estimating.set(false);
        },
        error: (err) => {
          this.estimating.set(false);
          this.toast.danger(extractErrorMessage(err, 'A becslés lekérése sikertelen.'));
        },
      });
  }

  async runMaintenance(): Promise<void> {
    const ok = await this.confirmService.ask({
      message: this.maintenanceForm.dryRun
        ? 'Elindítod a próbafuttatást? Az eredmény csak megjelenik, az adatbázisba semmi nem íródik.'
        : 'Elindítod az ÉLES kvíz-karbantartó futtatást? Ez valódi módosításokat végez a kérdésbankban.',
      danger: !this.maintenanceForm.dryRun,
      confirmLabel: 'Futtatás indítása',
    });
    if (!ok) return;

    // UI-TT-235: a backend a tényleges (percekig tartó) AI-átvizsgálást egy
    // háttérfeladatba teszi - ez a hívás csak a futás-sort hozza létre és
    // AZONNAL visszatér, a `candidatesReviewed` még 0/ismeretlen. A tényleges
    // eredményt a Futtatási előzmények listában lehet nyomon követni - itt
    // egy rövid, korlátozott ideig tartó pollozással automatikusan frissítjük
    // is, hogy az admin ne kelljen kézzel újratöltenie az oldalt.
    this.running.set(true);
    if (this.pollTimeoutId !== null) clearTimeout(this.pollTimeoutId);
    this.svc
      .runMaintenance({
        rangeStartId: this.maintenanceForm.rangeStartId,
        rangeEndId: this.maintenanceForm.rangeEndId,
        model: this.maintenanceForm.model,
        dryRun: this.maintenanceForm.dryRun,
      })
      .subscribe({
        next: (result) => {
          this.running.set(false);
          this.toast.success('Futtatás elindítva a háttérben - az eredmény a Futtatási előzményekben jelenik meg.');
          this.loadRuns();
          this.pollRunCompletion(result.runId);
        },
        error: (err) => {
          this.running.set(false);
          this.toast.danger(extractErrorMessage(err, 'A futtatás indítása sikertelen.'));
        },
      });
  }

  /**
   * UI-TT-235: legfeljebb ~3 percig (20 × 8mp), a runId befejeződéséig
   * (completedAt kitöltéséig) újratölti a Futtatási előzmények listát, és egy
   * záró toast-tal jelzi, ha kész. Ha a türelmi idő lejár, csendben leáll -
   * az admin ekkor is látja a listában, hogy a futás még folyamatban van, csak
   * kézzel kell frissítenie (nincs hibaállapot, a futás a szerveren tovább fut).
   */
  private pollRunCompletion(runId: string, attemptsLeft = 20): void {
    if (attemptsLeft <= 0) return;
    this.pollTimeoutId = setTimeout(() => {
      this.svc.getMaintenanceRuns(1, 20).subscribe({
        next: (page) => {
          this.runs.set(page.items);
          const run = page.items.find((r) => r.id === runId);
          if (run?.completedAt) {
            this.toast.success(`Futtatás kész: ${run.candidatesReviewed} kérdés átnézve.`);
            return;
          }
          this.pollRunCompletion(runId, attemptsLeft - 1);
        },
        error: () => this.pollRunCompletion(runId, attemptsLeft - 1),
      });
    }, 8000);
  }

  private loadRuns(): void {
    this.runsLoading.set(true);
    this.svc.getMaintenanceRuns(1, 20).subscribe({
      next: (page) => {
        this.runs.set(page.items);
        this.runsLoading.set(false);
      },
      error: () => this.runsLoading.set(false),
    });
  }

  openRunDecisions(runId: string): void {
    this.selectedRunId.set(runId);
    this.decisionActionFilter.set(null);
    this.selectedForMerge.set(new Set());
    this.activeTab.set('eredmenyek');
    this.loadDecisions(runId);
  }

  private loadDecisions(runId: string): void {
    this.decisionsLoading.set(true);
    this.svc.getRunDecisions(runId).subscribe({
      next: (data) => {
        this.decisions.set(data);
        this.decisionsLoading.set(false);
      },
      error: (err) => {
        this.decisionsLoading.set(false);
        this.toast.danger(extractErrorMessage(err, 'Az eredmények betöltése sikertelen.'));
      },
    });
  }

  setDecisionFilter(action: string | null): void {
    this.decisionActionFilter.set(action);
  }

  countByAction(action: string): number {
    return this.decisions().filter((d) => d.action === action).length;
  }

  actionLabel(action: string): string {
    return MAINTENANCE_ACTION_LABELS[action] ?? action;
  }

  actionBadgeClass(action: string): string {
    return MAINTENANCE_ACTION_BADGES[action] ?? 'badge-neutral';
  }

  async deactivateQuestion(d: QuizMaintenanceDecisionDto): Promise<void> {
    const ok = await this.confirmService.ask({
      message: 'Inaktiválod ezt a kérdést? A közös bankban/kvízben többé nem jelenik meg diákoknak.',
      danger: true,
      confirmLabel: 'Inaktiválás',
    });
    if (!ok) return;

    this.svc.deactivateQuestion(d.questionId).subscribe({
      next: () => {
        this.toast.success('Kérdés inaktiválva.');
        this.decisions.update((list) => list.filter((x) => x.questionId !== d.questionId));
        this.selectedForMerge.update((set) => {
          const next = new Set(set);
          next.delete(d.questionId);
          return next;
        });
      },
      error: (err) => this.toast.danger(extractErrorMessage(err, 'Az inaktiválás sikertelen.')),
    });
  }

  toggleMergeSelection(questionId: number): void {
    this.selectedForMerge.update((set) => {
      const next = new Set(set);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else if (next.size < 2) {
        next.add(questionId);
      }
      return next;
    });
  }

  openMergeModal(): void {
    const [first] = this.selectedForMerge();
    this.mergeKeepId.set(first ?? null);
    this.mergeModalOpen.set(true);
  }

  closeMergeModal(): void {
    this.mergeModalOpen.set(false);
  }

  confirmMerge(): void {
    const keepId = this.mergeKeepId();
    const ids = [...this.selectedForMerge()];
    const duplicateId = ids.find((id) => id !== keepId);
    if (!keepId || !duplicateId) return;

    this.merging.set(true);
    this.svc.mergeQuestions({ keepQuestionId: keepId, duplicateQuestionId: duplicateId }).subscribe({
      next: (result) => {
        this.merging.set(false);
        this.mergeModalOpen.set(false);
        this.toast.success(result.teacherNotified ? 'Összevonva - a tanár értesítést kapott.' : 'Kérdések összevonva.');
        this.decisions.update((list) => list.filter((x) => x.questionId !== duplicateId));
        this.selectedForMerge.set(new Set());
      },
      error: (err) => {
        this.merging.set(false);
        this.toast.danger(extractErrorMessage(err, 'Az összevonás sikertelen.'));
      },
    });
  }

  // ── Egyéb automatizmusok ─────────────────────────────────────────
  private loadAutomationStatus(): void {
    this.automationLoading.set(true);
    this.svc.getAutomationStatus().subscribe({
      next: (data) => {
        this.automationStatus.set(data);
        this.automationLoading.set(false);
      },
      error: () => this.automationLoading.set(false),
    });
  }

  automationTitle(key: string): string {
    return key === 'studyplan' ? 'Tanulási terv újraszámítás' : key === 'dailychallenge' ? 'Napi kihívás előgenerálás' : key;
  }

  async triggerAutomation(key: string): Promise<void> {
    const ok = await this.confirmService.ask({
      message: `Elindítod a(z) "${this.automationTitle(key)}" folyamatot kézzel, most?`,
      confirmLabel: 'Indítás',
    });
    if (!ok) return;

    this.triggering.set(key);
    const call = key === 'studyplan' ? this.svc.triggerStudyPlan() : this.svc.triggerDailyChallenge();
    call.subscribe({
      next: (res) => {
        this.triggering.set(null);
        this.toast.success(res.message);
        this.loadAutomationStatus();
      },
      error: (err) => {
        this.triggering.set(null);
        this.toast.danger(extractErrorMessage(err, 'A folyamat indítása sikertelen.'));
      },
    });
  }
}
