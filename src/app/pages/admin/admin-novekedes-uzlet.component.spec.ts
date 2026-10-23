import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminNovekedesComponent } from './admin-novekedes.component';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { toCsv } from '../../shared/csv/csv';

describe('Tulajdonosi irányítópult (Növekedés fülei)', () => {
  const month = (m: string, net: number, refunds = 0) => ({
    month: m, subscription: net, examPass: 0, parentPurchase: 0, gift: 0, giftCount: 0, gross: net + refunds, refunds, net, paymentCount: 1, refundCount: refunds ? 1 : 0,
  });

  function setup() {
    const api = {
      getOverview: vi.fn(() => of({ registrations30: 1, activationRate: null, newPayers30: 0, activePayers: 0, cancellations30: 0, cancellationRate30: null })),
      getCohorts: vi.fn(() => of([])),
      getCancellations: vi.fn(() => of({ days: 90, total: 0, withReason: 0, reasons: [], recent: [] })),
      getRevenue: vi.fn(() => of({
        months: [month('2026-09', 12000), { ...month('2026-10', 8600, 400), gift: 2990, giftCount: 2 }],
        recurringMonthlyEstimate: 45000, recurringSubscriptions: 15, activeExamPasses: 3,
        licences: { activeLicences: 2, seats: 60, seatsInUse: 41, amountsTracked: false },
      })),
      getTrialFunnel: vi.fn((weeks: number) => of({
        trialGrantsInPeriod: 9,
        cohorts: [
          { weekStart: '2026-10-19', registered: 5, trialStarted: 4, trialEnded: 0, trialPaid: 0, paidWithoutTrial: 1 },
          { weekStart: '2026-10-05', registered: weeks, trialStarted: 4, trialEnded: 4, trialPaid: 1, paidWithoutTrial: 0 },
        ],
      })),
      getUnitEconomics: vi.fn(() => of({
        usdToHuf: 360,
        months: [{ month: '2026-10', aiCostUsd: 10, aiCostHuf: 3600, unknownCostCalls: 2, activeUsers: 30, payingUsers: 12, netRevenue: 8600,
          aiCostPerActiveUserHuf: 120, aiCostPerPayingUserHuf: 300, revenuePerPayingUserHuf: 717, marginRate: 0.581 }],
        topDrivers: [{ source: 'grading', costUsd: 8, costHuf: 2880, requests: 40, share: 0.8 }, { source: 'chat', costUsd: 2, costHuf: 720, requests: 90, share: 0.2 }],
      })),
      getReferrals: vi.fn(() => of({
        created: 20, created30: 6, converted: 7, inviteeRewards: 7, referrerRewardMonths: 4, referrerExtend: 3, referrerCode: 1, referrerCapped: 1,
        referrerRefunded: 0, pending: 2, pendingOverdue: 1,
        topInviters: [{ userId: 42, email: 'ajanlo@diak.hu', invited: 5, converted: 3, rewardMonths: 2, pending: 1 }],
      })),
    };
    TestBed.configureTestingModule({ imports: [AdminNovekedesComponent], providers: [{ provide: AdminGrowthService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminNovekedesComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const open = (label: string) => {
      [...el.querySelectorAll('[role="tab"]')].find((b) => b.textContent!.trim() === label)!.dispatchEvent(new Event('click'));
      fixture.detectChanges();
    };
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ') ?? '';
    return { fixture, el, api, open, text };
  }

  it('a fülek csak megnyitáskor töltenek; a kohorszok az alapfül', () => {
    const { api, el, open } = setup();
    expect(el.querySelector('[data-testid="growth-kpis"]')).not.toBeNull();
    expect(api.getRevenue).not.toHaveBeenCalled();
    open('Bevétel');
    expect(api.getRevenue).toHaveBeenCalledWith(12);
    expect(el.querySelector('[data-testid="growth-kpis"]')).toBeNull();
  });

  it('Bevétel: legfrissebb hónap elöl, visszatérítés, ajándék-darab, licencnél az összeg nincs tárolva', () => {
    const { open, el, text } = setup();
    open('Bevétel');
    const rows = [...el.querySelectorAll('[data-testid="revenue-months"] tbody tr')].map((r) => r.textContent!.replace(/\s+/g, ' '));
    expect(rows[0]).toContain('2026-10');
    expect(rows[0]).toContain('(2 db)');
    expect(rows[0]).toContain('−400');
    expect(text('[data-testid="revenue-kpis"]')).toContain('20,600'); // 12 hónap nettó összege
    expect(text('[data-testid="revenue-kpis"]')).toContain('45,000');
    expect(text('[data-testid="revenue-licences"]')).toContain('41 / 60');
    expect(text('[data-testid="revenue-licences"]')).toContain('nincs rögzítve');
  });

  it('Próba → fizetés: átváltás csak a lezárt próbájú heteken, hét-váltás újratölt', () => {
    const { open, text, el, fixture, api } = setup();
    open('Próba → fizetés');
    expect(text('[data-testid="trial-kpis"]')).toContain('25%'); // 1 / 4 a lezárt héten, a futó hét nem számít
    expect(text('[data-testid="trial-cohorts"]')).toContain('2026.10.19.');
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === '26 hét')!.click();
    fixture.detectChanges();
    expect(api.getTrialFunnel).toHaveBeenLastCalledWith(26);
  });

  it('Egységgazdaság: per-fő költség, árrés, költségforrás magyar címkével', () => {
    const { open, text } = setup();
    open('Egységgazdaság');
    expect(text('[data-testid="unit-months"]')).toContain('58%');
    expect(text('[data-testid="unit-months"]')).toContain('300 Ft');
    expect(text('[data-testid="unit-drivers"]')).toContain('Vizsga AI-értékelés');
    expect(text('[data-testid="unit-drivers"]')).toContain('80%');
  });

  it('Ajánlóprogram: függő és lejárt jutalom, legjobb ajánlók', () => {
    const { open, text } = setup();
    open('Ajánlóprogram');
    expect(text('[data-testid="referral-kpis"]')).toContain('1 lejárt');
    expect(text('[data-testid="referral-inviters"]')).toContain('ajanlo@diak.hu');
  });

  it('CSV: pontosvessző, tizedesvessző, idézőjelezés és képlet-semlegesítés', () => {
    expect(toCsv(['a', 'b'], [[1.5, 'x;y'], ['=SUM(A1)', null]])).toBe('a;b\r\n1,5;"x;y"\r\n\'=SUM(A1);');
  });
});
