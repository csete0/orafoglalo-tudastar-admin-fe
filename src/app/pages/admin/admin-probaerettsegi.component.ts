import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, catchError, firstValueFrom, forkJoin, throwError } from 'rxjs';
import { AdminMockExamService } from '../../services/admin/admin-mock-exam.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';
import { latestValue } from '../../shared/resource/latest-value';
import { UtcPipe } from '../../shared/utc/utc.pipe';
import {
  AdminMockExam, AdminMockExamLeaderboardEntry, AdminMockExamStatus, AdminMockExamTaskSetOption, AdminMockExamUpsert, asUtc,
} from '../../models/mock-exam.model';
import { MockExamListComponent } from './probaerettsegi/mock-exam-list.component';
import { MockExamFormComponent, MockExamFormTarget } from './probaerettsegi/mock-exam-form.component';
import { MockExamStatusComponent } from './probaerettsegi/mock-exam-status.component';
import { MockExamMarketingComponent } from './probaerettsegi/mock-exam-marketing.component';
import { LeaderboardHideRequest, MockExamLeaderboardComponent } from './probaerettsegi/mock-exam-leaderboard.component';

const LIVE_REFRESH_MS = 60_000;

/** A kiválasztott esemény státusza és toplistája - együtt töltődik, együtt cserélődik (mint a régi Promise.all). */
interface SelectedEventData { status: AdminMockExamStatus; leaderboard: AdminMockExamLeaderboardEntry[] }

