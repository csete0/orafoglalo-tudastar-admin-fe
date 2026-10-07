import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminProbaerettsegiComponent, conversion } from './admin-probaerettsegi.component';
import { AdminMockExamService } from '../../services/admin/admin-mock-exam.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AdminMockExam, AdminMockExamStatus, asUtc, toBudapestInput } from '../../models/mock-exam.model';

const EVENT: AdminMockExam = {
  id: 4, slug: 'osz-2026', title: 'Őszi próbaérettségi 2026', registrationOpensAt: '2026-10-26T07:00:00', opensAt: '2026-11-23T05:00:00',
  startClosesAt: '2026-11-29T17:00:00', resultsPlannedAt: '2026-11-30T17:00:00', resultsPublishedAt: null, practiceReleaseAt: '2026-11-30T23:00:00',
  releasedAsPracticeAt: null, kozepTaskSetId: 1, emeltTaskSetId: 2, kozepTimeLimitSeconds: 10800, emeltTimeLimitSeconds: 14400,
  totalBudgetUsd: 500, badgeKeyPrefix: 'MOCKEXAM_2026OSZ', isPublished: true, hasSessions: true, registrations: 120,
};

function status(over: Partial<AdminMockExamStatus> = {}): AdminMockExamStatus {
  return {
    event: EVENT, registrations: { kozep: 80, emelt: 40, teacherSourced: 30, groups: 2 }, started: 90, inProgress: 5, submitted: 80, abandoned: 3,
    graded: 70, pendingGrading: 10, gradingErrors: [], costTodayUsd: 12, costTotalUsd: 420, totalBudgetUsd: 500, budgetUsedPercent: 84,
    budgetAlerts: { at50: '2026-11-24T10:00:00', at80: '2026-11-26T10:00:00', exhausted: null },
    queuedForAi: { count: 10, oldestSubmittedAt: '2026-11-26T09:00:00' }, neededToClearQueueUsd: 6, projectedTotalUsd: 610, queueLength: 2,
    dailyStarts: [10, 20, 0, 0, 0, 0, 0], dailySubmits: [8, 18, 0, 0, 0, 0, 0], dailyPercentHistogram: Array.from({ length: 7 }, () => Array(10).fill(0)),
    badgesAwarded: { participant: 0, silver: 0, gold: 0 },
    marketing: { newAccountsFromEvent: 0, newAccountsViaTeacher: 0, participants: 80, payers7: 0, payers30: 0, revenue7: 0, revenue30: 0,
      aiCostUsd: 420, revenueToAiCostRatio: null, roiAvailable: false, bySource: [] },
    ...over,
  };
}

