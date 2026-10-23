import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminNovekedesComponent } from './admin-novekedes.component';
import {
  GrowthCancellations, GrowthCohort, GrowthOverview, ReferralReport, RevenueMonth, RevenueReport, TrialFunnel, UnitEconomics,
} from '../../models/growth.model';

const BASE = 'http://localhost:7090/api/admin/growth';

const OVERVIEW: GrowthOverview = {
  registrations30: 1234, activationRate: 0.5, newPayers30: 3, activePayers: 17, cancellations30: 2, cancellationRate30: 0.105,
};
const COHORTS_12: GrowthCohort[] = [
  { weekStart: '2026-09-28', registered: 10, activated: 6, paid: 0, retainedWeek1: null, retainedWeek4: null, retainedWeek8: null },
  { weekStart: '2026-08-03', registered: 4, activated: 2, paid: 1, retainedWeek1: 3, retainedWeek4: 2, retainedWeek8: 0 },
  { weekStart: '2026-07-27', registered: 0, activated: null, paid: 0, retainedWeek1: 0, retainedWeek4: 0, retainedWeek8: 0 },
];
const COHORTS_26: GrowthCohort[] = [
  { weekStart: '2026-04-06', registered: 20, activated: 20, paid: 5, retainedWeek1: 10, retainedWeek4: 4, retainedWeek8: 1 },
];
const CANCELLATIONS: GrowthCancellations = {
  days: 90, total: 5, withReason: 3,
  reasons: [{ key: 'vizsga-utan', label: 'Túl vagyok az érettségin', count: 2 }, { key: 'draga', label: 'Túl drága', count: 1 }],
  recent: [{ createdAt: '2026-09-20T10:00:00', reason: 'Túl drága', comment: 'Nyáron nem kell' }],
};
const month = (m: string, net: number, refunds = 0): RevenueMonth => ({
  month: m, subscription: net + refunds, examPass: 0, parentPurchase: 0, gift: 0, giftCount: 0, gross: net + refunds, refunds, net,
  paymentCount: 1, refundCount: refunds ? 1 : 0,
});
const REVENUE: RevenueReport = {
  months: [month('2026-08', -1500, 1500), month('2026-09', 1234567), { ...month('2026-10', 8600, 400), examPass: 4990, parentPurchase: 2990, gift: 2990, giftCount: 2 }],
  recurringMonthlyEstimate: 45000, recurringSubscriptions: 15, activeExamPasses: 3,
  licences: { activeLicences: 2, seats: 60, seatsInUse: 41, amountsTracked: false },
};
const TRIAL_12: TrialFunnel = {
  trialGrantsInPeriod: 9,
  cohorts: [
    { weekStart: '2026-10-19', registered: 5, trialStarted: 4, trialEnded: 0, trialPaid: 0, paidWithoutTrial: 1 },
    { weekStart: '2026-10-05', registered: 12, trialStarted: 4, trialEnded: 4, trialPaid: 1, paidWithoutTrial: 0 },
    { weekStart: '2026-09-28', registered: 2, trialStarted: 0, trialEnded: 0, trialPaid: 0, paidWithoutTrial: 2 },
  ],
};
const TRIAL_26: TrialFunnel = {
  trialGrantsInPeriod: 30,
  cohorts: [{ weekStart: '2026-05-04', registered: 26, trialStarted: 10, trialEnded: 10, trialPaid: 3, paidWithoutTrial: 1 }],
};
const UNIT: UnitEconomics = {
  usdToHuf: 360,
  months: [
    { month: '2026-09', aiCostUsd: 1.25, aiCostHuf: 450, unknownCostCalls: 0, activeUsers: 0, payingUsers: 0, netRevenue: -1500,
      aiCostPerActiveUserHuf: null, aiCostPerPayingUserHuf: null, revenuePerPayingUserHuf: null, marginRate: -0.3 },
    { month: '2026-10', aiCostUsd: 10, aiCostHuf: 3600, unknownCostCalls: 2, activeUsers: 30, payingUsers: 12, netRevenue: 1234567,
      aiCostPerActiveUserHuf: 120, aiCostPerPayingUserHuf: 300, revenuePerPayingUserHuf: 1717.4, marginRate: 0.581 },
  ],
  topDrivers: [{ source: 'grading', costUsd: 8, costHuf: 2880, requests: 40, share: 0.8 }, { source: 'valami-uj', costUsd: 2, costHuf: 720, requests: 90, share: 0.2 }],
};
const REFERRALS: ReferralReport = {
  created: 20, created30: 6, converted: 7, inviteeRewards: 7, referrerRewardMonths: 4, referrerExtend: 3, referrerCode: 1, referrerCapped: 1,
  referrerRefunded: 0, pending: 2, pendingOverdue: 1,
  topInviters: [
    { userId: 42, email: 'ajanlo@diak.hu', invited: 5, converted: 3, rewardMonths: 2, pending: 1 },
    { userId: 7, email: '=cmd;"x"', invited: 1, converted: 0, rewardMonths: 0, pending: 0 },
    { userId: 9, email: null, invited: 2, converted: 1, rewardMonths: 1, pending: 0 },
  ],
};