/**
 * Próbaérettségi – admin (PATRICKS-PROBAERETTSEGI-TERV.md F): esemény létrehozása/módosítása (budapesti idővel), sötét indítás,
 * élő státusz (kitöltés, értékelési sor és hibák, keret-sáv 50/80%-kal, „Keret emelése”), kényszerített közzététel,
 * felszabadítás, és a marketing-megtérülés forrás-tölcsérrel. Az esemény hetében 60 mp-enként frissül.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-probaerettsegi',
  imports: [
    DatePipe, UtcPipe, LocalSpinnerComponent, MockExamListComponent, MockExamFormComponent, MockExamStatusComponent,
    MockExamMarketingComponent, MockExamLeaderboardComponent,
  ],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Próbaérettségi</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">Esemény, kitöltés, MI-keret és megtérülés. Az időpontokat budapesti idővel add meg.</p>
      <div class="hairline"></div>

      @if (loading()) {
        <app-local-spinner />
      } @else {
        <div app-mock-exam-list class="flex items-center gap-2 flex-wrap mb-5" [events]="events()" [selectedId]="selected()?.id ?? null"
             (chosen)="select($event)" (create)="startCreate()"></div>

        @if (formTarget(); as target) {
          <app-mock-exam-form [target]="target" [options]="taskSetOptions()" [hasSessions]="editingHasSessions()" [busy]="busy()"
                              (saved)="save($event)" (cancelled)="formTarget.set(null)" />
        }

        @if (status(); as s) {
          <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 class="text-lg font-bold">{{ s.event.title }}</h2>
              <p class="text-xs text-text-muted">
                kezdhető {{ s.event.opensAt | utc | date: 'MMM d. HH:mm' }} – {{ s.event.startClosesAt | utc | date: 'MMM d. HH:mm' }} ·
                eredmény {{ s.event.resultsPlannedAt | utc | date: 'MMM d. HH:mm' }}
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

          <app-mock-exam-status [status]="s" (budgetRaise)="raiseBudget(s.event.id, $event)" />
          <div app-mock-exam-marketing class="card p-5" data-testid="mock-marketing" [marketing]="s.marketing"></div>
          <div app-mock-exam-leaderboard class="card p-5 mt-4" data-testid="mock-leaderboard" [entries]="leaderboard()" [busy]="busy()"
               (hiddenChange)="setHidden($event)"></div>
        } @else if (!formTarget() && !events().length) {
          <p class="text-text-muted">Még nincs próbaérettségi. Hozz létre egyet az „Új esemény” gombbal.</p>
        }
      }
    </div>
  `,
})
export class AdminProbaerettsegiComponent {
  private readonly api = inject(AdminMockExamService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  private readonly eventsResource = rxResource({
    stream: () => this.toastOnError(this.api.list(), 'A próbaérettségik betöltése nem sikerült.'),
  });
  /** Hibás újratöltésnél a korábbi lista marad (mint eddig). */
  private readonly latestEvents = latestValue(this.eventsResource);
  readonly events = computed(() => this.latestEvents() ?? []);

  /** A lista következő betöltése után kiválasztandó esemény (null: az első) - a kiválasztással és a műveletekkel együtt áll be. */
  private reselectId: number | null = null;
  readonly selected = linkedSignal<AdminMockExam[], AdminMockExam | null>({
    source: this.events,
    computation: (events) => events.find((e) => e.id === this.reselectId) ?? events[0] ?? null,
  });

  /** A kulcsban a lista is benne van: a lista minden sikeres újratöltése a kiválasztott státuszát is újratölti (mint eddig). */
  private readonly selectedResource = rxResource({
    params: () => {
      const event = this.selected();
      return event ? { event, events: this.events() } : undefined;
    },
    stream: ({ params: { event: e } }) => this.toastOnError(
      forkJoin({ status: this.api.status(e.id), leaderboard: this.api.leaderboard(e.id) }),
      'A státusz betöltése nem sikerült.',
    ),
  });
  /** Betöltés közben és hiba után a korábbi státusz látszik; törléskor kézzel ürül. */
  private readonly selectedData = linkedSignal<SelectedEventData | undefined, SelectedEventData | null>({
    source: () => (this.selectedResource.hasValue() ? this.selectedResource.value() : undefined),
    computation: (data, previous) => data ?? previous?.value ?? null,
  });
  readonly status = computed(() => this.selectedData()?.status ?? null);
  /** A becenévvel jelentkezők a toplista-moderáláshoz (a rejtettek is). */
  readonly leaderboard = computed(() => this.selectedData()?.leaderboard ?? []);

  /** Csak az első betöltésnél (lista + az első esemény státusza) van spinner; utána a korábbi adat marad látható. */
  readonly loading = linkedSignal<boolean, boolean>({
    source: () => this.eventsResource.isLoading() || this.selectedResource.isLoading(),
    computation: (pending, previous) => pending && (previous?.value ?? true),
  });

  private readonly running = signal(false);
  /** Művelet közben és az utána következő újratöltés végéig tiltott gombok. */
  readonly busy = computed(() => this.running() || this.eventsResource.isLoading() || this.selectedResource.isLoading());

  readonly taskSetOptions = signal<AdminMockExamTaskSetOption[]>([]);
  readonly formTarget = signal<MockExamFormTarget | null>(null);
  readonly editingHasSessions = computed(() => {
    const id = this.formTarget()?.event?.id;
    return !!id && !!this.events().find((e) => e.id === id)?.hasSessions;
  });

  constructor() {
    const timer = setInterval(() => {
      const ev = this.selected();
      // Élő frissítés az esemény hetében (és az eredményig).
      if (ev && Date.now() >= asUtc(ev.opensAt).getTime() && Date.now() <= asUtc(ev.resultsPlannedAt).getTime() + 86_400_000) {
        this.selectedResource.reload();
      }
    }, LIVE_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  select(e: AdminMockExam): void {
    this.reselectId = e.id;
    if (this.selected() === e) this.selectedResource.reload();
    else this.selected.set(e);
  }

  async startCreate(): Promise<void> {
    await this.loadOptions();
    this.formTarget.set({ event: null });
  }

  async startEdit(e: AdminMockExam): Promise<void> {
    await this.loadOptions();
    // A saját (már esetleg közzétett) sorai is választhatók maradjanak.
    for (const id of [e.kozepTaskSetId, e.emeltTaskSetId]) {
      if (!this.taskSetOptions().some((o) => o.id === id)) this.taskSetOptions.update((all) => [{ id, title: '(az esemény sora)', level: null }, ...all]);
    }
    this.formTarget.set({ event: e });
  }

  private async loadOptions(): Promise<void> {
    if (!this.taskSetOptions().length) this.taskSetOptions.set(await firstValueFrom(this.api.taskSetOptions()));
  }

  async save(request: AdminMockExamUpsert): Promise<void> {
    const id = this.formTarget()?.event?.id;
    await this.run(async () => {
      const saved = await firstValueFrom(id ? this.api.update(id, request) : this.api.create(request));
      this.formTarget.set(null);
      this.toast.success(id ? 'Mentve.' : 'Létrehozva (rejtve - a közzétételig csak admin látja).');
      this.reloadEvents(saved.id);
    });
  }

  async togglePublished(e: AdminMockExam): Promise<void> {
    if (!e.isPublished && !(await this.confirm.ask({
      title: 'Közzéteszed az eseményt?', message: 'Utána mindenki látja a /probaerettsegi oldalon, és jelentkezhet.', confirmLabel: 'Közzététel',
    }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.setPublished(e.id, !e.isPublished));
      this.reloadEvents(e.id);
    });
  }

  async raiseBudget(eventId: number, amount: number): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.raiseBudget(eventId, amount));
      this.toast.success('Keret emelve - a várakozó beadások értékelése elindult.');
      this.selectedResource.reload();
    });
  }

  async publishResults(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Közzéteszed most az eredményt?', message: 'A rangsor most rögzül; a később értékelt beadások ehhez mérve kapnak helyezést.', confirmLabel: 'Közzététel', danger: true,
    }))) return;
    await this.run(async () => {
      const done = await firstValueFrom(this.api.publishResults(e.id));
      this.toast.success(done ? 'Az eredmény közzétéve.' : 'Már közzé volt téve.');
      this.reloadEvents(e.id);
    });
  }

  async releasePractice(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Felszabadítod gyakorlóként?', message: 'A két feladatsor (fizetős) gyakorlóként megjelenik a „Próbaérettségi feladatsorok” kategóriában.', confirmLabel: 'Felszabadítás',
    }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.releasePractice(e.id));
      this.toast.success('Felszabadítva.');
      this.reloadEvents(e.id);
    });
  }

  async remove(e: AdminMockExam): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Törlöd az eseményt?', message: e.title, confirmLabel: 'Törlés', danger: true }))) return;
    await this.run(async () => {
      await firstValueFrom(this.api.delete(e.id));
      this.selected.set(null);
      this.selectedData.set(null);
      this.reloadEvents(null);
    });
  }

  /** Toplistáról levétel vagy visszahelyezés - a nyilvános eredmény azonnal frissül. */
  async setHidden({ entry, hidden }: LeaderboardHideRequest): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.hideRegistration(entry.registrationId, hidden));
      this.toast.success(hidden ? 'Levéve a toplistáról.' : 'Visszahelyezve a toplistára.');
      this.selectedResource.reload();
    });
  }

  private reloadEvents(selectId: number | null): void {
    this.reselectId = selectId;
    this.eventsResource.reload();
  }

  private toastOnError<T>(source: Observable<T>, fallback: string): Observable<T> {
    return source.pipe(catchError((err: unknown) => {
      this.toast.danger(extractErrorMessage(err, fallback));
      return throwError(() => err);
    }));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.running.set(true);
    try {
      await action();
    } catch (err) {
      this.toast.danger(extractErrorMessage(err, 'A művelet nem sikerült.'));
    } finally {
      this.running.set(false);
    }
  }
}