/** Az élő frissítés setInterval-ja miatt a whenStable() nem teljesülne - néhány makrotask-kör elég a betöltéshez. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

const LEADERBOARD = [
  { registrationId: 11, level: 'kozep', publicName: 'Anna', rank: 1, percent: 92.5, hiddenByAdminAt: null },
  { registrationId: 12, level: 'kozep', publicName: 'Csúnya Név', rank: 2, percent: 80, hiddenByAdminAt: '2026-11-30T19:00:00' },
];

describe('AdminProbaerettsegiComponent', () => {
  async function render(s: AdminMockExamStatus) {
    const api = { list: vi.fn(() => of([EVENT])), status: vi.fn(() => of(s)), raiseBudget: vi.fn(() => of(EVENT)), taskSetOptions: vi.fn(() => of([])), create: vi.fn(() => of(EVENT)),
      leaderboard: vi.fn(() => of(LEADERBOARD)), hideRegistration: vi.fn(() => of(undefined)) };
    const confirm = { ask: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [AdminProbaerettsegiComponent],
      providers: [{ provide: AdminMockExamService, useValue: api }, { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(AdminProbaerettsegiComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, api, confirm, toast: TestBed.inject(ToastService) };
  }

  afterEach(() => vi.restoreAllMocks());

  it('keret-sáv: elköltés, vetítés, 80%-os riasztás, MI-re váró sor', async () => {
    const { el } = await render(status());
    const budget = el.querySelector('[data-testid="mock-budget"]')!.textContent!;
    expect(budget).toContain('420.00 $');
    expect(budget).toContain('80%');
    expect(el.querySelector('[data-testid="mock-queue"]')?.textContent).toContain('10 beadás');
  });

  it('keret-emelés: a javasolt összeg előtöltve, megerősítés után hívja az API-t; lefelé nem enged', async () => {
    const { fixture, el, api, confirm } = await render(status());
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('400').mockReturnValueOnce('800');

    (el.querySelector('[data-testid="mock-raise"]') as HTMLButtonElement).click();
    await settle();
    expect(api.raiseBudget).not.toHaveBeenCalled();

    (el.querySelector('[data-testid="mock-raise"]') as HTMLButtonElement).click();
    await settle();
    expect(prompt.mock.calls[0][1]).toBe('600'); // 500 + max(6, 100)
    expect(confirm.ask).toHaveBeenCalled();
    expect(api.raiseBudget).toHaveBeenCalledWith(4, 800);
  });

  it('marketing: közzététel előtt tájékoztat, üres forrás-táblánál „Még nincs jelentkező”; teli tábla tölcsérrel', async () => {
    const empty = await render(status());
    expect(empty.el.querySelector('[data-testid="mock-marketing"]')!.textContent).toContain('a közzététel után számolódik');
    expect(empty.el.querySelector('[data-testid="mock-sources"]')!.textContent).toContain('Még nincs jelentkező');

    TestBed.resetTestingModule();
    const full = await render(status({ marketing: { ...status().marketing, roiAvailable: true, payers30: 3, revenue30: 99000, revenueToAiCostRatio: 0.7,
      bySource: [{ source: 'utm:instagram/osz', registered: 40, started: 30, submitted: 24, payers7: 1, payers30: 3, revenue30: 99000 }] } }));
    const table = full.el.querySelector('[data-testid="mock-sources"]')!.textContent!.replace(/\s+/g, ' ');
    expect(table).toContain('UTM: instagram/osz');
    expect(table).toContain('30 (75%)');
    expect(table).toContain('3 (13%)');
    expect(full.el.querySelector('[data-testid="mock-marketing"]')!.textContent).toContain('0.7×');
  });

  it('új esemény üres kötelező mezővel: nem küld, érthető magyar üzenet (nem a szerver nyers hibája)', async () => {
    const { fixture, el, api, toast } = await render(status());
    (el.querySelector('[data-testid="mock-new"]') as HTMLButtonElement).click();
    await settle();
    fixture.detectChanges();
    await settle(); // az ngModel-vezérlők érvényessége a következő körben áll be
    fixture.detectChanges();
    (el.querySelector('[data-testid="mock-form"] button[type="submit"]') as HTMLButtonElement).click();
    await settle();
    expect(api.create).not.toHaveBeenCalled();
    expect(toast.danger).toHaveBeenCalledWith(expect.stringContaining('Gyakorlóként felszabadul'));
  });

  it('toplista-moderálás: a becenevesek listája; levétel megerősítéssel, visszahelyezés közvetlenül', async () => {
    const { fixture, el, api, confirm } = await render(status());
    const table = el.querySelector('[data-testid="mock-leaderboard"]')!.textContent!;
    expect(table).toContain('Anna');
    expect(table).toContain('(levéve)');

    (el.querySelector('[data-testid="mock-hide-11"]') as HTMLButtonElement).click();
    await settle();
    expect(confirm.ask).toHaveBeenCalled();
    expect(api.hideRegistration).toHaveBeenCalledWith(11, true);

    confirm.ask.mockClear();
    (el.querySelector('[data-testid="mock-hide-12"]') as HTMLButtonElement).click();
    await settle();
    fixture.detectChanges();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(api.hideRegistration).toHaveBeenCalledWith(12, false);
  });

  it('időpont-segédek: zóna nélküli UTC, budapesti űrlap-érték; konverzió', () => {
    expect(asUtc('2026-11-23T05:00:00').toISOString()).toBe('2026-11-23T05:00:00.000Z');
    expect(toBudapestInput('2026-11-23T05:00:00')).toBe('2026-11-23T06:00');
    expect(toBudapestInput('2026-10-26T07:00:00Z')).toBe('2026-10-26T08:00');
    expect(conversion(1, 0)).toBeNull();
  });
});