/**
 * Karakterizáció (a WP-C7 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a teljes Növekedés oldal a
 * valódi AdminGrowthService-szel + HttpTestingController, csak DOM-on keresztül (betöltés, az 5 fül teljes szövege, hét-váltás,
 * hibák, lusta fül-betöltés, a 4 CSV-letöltés pontos tartalma).
 */
describe('AdminNovekedesComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminNovekedesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const { createObjectURL, revokeObjectURL } = URL;

  const text = (root: Element = el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const req = (path: string, param?: [string, number]): TestRequest =>
    http.expectOne((r) => r.url === `${BASE}/${path}` && (param ? r.params.get(param[0]) === String(param[1]) : r.params.keys().length === 0));
  const noReq = (path: string) => http.expectNone((r) => r.url === `${BASE}/${path}`);
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger')?.textContent?.trim() ?? null;
  const tabButtons = () => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const weekButtons = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Hetek"] button')];
  /** A fülsor utáni tartalom szövege (a hiba-sor és a spinner nélkül). */
  const content = () => {
    const nav = el.querySelector('[data-testid="growth-tabs"]')!;
    const clone = nav.parentElement!.cloneNode(true) as HTMLElement;
    const cnav = clone.querySelector('[data-testid="growth-tabs"]')!;
    while (cnav.previousSibling) cnav.previousSibling.remove();
    cnav.remove();
    clone.querySelectorAll('p.text-danger, app-local-spinner').forEach((n) => n.remove());
    return text(clone);
  };
  const rowTexts = (testId: string) => [...el.querySelectorAll(`[data-testid="${testId}"] tbody tr`)].map((tr) => text(tr));
  async function tab(label: string) {
    tabButtons().find((b) => text(b) === label)!.click();
    await settle();
  }
  async function week(w: number) {
    weekButtons().find((b) => text(b) === `${w} hét`)!.click();
    await settle();
  }
  async function loaded() {
    await settle();
    req('overview').flush(OVERVIEW);
    req('cohorts', ['weeks', 12]).flush(COHORTS_12);
    req('cancellations', ['days', 90]).flush(CANCELLATIONS);
    await settle();
  }
  /** A CSV-gomb megnyomása; a letöltött fájl neve és a BOM utáni szöveg. */
  async function csv(): Promise<{ name: string; body: string }> {
    let blob: Blob | undefined;
    let name = '';
    Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => { blob = b; return 'blob:teszt'; }), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'CSV letöltése')!.click();
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    return { name, body: new TextDecoder().decode(bytes.slice(3)) };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminNovekedesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminNovekedesComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.restoreAllMocks();
    http.verify();
  });

  it('betöltés: a három kérés együtt indul, a spinner mindhárom végéig látszik, a többi fül nem tölt', async () => {
    await settle();
    expect(spinner()).toBe(1);
    const ov = req('overview');
    const co = req('cohorts', ['weeks', 12]);
    const ca = req('cancellations', ['days', 90]);
    noReq('revenue');
    noReq('trial-funnel');
    noReq('unit-economics');
    noReq('referrals');
    ov.flush(OVERVIEW);
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('[data-testid="growth-kpis"]')).toBeNull();
    ca.flush(CANCELLATIONS);
    await settle();
    expect(spinner()).toBe(1);
    co.flush(COHORTS_12);
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBeNull();
  });

  it('fejléc, fülsor, hét-választó; a kohorsz-fül teljes szövege', async () => {
    await loaded();
    expect(tabButtons().map((b) => [text(b), b.type, b.getAttribute('aria-selected'), b.className])).toEqual([
      ['Kohorszok', 'button', 'true', 'tab-btn whitespace-nowrap tab-btn-active'],
      ['Bevétel', 'button', 'false', 'tab-btn whitespace-nowrap'],
      ['Próba → fizetés', 'button', 'false', 'tab-btn whitespace-nowrap'],
      ['Egységgazdaság', 'button', 'false', 'tab-btn whitespace-nowrap'],
      ['Ajánlóprogram', 'button', 'false', 'tab-btn whitespace-nowrap'],
    ]);
    const nav = el.querySelector('[data-testid="growth-tabs"]')!;
    expect([nav.tagName, nav.className, nav.getAttribute('role')]).toEqual(['NAV', 'flex gap-5 overflow-x-auto border-b border-border-default mb-6', 'tablist']);
    expect(weekButtons().map((b) => [text(b), b.getAttribute('aria-pressed'), b.className])).toEqual([
      ['12 hét', 'true', 'px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-white'],
      ['26 hét', 'false', 'px-2.5 py-1 rounded-full text-xs font-bold text-text-muted'],
    ]);
    expect(text()).toBe(
      'Platform-admin Növekedés Hány új diák jön, hányan kezdenek el ténylegesen dolgozni, hányan fizetnek, ki marad meg – és miért ' +
      'mondanak le; mennyi a bevétel, mennyibe kerül az MI, és hogyan működik az ajánlóprogram. ' +
      'Kohorszok Bevétel Próba → fizetés Egységgazdaság Ajánlóprogram ' +
      'Regisztráció (30 nap) 1234 Aktiválódás (7 napon belül) 50% Új fizető (30 nap) 3 Most fizető 17 Lemondás (30 nap) 2 (11%) ' +
      'Heti kohorszok A regisztráció hete szerint. Aktiválódott: feladatsort, kvízt vagy projektet indított az első 7 napban. ' +
      'Megmaradt: abban a héten is dolgozott. A cella színe az arányt mutatja. 12 hét 26 hét ' +
      'Hét Regisztrált Aktiválódott Fizetett 1. hét 4. hét 8. hét ' +
      '2026.09.28. 10 6 (60%) 0 (0%) – – – 2026.08.03. 4 2 (50%) 1 (25%) 3 (75%) 2 (50%) 0 (0%) 2026.07.27. 0 – 0 0 0 0 ' +
      'Miért mondanak le? (utolsó 90 nap) 5 fizetős lemondás, ebből 3 adott okot (nem kötelező). Túl vagyok az érettségin 2 Túl drága 1 ' +
      'Legutóbbi megjegyzések 2026.09.20. · Túl drága Nyáron nem kell',
    );
  });

  it('kohorsz-cellák háttere és a lemondási okok sávszélessége', async () => {
    await loaded();
    const styles = [...el.querySelectorAll('[data-testid="growth-cohorts"] tbody td')].map((td) => td.getAttribute('style'));
    const heat = (p: number) => `background: color-mix(in srgb, var(--color-primary) ${p}%, transparent);`;
    expect(styles).toEqual([
      null, null, heat(32), null, null, null, null,
      null, null, heat(28), heat(18), heat(38), heat(28), null,
      null, null, null, null, null, null, null,
    ]);
    const widths = [...el.querySelectorAll('[data-testid="growth-reasons"] .bg-primary')].map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(['100%', '50%']);
  });

  it('hét-váltás: csak a kohorszok töltődnek újra, közben a régi táblázat marad spinner nélkül', async () => {
    await loaded();
    await week(26);
    noReq('overview');
    noReq('cancellations');
    const r = req('cohorts', ['weeks', 26]);
    expect(spinner()).toBe(0);
    expect(rowTexts('growth-cohorts')[0]).toContain('2026.09.28.');
    expect(weekButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    r.flush(COHORTS_26);
    await settle();
    expect(rowTexts('growth-cohorts')).toEqual(['2026.04.06. 20 20 (100%) 5 (25%) 10 (50%) 4 (20%) 1 (5%)']);
    expect(errorText()).toBeNull();
  });

  it('az aktív hét újrakattintása is újratölti a kohorszokat', async () => {
    await loaded();
    await week(12);
    req('cohorts', ['weeks', 12]).flush(COHORTS_26);
    await settle();
    expect(rowTexts('growth-cohorts')[0]).toContain('2026.04.06.');
  });

  it('gyors hét-váltás: az előző kohorsz-kérés lemondódik, a későbbi válasz nyer (WP-C7 javulás)', async () => {
    await loaded();
    await week(26);
    const first = req('cohorts', ['weeks', 26]);
    await week(12);
    expect(first.cancelled).toBe(true);
    req('cohorts', ['weeks', 12]).flush(COHORTS_12);
    await settle();
    expect(rowTexts('growth-cohorts')[0]).toContain('2026.09.28.');
  });

  it('hét-váltás hibája: üzenet, a korábbi táblázat és a többi adat marad', async () => {
    await loaded();
    await week(26);
    fail(req('cohorts', ['weeks', 26]));
    await settle();
    expect(errorText()).toBe('A kohorszok betöltése nem sikerült.');
    expect(rowTexts('growth-cohorts')[0]).toContain('2026.09.28.');
    expect(el.querySelector('[data-testid="growth-kpis"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="growth-reasons"]')).not.toBeNull();
    expect(spinner()).toBe(0);
  });

  for (const failing of ['overview', 'cohorts', 'cancellations'] as const) {
    it(`első betöltés hibája (${failing}): csak a hibaüzenet, se spinner, se tartalom`, async () => {
      await settle();
      const reqs = { overview: req('overview'), cohorts: req('cohorts', ['weeks', 12]), cancellations: req('cancellations', ['days', 90]) };
      fail(reqs[failing]);
      await settle();
      for (const [k, r] of Object.entries(reqs)) {
        if (k !== failing && !r.cancelled) r.flush(k === 'overview' ? OVERVIEW : k === 'cohorts' ? COHORTS_12 : CANCELLATIONS);
      }
      await settle();
      expect(errorText()).toBe('A növekedési adatok betöltése nem sikerült.');
      expect(spinner()).toBe(0);
      expect(content()).toBe('');
    });
  }

  it('fülváltás: a kohorsz-adat megmarad, visszalépve nincs új kérés', async () => {
    await loaded();
    await tab('Bevétel');
    req('revenue', ['months', 12]).flush(REVENUE);
    await settle();
    expect(el.querySelector('[data-testid="growth-kpis"]')).toBeNull();
    await tab('Kohorszok');
    noReq('overview');
    noReq('cohorts');
    noReq('cancellations');
    expect(el.querySelector('[data-testid="growth-kpis"]')).not.toBeNull();
    expect(tabButtons().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('Bevétel: spinner, teljes szöveg, sávszélességek; minden megnyitáskor újratölt', async () => {
    await loaded();
    await tab('Bevétel');
    expect(spinner()).toBe(1);
    expect(content()).toBe('');
    req('revenue', ['months', 12]).flush(REVENUE);
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toBe(
      'Nettó bevétel (folyó hónap) 8,600 Ft Nettó bevétel (3 hónap) 1,241,667 Ft Becsült havi ismétlődő bevétel 45,000 Ft ' +
      '15 megújuló előfizetés, listaáron Aktív érettségi-bérlet 3 egyszeri, nem újul meg ' +
      'Havi bevétel termékenként Sikeres Stripe-fizetések a fizetés napja szerint (magyar naptári hónap); a visszatérítés a ' +
      'visszatérítés hónapjában csökkenti a nettót. Az ajándékkód-vásárlás összege nincs tárolva: a csomag mostani listaárán becsült, ' +
      'a bérlet-ajándék csak darabként szerepel. CSV letöltése ' +
      'Hónap Előfizetés Bérlet Szülői Ajándék (becsült) Visszatérítés Nettó ' +
      '2026-10 9,000 4,990 2,990 2,990 (2 db) −400 8,600 2026-09 1,234,567 0 0 0 0 1,234,567 2026-08 0 0 0 0 −1,500 -1,500 ' +
      'Intézményi licencek 2 aktív licenc, 41 / 60 hely foglalt. A licencek kézi számlázásúak, az összegük nincs rögzítve ' +
      '(csak a számlázási megjegyzés) – a bevételben nem szerepelnek.',
    );
    const widths = [...el.querySelectorAll('[data-testid="revenue-months"] .bg-primary')].map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual([`${8600 / 1234567 * 100}%`, '100%', '0%']); // a negatív nettó 0 széles
    expect(rowTexts('revenue-months').map((r) => r.slice(0, 7))).toEqual(['2026-10', '2026-09', '2026-08']);
    await tab('Ajánlóprogram');
    req('referrals').flush(REFERRALS);
    await tab('Bevétel');
    req('revenue', ['months', 12]).flush(REVENUE);
    await settle();
    expect(rowTexts('revenue-months').length).toBe(3);
  });

  it('Bevétel: CSV a nyers számokkal (tagolás nélkül, tizedesvesszővel)', async () => {
    await loaded();
    await tab('Bevétel');
    req('revenue', ['months', 12]).flush(REVENUE);
    await settle();
    expect(await csv()).toEqual({
      name: 'bevetel.csv',
      body: 'Hónap;Előfizetés;Bérlet;Szülői;Ajándék (becsült);Ajándék db;Bruttó;Visszatérítés;Nettó;Fizetések;Visszatérítések\r\n' +
        '2026-08;0;0;0;0;0;0;1500;-1500;1;1\r\n' +
        '2026-09;1234567;0;0;0;0;1234567;0;1234567;1;0\r\n' +
        '2026-10;9000;4990;2990;2990;2;9000;400;8600;1;1',
    });
  });

  it('Próba → fizetés: teljes szöveg, hét-váltás (közben a régi marad), CSV', async () => {
    await loaded();
    await tab('Próba → fizetés');
    expect(spinner()).toBe(1);
    req('trial-funnel', ['weeks', 12]).flush(TRIAL_12);
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toBe(
      'Regisztrált 19 Próbát kezdett 8 Próba → fizetés (lejárt próbák) 25% Próba nélkül fizetett 3 ' +
      'Próba → fizetés heti kohorszonként A regisztráció hete szerint. Átváltás: a próbázók közül hányan fizettek (vagy aktiváltak ' +
      'ajándékot) – a még futó próbák miatt a friss hetek alacsonyabbak. Ellenőrzés: 9 próba-kiadás az időszakban ' +
      '(e-mail-napló, tesztfiókokkal együtt). 12 hét 26 hét CSV letöltése ' +
      'Hét Regisztrált Próbát kezdett Próba lejárt Próba után fizetett Átváltás Próba nélkül fizetett ' +
      '2026.10.19. 5 4 0 0 0% 1 2026.10.05. 12 4 4 1 25% 0 2026.09.28. 2 0 0 0 – 2',
    );
    expect(await csv()).toEqual({
      name: 'proba-tolcser.csv',
      body: 'Hét;Regisztrált;Próbát kezdett;Próba lejárt;Próba után fizetett;Próba nélkül fizetett\r\n' +
        '2026-10-19;5;4;0;0;1\r\n2026-10-05;12;4;4;1;0\r\n2026-09-28;2;0;0;0;2',
    });
    await week(26);
    const r = req('trial-funnel', ['weeks', 26]);
    expect(spinner()).toBe(0);
    expect(rowTexts('trial-cohorts')[0]).toContain('2026.10.19.');
    expect(weekButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    r.flush(TRIAL_26);
    await settle();
    expect(rowTexts('trial-cohorts')).toEqual(['2026.05.04. 26 10 10 3 30% 1']);
    expect(text(el.querySelector('[data-testid="trial-kpis"]')!)).toBe(
      'Regisztrált 26 Próbát kezdett 10 Próba → fizetés (lejárt próbák) 30% Próba nélkül fizetett 1');
  });

  it('Próba → fizetés: az aktív hét újrakattintása is újratölt', async () => {
    await loaded();
    await tab('Próba → fizetés');
    req('trial-funnel', ['weeks', 12]).flush(TRIAL_12);
    await settle();
    await week(12);
    req('trial-funnel', ['weeks', 12]).flush(TRIAL_26);
    await settle();
    expect(rowTexts('trial-cohorts')[0]).toContain('2026.05.04.');
  });

  it('Próba → fizetés: a hét-váltás hibája üzenetet ad, a korábbi adat marad', async () => {
    await loaded();
    await tab('Próba → fizetés');
    req('trial-funnel', ['weeks', 12]).flush(TRIAL_12);
    await settle();
    await week(26);
    fail(req('trial-funnel', ['weeks', 26]));
    await settle();
    expect(errorText()).toBe('A próba-tölcsér betöltése nem sikerült.');
    expect(rowTexts('trial-cohorts')[0]).toContain('2026.10.19.');
    expect(spinner()).toBe(0);
  });

  it('Egységgazdaság: teljes szöveg, árrés-színek, költségforrás-sávok, CSV', async () => {
    await loaded();
    await tab('Egységgazdaság');
    expect(spinner()).toBe(1);
    req('unit-economics', ['months', 12]).flush(UNIT);
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toBe(
      'Havi egységgazdaság Aktív: dolgozott a hónap valamelyik hetében. Fizető: a hónap bármely napján érvényes fizetős előfizetése ' +
      'volt. MI-költség forintban 360 Ft/$ árfolyammal (MockExam:UsdToHuf). Árrés: (nettó bevétel − MI-költség) / nettó bevétel – ' +
      'a Judge0 és a szerver költsége nélkül. CSV letöltése ' +
      'Hónap MI-költség Aktív Fizető MI / aktív MI / fizető Bevétel / fizető Nettó bevétel Árrés ' +
      '2026-10 3,600 Ft * 30 12 120 Ft 300 Ft 1,717 Ft 1,234,567 Ft 58% 2026-09 450 Ft 0 0 – – – -1,500 Ft -30% ' +
      'Legnagyobb MI-költségforrások (utolsó 30 nap) Vizsga AI-értékelés 2,880 Ft 80% valami-uj 720 Ft 20%',
    );
    const margins = [...el.querySelectorAll('[data-testid="unit-months"] tbody tr td:last-child')].map((td) => td.className);
    expect(margins).toEqual(['text-right tabular-nums font-semibold text-success', 'text-right tabular-nums font-semibold text-danger']);
    expect(el.querySelector('[data-testid="unit-months"] .text-warning')?.getAttribute('title')).toBe('2 hívás költség nélkül');
    const widths = [...el.querySelectorAll('[data-testid="unit-drivers"] .bg-primary')].map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(['80%', '20%']);
    expect(await csv()).toEqual({
      name: 'egyseggazdasag.csv',
      body: 'Hónap;MI-költség ($);MI-költség (Ft);Költség nélküli hívás;Aktív;Fizető;MI / aktív (Ft);MI / fizető (Ft);' +
        'Bevétel / fizető (Ft);Nettó bevétel (Ft);Árrés\r\n' +
        '2026-09;1,25;450;0;0;0;;;;-1500;-0,3\r\n2026-10;10;3600;2;30;12;120;300;1717,4;1234567;0,581',
    });
  });

  it('Egységgazdaság: üres költségforrás-lista', async () => {
    await loaded();
    await tab('Egységgazdaság');
    req('unit-economics', ['months', 12]).flush({ ...UNIT, topDrivers: [] });
    await settle();
    expect(text(el.querySelector('[data-testid="unit-drivers"]')!)).toBe('Nem volt MI-hívás az utolsó 30 napban.');
  });

  it('Ajánlóprogram: teljes szöveg és CSV (képlet-semlegesítés, idézőjelezés, üres e-mail)', async () => {
    await loaded();
    await tab('Ajánlóprogram');
    expect(spinner()).toBe(1);
    req('referrals').flush(REFERRALS);
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toBe(
      'Meghívás 20 ebből 6 az utolsó 30 napban Fizetett meghívott 7 7 meghívott kapott +30 napot Ajánlói jutalom-hónap 4 ' +
      '3 hosszabbítás, 1 ajándékkód; 1 korlát, 0 visszatérítés miatt nem Függő (14 napos várakozás) 2 ' +
      '1 lejárt, a napi job még nem dolgozta fel Legjobb ajánlók CSV letöltése Felhasználó Meghívott Fizetett Jutalom-hónap Függő ' +
      '#42 ajanlo@diak.hu 5 3 2 1 #7 =cmd;"x" 1 0 0 0 #9 – 2 1 1 0',
    );
    expect(await csv()).toEqual({
      name: 'ajanlok.csv',
      body: 'Felhasználó Id;E-mail;Meghívott;Fizetett;Jutalom-hónap;Függő\r\n' +
        `42;ajanlo@diak.hu;5;3;2;1\r\n7;"'=cmd;""x""";1;0;0;0\r\n9;;2;1;1;0`,
    });
  });

  it('Ajánlóprogram: nincs meghívás, nincs lejárt függő', async () => {
    await loaded();
    await tab('Ajánlóprogram');
    req('referrals').flush({ ...REFERRALS, pendingOverdue: 0, topInviters: [] });
    await settle();
    expect(rowTexts('referral-inviters')).toEqual(['Még nincs meghívás.']);
    expect(el.querySelector('[data-testid="referral-kpis"] .text-warning')).toBeNull();
  });

  for (const [label, path, param, message] of [
    ['Bevétel', 'revenue', ['months', 12], 'A bevételi adatok betöltése nem sikerült.'],
    ['Próba → fizetés', 'trial-funnel', ['weeks', 12], 'A próba-tölcsér betöltése nem sikerült.'],
    ['Egységgazdaság', 'unit-economics', ['months', 12], 'Az egységgazdasági adatok betöltése nem sikerült.'],
    ['Ajánlóprogram', 'referrals', undefined, 'Az ajánlóprogram adatainak betöltése nem sikerült.'],
  ] as const) {
    it(`${label}: betöltési hiba → üzenet, nincs spinner, nincs tartalom; újra megnyitva újrapróbál`, async () => {
      await loaded();
      await tab(label);
      fail(req(path, param ? [param[0], param[1]] : undefined));
      await settle();
      expect(errorText()).toBe(message);
      expect(spinner()).toBe(0);
      expect(content()).toBe('');
      await tab('Kohorszok');
      expect(errorText()).toBeNull();
      await tab(label);
      expect(errorText()).toBeNull();
      expect(spinner()).toBe(1);
      req(path, param ? [param[0], param[1]] : undefined).flush(null);
      await settle();
    });
  }
});
