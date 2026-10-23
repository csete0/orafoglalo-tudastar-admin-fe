import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { TabBarComponent, TabItem } from '../../shared/tab-bar/tab-bar.component';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';
import { latestValue } from '../../shared/resource/latest-value';
import { reportErrors } from '../../shared/resource/report-errors';
import { ProjektmuhelyAttekintesComponent } from './projektmuhely/projektmuhely-attekintes.component';
import { ProjektmuhelyTolcserComponent } from './projektmuhely/projektmuhely-tolcser.component';
import { ProjektmuhelyKoltsegComponent } from './projektmuhely/projektmuhely-koltseg.component';
import { ProjektmuhelyTechnikumComponent } from './projektmuhely/projektmuhely-technikum.component';

type Tab = 'attekintes' | 'tolcser' | 'koltseg' | 'technikum';

const LOAD_ERROR = 'A Projektműhely adatait nem sikerült betölteni.';

/** `auto`: az első betöltés választása - a spinner alatt tölt, és a hibája az oldal-betöltés hibája (mint eddig). */
interface FunnelRequest {
  slug: string;
  auto: boolean;
}

/**
 * Projektműhely (PATRICKS-PROJEKTMUHELY-2-TERV.md, A fázis): haladás projektenként, a tölcsér (hol akadnak el a
 * diákok), és a költség - AI (OpenRouter, USD) és Judge0-futtatások (saját gép: darab és CPU-idő).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-projektmuhely',
  imports: [
    LocalSpinnerComponent, TabBarComponent, ProjektmuhelyAttekintesComponent, ProjektmuhelyTolcserComponent, ProjektmuhelyKoltsegComponent,
    ProjektmuhelyTechnikumComponent,
  ],
  template: `
    <div class="max-w-6xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Projektműhely</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        Ki hol tart a projektekben, melyik lépésnél akadnak el, és mennyibe kerül egy aktív diák (AI + Judge0).
      </p>
      <div class="hairline"></div>

      <div class="flex items-end justify-between gap-4 flex-wrap border-b border-border-default mb-6">
        <nav app-tab-bar class="flex gap-5 overflow-x-auto" role="tablist" [tabs]="tabs" [active]="activeTab()" (activeChange)="selectTab($event)"></nav>
        @if (activeTab() !== 'tolcser') {
          <div class="inline-flex border border-border-default rounded-full p-0.5 gap-0.5 mb-2" role="group" aria-label="Időszak">
            @for (d of dayOptions; track d) {
              <button type="button" class="px-2.5 py-1 rounded-full text-xs font-bold" [class.bg-primary]="days() === d"
                [class.text-white]="days() === d" [class.text-text-muted]="days() !== d" [attr.aria-pressed]="days() === d"
                (click)="setDays(d)">{{ d }} nap</button>
            }
          </div>
        }
      </div>

      @if (error()) {
        <p class="text-danger text-sm mb-4">{{ error() }}</p>
      }
      @if (loading()) {
        <app-local-spinner />
      } @else {
        @switch (activeTab()) {
          @case ('attekintes') {
            @if (overview(); as ov) {
              <app-projektmuhely-attekintes [overview]="ov" (funnelOpen)="openFunnel($event)" />
            }
          }
          @case ('tolcser') {
            <app-projektmuhely-tolcser [projects]="overview()?.projects ?? []" [slug]="funnelSlug()" [funnel]="funnel()"
              (projectChange)="openFunnel($event)" />
          }
          @case ('technikum') {
            @if (technikumLoading()) {
              <app-local-spinner />
            } @else if (technikum(); as t) {
              <app-projektmuhely-technikum [stats]="t" />
            }
          }
          @case ('koltseg') {
            @if (costs(); as c) {
              <app-projektmuhely-koltseg [costs]="c" />
            }
          }
        }
      }
    </div>
  `,
})
export class AdminProjektmuhelyComponent {
  private readonly api = inject(AdminProjektmuhelyService);

  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'attekintes', label: 'Áttekintés' },
    { id: 'tolcser', label: 'Tölcsér' },
    { id: 'koltseg', label: 'Költség' },
    { id: 'technikum', label: 'Fejlesztőműhely' },
  ];
  readonly dayOptions = [7, 30, 90];

  readonly activeTab = signal<Tab>('attekintes');
  readonly days = signal(30);
  /** Egy közös hibasor: minden betöltés induláskor törli, hibánál a sajátját írja ki (mint eddig). */
  readonly error = signal<string | null>(null);

  private readonly dataResource = rxResource({
    params: () => this.days(),
    stream: ({ params: days }) =>
      reportErrors(forkJoin({ overview: this.api.getOverview(days), costs: this.api.getCosts(days) }), this.error, () => LOAD_ERROR),
  });
  /** Betöltés közben és hiba után a korábbi adat marad. */
  private readonly data = latestValue(this.dataResource);
  readonly overview = computed(() => this.data()?.overview ?? null);
  readonly costs = computed(() => this.data()?.costs ?? null);

  /** A tölcsér kérése: a felhasználó választása; amíg nincs, az első sikeres betöltés első projektje (automatikusan). */
  private readonly funnelRequest = linkedSignal<string | undefined, FunnelRequest | undefined>({
    source: () => this.overview()?.projects[0]?.slug,
    computation: (first, previous) => previous?.value ?? (first ? { slug: first, auto: true } : undefined),
  });
  readonly funnelSlug = computed(() => this.funnelRequest()?.slug ?? '');
  private readonly funnelResource = rxResource({
    params: () => this.funnelRequest(),
    stream: ({ params: { slug, auto } }) =>
      reportErrors(this.api.getFunnel(slug), this.error, () => (auto ? LOAD_ERROR : 'A tölcsért nem sikerült betölteni.')),
  });
  /** Projektváltás közben és hiba után a korábbi tölcsér marad. */
  private readonly latestFunnel = latestValue(this.funnelResource);
  readonly funnel = computed(() => this.latestFunnel() ?? null);

  /** A technikumi statisztika csak a fülre lépve töltődik (a többi fül nem függ tőle); a kulcs a kért időszak. */
  private readonly technikumDays = signal<number | undefined>(undefined);
  private readonly technikumResource = rxResource({
    params: () => this.technikumDays(),
    stream: ({ params: days }) =>
      reportErrors(this.api.getTechnikum(days), this.error, (err) => extractErrorMessage(err, 'A Fejlesztőműhely-statisztikát nem sikerült betölteni.')),
  });
  private readonly latestTechnikum = latestValue(this.technikumResource);
  readonly technikum = computed(() => this.latestTechnikum() ?? null);
  readonly technikumLoading = this.technikumResource.isLoading;

  /** A spinner az adatok és az első, automatikus tölcsér betöltéséig látszik. */
  readonly loading = computed(
    () => this.dataResource.isLoading() || (this.funnelResource.isLoading() && this.funnelRequest()?.auto === true),
  );

  /** Az aktív időszak újrakattintása is újratölt (mint eddig). */
  setDays(days: number): void {
    if (days === this.days()) this.dataResource.reload();
    else this.days.set(days);
    if (this.activeTab() === 'technikum') this.loadTechnikum();
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'technikum' && this.technikum()?.days !== this.days()) this.loadTechnikum();
  }

  /** Mindig újratölt, ugyanarra a projektre is (új kérés-objektum). */
  openFunnel(slug: string): void {
    this.activeTab.set('tolcser');
    this.funnelRequest.set({ slug, auto: false });
  }

  private loadTechnikum(): void {
    if (this.technikumDays() === this.days()) this.technikumResource.reload();
    else this.technikumDays.set(this.days());
  }
}
