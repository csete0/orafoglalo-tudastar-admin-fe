import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminAiHaviRiportComponent } from './admin-ai-havi-riport.component';
import { AiKoltesAutomationComponent } from './ai-koltes/ai-koltes-automation.component';
import { AiKoltesAutomationState } from './ai-koltes/ai-koltes-automation.state';
import { AiKoltesDecisionsComponent } from './ai-koltes/ai-koltes-decisions.component';
import { AiKoltesDecisionsState } from './ai-koltes/ai-koltes-decisions.state';
import { AiKoltesMaintenanceComponent } from './ai-koltes/ai-koltes-maintenance.component';
import { AiKoltesMaintenanceState } from './ai-koltes/ai-koltes-maintenance.state';
import { AiKoltesOverviewComponent } from './ai-koltes/ai-koltes-overview.component';
import { AiKoltesOverviewState } from './ai-koltes/ai-koltes-overview.state';
import { AiKoltesRequestLogComponent } from './ai-koltes/ai-koltes-request-log.component';
import { AiKoltesRequestLogState } from './ai-koltes/ai-koltes-request-log.state';
import { TabBarComponent, TabItem } from '../../shared/tab-bar/tab-bar.component';

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
    TabBarComponent,
    AdminAiHaviRiportComponent,
    AiKoltesOverviewComponent,
    AiKoltesRequestLogComponent,
    AiKoltesMaintenanceComponent,
    AiKoltesDecisionsComponent,
    AiKoltesAutomationComponent,
  ],
  // Fül-szintű állapot: a pulttal él, így fülváltáskor megmarad (lusta betöltés, szűrő, oldal, 7/30 nap, form, kijelölés),
  // és a karbantartó-futás figyelése más fülön is fut; a pult megszűnésekor minden leáll.
  providers: [
    AiKoltesOverviewState,
    AiKoltesRequestLogState,
    AiKoltesMaintenanceState,
    AiKoltesDecisionsState,
    AiKoltesAutomationState,
  ],
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
        @case ('karbantartas') {
          <app-ai-koltes-maintenance (openRun)="openRunDecisions($event)" />
        }
        @case ('eredmenyek') {
          <app-ai-koltes-decisions />
        }
        @case ('automatizmus') {
          <app-ai-koltes-automation />
        }
      }
    </div>
  `,
})
export class AdminAiKoltesComponent {
  private readonly requestLog = inject(AiKoltesRequestLogState);
  private readonly maintenance = inject(AiKoltesMaintenanceState);
  private readonly decisions = inject(AiKoltesDecisionsState);
  private readonly automation = inject(AiKoltesAutomationState);

  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'attekintes', label: 'Áttekintés' },
    { id: 'havi-riport', label: 'Havi riport' },
    { id: 'naplo', label: 'Kérésnapló' },
    { id: 'karbantartas', label: 'Kvíz-karbantartás' },
    { id: 'eredmenyek', label: 'Eredmények kezelése' },
    { id: 'automatizmus', label: 'Egyéb automatizmusok' },
  ];
  readonly activeTab = signal<Tab>('attekintes');

  /** A napló, a karbantartás és az automatizmusok az első megnyitáskor töltenek (a `start()` idempotens). */
  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'naplo') this.requestLog.start();
    if (tab === 'karbantartas') this.maintenance.start();
    if (tab === 'automatizmus') this.automation.start();
  }

  /** A karbantartás „Eredmények” gombja: a futás döntéseinek betöltése és átváltás az Eredmények fülre. */
  openRunDecisions(runId: string): void {
    this.decisions.open(runId);
    this.activeTab.set('eredmenyek');
  }
}
