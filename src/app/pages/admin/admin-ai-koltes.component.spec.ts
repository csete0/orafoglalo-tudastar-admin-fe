import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminAiKoltesComponent } from './admin-ai-koltes.component';
import { AdminAiSpendingService } from '../../services/admin/admin-ai-spending.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AiSpendingOverviewDto, QuizMaintenanceDecisionDto } from '../../models/ai-spending.model';
import { AiKoltesOverviewState } from './ai-koltes/ai-koltes-overview.state';
import { AiKoltesRequestLogState } from './ai-koltes/ai-koltes-request-log.state';
import { AiKoltesMaintenanceState } from './ai-koltes/ai-koltes-maintenance.state';
import { AiKoltesDecisionsState } from './ai-koltes/ai-koltes-decisions.state';

function makeOverview(overrides: Partial<AiSpendingOverviewDto> = {}): AiSpendingOverviewDto {
  return {
    dailyBySource: [
      { date: '2026-09-20', bySource: { chat: 1.2, maint: 0.5 } },
      { date: '2026-09-21', bySource: { chat: 0.8, studyplan: 4.1 } },
    ],
    monthTotalsBySource: [
      { source: 'chat', totalUsd: 12.5 },
      { source: 'maint', totalUsd: 3.2 },
    ],
    todayTotalUsd: 4.9,
    monthTotalUsd: 15.7,
    myOwnMonthUsd: 1.1,
    automationMonthUsd: 3.7,
    demoTodayUsd: 0.05,
    demoMonthUsd: 0.4,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<QuizMaintenanceDecisionDto> = {}): QuizMaintenanceDecisionDto {
  return {
    questionId: 1,
    action: 'NoAction',
    oldQuestionText: 'Mi Magyarország fővárosa?',
    newQuestionText: null,
    oldCorrectAnswer: null,
    newCorrectAnswer: null,
    reasoning: null,
    isTeacherOwned: false,
    teacherName: null,
    ...overrides,
  };
}

describe('AdminAiKoltesComponent - AI-KOLTES-PULT', () => {
  let svcMock: Record<string, ReturnType<typeof vi.fn>>;
  let toastMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let confirmMock: { ask: ReturnType<typeof vi.fn> };

  function configure() {
    svcMock = {
      getOverview: vi.fn().mockReturnValue(of(makeOverview())),
      getTopSpenders: vi.fn().mockReturnValue(of([{ userId: 1, userName: 'Teszt Elek', requestCount: 5, totalUsd: 1.2 }])),
      getClassTestUsage: vi.fn().mockReturnValue(of([
        { teacherUserId: 7, teacherName: 'Tanár Tamás', email: 't@example.com', institutionName: 'Minta Gimnázium', gradedThisMonth: 42, monthlyLimit: 300 },
      ])),
      getFullExamUsage: vi.fn().mockReturnValue(of({
        gradedExamsThisMonth: 12, studentsThisMonth: 9, examCostTodayUsd: 1.6, practiceCostTodayUsd: 0.5, last30DaysCostUsd: 14.2,
        dailyAlertUsd: 2, dailyAlert: true, storageBytes: 52428800, storageFiles: 140, storageLast30DaysBytes: 10485760,
      })),
      getCredits: vi.fn().mockReturnValue(of({ totalCredits: 100, totalUsage: 23.5, remainingCredits: 76.5 })),
      getRequestLog: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
      getMaintenanceRuns: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
      getAutomationStatus: vi.fn().mockReturnValue(of([])),
      estimateMaintenanceRun: vi.fn().mockReturnValue(of({ candidateCount: 10, estimatedCostUsd: 0.04 })),
      runMaintenance: vi.fn().mockReturnValue(of({ runId: 'abc-123', candidatesReviewed: 10, dryRun: true })),
      getRunDecisions: vi.fn().mockReturnValue(of([makeDecision({ questionId: 1 }), makeDecision({ questionId: 2 })])),
      deactivateQuestion: vi.fn().mockReturnValue(of(undefined)),
      mergeQuestions: vi.fn().mockReturnValue(of({ teacherNotified: false })),
      triggerStudyPlan: vi.fn().mockReturnValue(of({ message: 'ok' })),
      triggerDailyChallenge: vi.fn().mockReturnValue(of({ message: 'ok' })),
    };
    toastMock = { success: vi.fn(), danger: vi.fn() };
    confirmMock = { ask: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [AdminAiKoltesComponent],
      providers: [
        { provide: AdminAiSpendingService, useValue: svcMock },
        { provide: ToastService, useValue: toastMock },
        { provide: ConfirmService, useValue: confirmMock },
      ],
    });
  }

  // Az adat resource-okkal töltődik (a válasz a változásészlelés után, aszinkron ér be).
  async function settle(fixture: ComponentFixture<AdminAiKoltesComponent>) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function createFixture() {
    const fixture = TestBed.createComponent(AdminAiKoltesComponent);
    await settle(fixture);
    return fixture;
  }

  const overviewState = (fixture: ComponentFixture<AdminAiKoltesComponent>) =>
    fixture.debugElement.injector.get(AiKoltesOverviewState);
  const logState = (fixture: ComponentFixture<AdminAiKoltesComponent>) =>
    fixture.debugElement.injector.get(AiKoltesRequestLogState);
  const maintenanceState = (fixture: ComponentFixture<AdminAiKoltesComponent>) =>
    fixture.debugElement.injector.get(AiKoltesMaintenanceState);
  const decisionsState = (fixture: ComponentFixture<AdminAiKoltesComponent>) =>
    fixture.debugElement.injector.get(AiKoltesDecisionsState);

  it('induláskor betölti az áttekintést és a legtöbbet költőket', async () => {
    configure();
    const fixture = await createFixture();
    const state = overviewState(fixture);

    expect(svcMock['getOverview']).toHaveBeenCalledWith(30);
    expect(svcMock['getTopSpenders']).toHaveBeenCalledWith(30, 10);
    expect(state.overview()?.monthTotalUsd).toBe(15.7);
    expect(state.topSpenders().length).toBe(1);
  });

  it('a demók költése külön csempén látszik (a valódi összegekben nincs benne)', async () => {
    configure();
    const fixture = await createFixture();
    const tile = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="demo-spend"]');
    expect(tile?.textContent).toContain('Demók');
    expect(tile?.textContent).toContain('0.4');
  });

  it('a tanáronkénti dolgozat-felhasználást is megjeleníti a havi kerettel', async () => {
    configure();
    const fixture = await createFixture();
    fixture.detectChanges();

    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="class-test-usage"]');
    expect(svcMock['getClassTestUsage']).toHaveBeenCalled();
    expect(card.textContent).toContain('Tanár Tamás');
    expect(card.textContent).toContain('Minta Gimnázium');
    expect(card.textContent).toContain('42 / 300');
  });

  // Teljes vizsga (I): e havi értékelések, költés a napi riasztással, a feltöltések tárhelye.
  it('a teljes vizsga értékelésének kártyáját a riasztással és a tárhellyel mutatja', async () => {
    configure();
    const fixture = await createFixture();
    fixture.detectChanges();
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="full-exam-usage"]');
    expect(card.textContent).toContain('12 vizsga · 9 diák');
    expect(card.querySelector('[role="alert"]')?.textContent).toContain('riasztási küszöböt ($2.00)');
    expect(card.textContent).toContain('50.0 MB · 140 fájl');
    expect(card.textContent).toContain('+10.0 MB');
  });

  it('induláskor betölti az OpenRouter kredit-egyenleget is', async () => {
    configure();
    const fixture = await createFixture();
    const state = overviewState(fixture);

    expect(svcMock['getCredits']).toHaveBeenCalled();
    expect(state.credits()?.remainingCredits).toBe(76.5);
    expect(state.creditsError()).toBe(false);
  });

  it('ha az OpenRouter kredit-lekérdezés elhasal, a hibaállapot jelzi, de a többi csempe nem sérül', async () => {
    configure();
    svcMock['getCredits'] = vi.fn().mockReturnValue(throwError(() => new Error('OpenRouter unreachable')));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminAiKoltesComponent],
      providers: [
        { provide: AdminAiSpendingService, useValue: svcMock },
        { provide: ToastService, useValue: toastMock },
        { provide: ConfirmService, useValue: confirmMock },
      ],
    });
    const fixture = await createFixture();
    const state = overviewState(fixture);

    expect(state.creditsError()).toBe(true);
    expect(state.credits()).toBeNull();
    expect(state.overview()).not.toBeNull();
  });

  it('a Kérésnapló fülre váltás betölti a kérésnaplót (lustán, csak első alkalommal)', async () => {
    configure();
    const fixture = await createFixture();
    const component = fixture.componentInstance;
    expect(svcMock['getRequestLog']).not.toHaveBeenCalled();

    component.setTab('naplo');
    await settle(fixture);
    expect(svcMock['getRequestLog']).toHaveBeenCalledTimes(1);

    component.setTab('attekintes');
    await settle(fixture);
    component.setTab('naplo');
    await settle(fixture);
    // Másodszorra már nem tölt újra, mert logItems() nem üres - ez a lusta betöltés lényege.
    expect(svcMock['getRequestLog']).toHaveBeenCalledTimes(1);
  });

  it('szűrés-változtatás visszaállítja az 1. oldalra és újratölti a naplót', async () => {
    configure();
    const fixture = await createFixture();
    fixture.componentInstance.setTab('naplo');
    const log = logState(fixture);
    log.page.set(3);
    await settle(fixture);

    log.setFilter({ source: 'chat' });
    await settle(fixture);

    expect(log.page()).toBe(1);
    expect(svcMock['getRequestLog']).toHaveBeenLastCalledWith({ source: 'chat' }, 1, 20);
    expect(log.filter()).toEqual({ source: 'chat' });
  });

  it('összevonáshoz legfeljebb 2 kérdés jelölhető ki', async () => {
    configure();
    const fixture = await createFixture();
    const state = decisionsState(fixture);

    state.toggleMergeSelection(1);
    state.toggleMergeSelection(2);
    state.toggleMergeSelection(3);

    expect(state.selectedForMerge().size).toBe(2);
    expect(state.selectedForMerge().has(3)).toBe(false);
  });

  it('a futtatás indítása előtt megerősítést kér, és a törzsben átadja a form adatait', async () => {
    configure();
    const fixture = await createFixture();
    const state = maintenanceState(fixture);
    state.form = { rangeStartId: 500, rangeEndId: 600, model: 'openai/gpt-4o-mini', dryRun: false };

    await state.runMaintenance();

    expect(confirmMock.ask).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
    expect(svcMock['runMaintenance']).toHaveBeenCalledWith({
      rangeStartId: 500,
      rangeEndId: 600,
      model: 'openai/gpt-4o-mini',
      dryRun: false,
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('összevonáskor a megtartott/duplikátum kérdés helyesen kerül szétválasztásra', async () => {
    configure();
    const fixture = await createFixture();
    const state = decisionsState(fixture);
    state.decisions.set([makeDecision({ questionId: 1 }), makeDecision({ questionId: 2 })]);
    state.selectedForMerge.set(new Set([1, 2]));
    state.mergeKeepId.set(1);

    state.confirmMerge();

    expect(svcMock['mergeQuestions']).toHaveBeenCalledWith({ keepQuestionId: 1, duplicateQuestionId: 2 });
  });
});
