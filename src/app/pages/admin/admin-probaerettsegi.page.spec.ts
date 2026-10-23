import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminProbaerettsegiComponent } from './admin-probaerettsegi.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import {
  AdminMockExam, AdminMockExamLeaderboardEntry, AdminMockExamStatus, AdminMockExamTaskSetOption, asUtc,
} from '../../models/mock-exam.model';

const BASE = 'http://localhost:7090/api/admin/mock-exams';

const EVENT: AdminMockExam = {
  id: 4, slug: 'osz-2026', title: 'Őszi próbaérettségi 2026', registrationOpensAt: '2026-10-26T07:00:00', opensAt: '2026-11-23T05:00:00',
  startClosesAt: '2026-11-29T17:00:00', resultsPlannedAt: '2026-11-30T17:00:00', resultsPublishedAt: null, practiceReleaseAt: '2026-11-30T23:00:00',
  releasedAsPracticeAt: null, kozepTaskSetId: 1, emeltTaskSetId: 2, kozepTimeLimitSeconds: 10800, emeltTimeLimitSeconds: 14400,
  totalBudgetUsd: 500, badgeKeyPrefix: 'MOCKEXAM_2026OSZ', isPublished: true, hasSessions: true, registrations: 120,
};
const SPRING: AdminMockExam = {
  ...EVENT, id: 7, slug: 'tavasz-2027', title: 'Tavaszi próba 2027', registrationOpensAt: '2027-03-01T08:00:00', opensAt: '2027-04-12T06:00:00',
  startClosesAt: '2027-04-18T16:00:00', resultsPlannedAt: '2027-04-19T16:00:00', practiceReleaseAt: '2027-04-20T22:00:00',
  isPublished: false, hasSessions: false, badgeKeyPrefix: null, registrations: 0,
};

function status(over: Partial<AdminMockExamStatus> = {}): AdminMockExamStatus {
  return {
    event: EVENT, registrations: { kozep: 80, emelt: 40, teacherSourced: 30, groups: 2 }, started: 90, inProgress: 5, submitted: 80, abandoned: 3,
    graded: 70, pendingGrading: 10, gradingErrors: [{ sessionId: 31, taskTitle: 'Táblázat', error: 'timeout' }, { sessionId: 32, taskTitle: 'Adatbázis', error: null }],
    costTodayUsd: 12, costTotalUsd: 420, totalBudgetUsd: 500, budgetUsedPercent: 84,
    budgetAlerts: { at50: '2026-11-24T10:00:00', at80: '2026-11-26T10:00:00', exhausted: null },
    queuedForAi: { count: 10, oldestSubmittedAt: '2026-11-26T09:00:00' }, neededToClearQueueUsd: 6, projectedTotalUsd: 610, queueLength: 2,
    dailyStarts: [10, 20, 0, 0, 0, 0, 0], dailySubmits: [8, 18, 0, 0, 0, 0, 0],
    dailyPercentHistogram: [[0, 1, 2, 4, 0, 0, 0, 0, 0, 0], ...Array.from({ length: 6 }, () => Array(10).fill(0))],
    badgesAwarded: { participant: 50, silver: 7, gold: 2 },
    marketing: { newAccountsFromEvent: 12, newAccountsViaTeacher: 4, participants: 80, payers7: 1, payers30: 3, revenue7: 9900, revenue30: 99000,
      aiCostUsd: 420, revenueToAiCostRatio: 0.7, roiAvailable: true,
      bySource: [
        { source: 'utm:instagram/osz', registered: 40, started: 30, submitted: 24, payers7: 1, payers30: 3, revenue30: 99000 },
        { source: 'self', registered: 0, started: 0, submitted: 0, payers7: 0, payers30: 0, revenue30: 0 },
        { source: 'teacher', registered: 30, started: 30, submitted: 0, payers7: 0, payers30: 0, revenue30: 0 },
      ] },
    ...over,
  };
}

const LEADERBOARD: AdminMockExamLeaderboardEntry[] = [
  { registrationId: 11, level: 'kozep', publicName: 'Anna', rank: 1, percent: 92.5, hiddenByAdminAt: null },
  { registrationId: 12, level: 'emelt', publicName: 'Csúnya Név', rank: null, percent: null, hiddenByAdminAt: '2026-11-30T19:00:00' },
];

const OPTIONS: AdminMockExamTaskSetOption[] = [
  { id: 1, title: 'Közép A', level: 'kozep' }, { id: 2, title: 'Emelt B', level: 'emelt' }, { id: 3, title: 'Tartalék', level: null },
];

const when = (iso: string) => formatDate(asUtc(iso), 'MMM d. HH:mm', 'en-US');

/**
 * Karakterizáció (a WP-C4 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a teljes oldal a valódi
 * AdminMockExamService-szel + HttpTestingController, csak DOM-on keresztül (betöltés, eseményváltás, élő frissítés, űrlap
 * létrehozás/módosítás budapesti idővel, közzététel, eredmény, gyakorló, törlés, keretemelés, toplista-moderálás, hibák).
 */
describe('AdminProbaerettsegiComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminProbaerettsegiComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let confirmAsk: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.spyOn>;
  let toastDanger: ReturnType<typeof vi.spyOn>;
  let liveTick: (() => void) | null;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

  const text = (root: Element = el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  const req = (path: string, method = 'GET'): TestRequest =>
    http.expectOne((r) => r.url === BASE + path && r.method === method);
  const noReq = (path: string, method = 'GET') => http.expectNone((r) => r.url === BASE + path && r.method === method);
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const section = (testId: string) => {
    const s = el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!s) throw new Error(`Nincs szakasz: ${testId}`);
    return s;
  };
  const button = (label: string, root: Element = el): HTMLButtonElement => {
    const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find((x) => text(x) === label);
    if (!b) throw new Error(`Nincs gomb: ${label}`);
    return b;
  };
  const hasButton = (label: string) => [...el.querySelectorAll('button')].some((x) => text(x) === label);
  async function click(label: string, root: Element = el) {
    button(label, root).click();
    await settle();
  }
  const field = <T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(name: string): T => {
    const f = el.querySelector<T>(`[data-testid="mock-form"] [name="${name}"]`);
    if (!f) throw new Error(`Nincs mező: ${name}`);
    return f;
  };
  async function type(name: string, value: string) {
    const f = field(name);
    f.value = value;
    f.dispatchEvent(new Event('input'));
    await settle();
  }
  async function choose(name: string, index: number) {
    const s = field<HTMLSelectElement>(name);
    s.selectedIndex = index;
    s.dispatchEvent(new Event('change'));
    await settle();
  }
  const optionTexts = (name: string) => [...field<HTMLSelectElement>(name).options].map((o) => text(o));
  async function submit() {
    button('Mentés', section('mock-form')).click();
    await settle();
  }
  async function flushStatus(id: number, s: AdminMockExamStatus = status(), lb: AdminMockExamLeaderboardEntry[] = LEADERBOARD) {
    req(`/${id}/status`).flush(s);
    req(`/${id}/leaderboard`).flush(lb);
    await settle();
  }
  async function loaded(events: AdminMockExam[] = [EVENT, SPRING]) {
    req('').flush(events);
    await settle();
    if (events.length) await flushStatus(events[0].id);
  }
  const eventButtons = () => [...el.querySelectorAll<HTMLButtonElement>('div.mb-5 > button')];
  const fail = (r: TestRequest, errorMessage?: string) =>
    r.flush(errorMessage ? { errorMessage } : null, { status: 500, statusText: 'Server Error' });

  beforeEach(() => {
    liveTick = null;
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void, ms: number) => {
      if (ms === 60_000) liveTick = fn;
      return 123;
    }) as unknown as typeof setInterval);
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    confirmAsk = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [AdminProbaerettsegiComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask: confirmAsk } }],
    });
    http = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => undefined);
    toastDanger = vi.spyOn(toast, 'danger').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(AdminProbaerettsegiComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  // ── Betöltés, megjelenítés ───────────────────────────────────────

  it('betöltés: spinner a lista ÉS az első státusz alatt; utána a lista, a státusz, a marketing és a toplista', async () => {
    expect(el.querySelector('app-local-spinner')).not.toBeNull();
    req('').flush([EVENT, SPRING]);
    await settle();
    expect(el.querySelector('app-local-spinner')).not.toBeNull();
    await flushStatus(4);
    expect(el.querySelector('app-local-spinner')).toBeNull();

    expect(eventButtons().map((b) => text(b))).toEqual(['Őszi próbaérettségi 2026', 'Tavaszi próba 2027 rejtett', '+ Új esemény']);
    expect(eventButtons()[0].className).toBe('btn btn-primary');
    expect(eventButtons()[1].className).toBe('btn btn-ghost');
    expect(el.querySelector('[data-testid="mock-form"]')).toBeNull();

    expect(text()).toBe(
      'Platform-admin Próbaérettségi Esemény, kitöltés, MI-keret és megtérülés. Az időpontokat budapesti idővel add meg. ' +
        'Őszi próbaérettségi 2026 Tavaszi próba 2027 rejtett + Új esemény ' +
        `Őszi próbaérettségi 2026 kezdhető ${when(EVENT.opensAt)} – ${when(EVENT.startClosesAt)} · eredmény ${when(EVENT.resultsPlannedAt)} ` +
        'Módosítás Elrejtés Eredmény közzététele most ' +
        'Jelentkezett 120 közép 80 · emelt 40 Tanári 30 2 csoport Elkezdte 90 most írja: 5 Beadta 80 elhagyta: 3 Értékelve 70 vár: 10 ' +
        'Jelvény 50 ezüst 7 · arany 2 ' +
        'MI-keret 80% Keret emelése 420.00 $ / 500 $ (84%) · ma 12.00 $ · vetítve 610 $ ' +
        `MI-re vár: 10 beadás (a legrégebbi ${when('2026-11-26T09:00:00')}) - a kiürítéshez kb. 6 $ kell. Értékelő sor (Hangfire): 2 ` +
        'A hét napjai Nap Indult Beadva %-eloszlás (0–100) 1. nap 10 8 2. nap 20 18 3. nap 0 0 4. nap 0 0 5. nap 0 0 6. nap 0 0 7. nap 0 0 ' +
        'Ha egy napon az eloszlás hirtelen felfelé tolódik, a feladatok kiszivároghattak. ' +
        'Értékelési hibák (2) #31 Táblázat – timeout #32 Adatbázis – ismeretlen hiba ' +
        'Marketing Új fiók az eseményből 12 tanárin át: 4 Fizető 7 nap 1 Fizető 30 nap 3 80 résztvevőből Bevétel 30 nap 99,000 Ft ' +
        'MI-költség 420.00 $ Bevétel / MI-költség 0.7× ' +
        'Forrás Jelentkező → induló → beadó → fizető (30 nap) Bevétel ' +
        'UTM: instagram/osz 40 30 (75%) 24 (80%) 3 (13%) 99,000 Ft ' +
        'Önálló (UTM nélkül) 0 0 0 0 0 Ft ' +
        'Tanári jelentkeztetés 30 30 (100%) 0 (0%) 0 0 Ft ' +
        'Toplista (becenévvel jelentkezők) A nem odaillő becenevet leveheted - a nyilvános toplistáról és a megosztott kártyáról azonnal eltűnik. ' +
        'Szint Helyezés Becenév Eredmény közép 1. Anna 92.5% Levétel emelt – Csúnya Név (levéve) – Visszahelyezés',
    );
  });

  it('megjelenítés: keret-sáv, vetítés-jelölő, hisztogram-oszlopok, tölcsér-szélességek, rejtett sor halványítva', async () => {
    await loaded();
    const bar = section('mock-budget').querySelector<HTMLElement>('[role="img"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Elköltve 420 $ / 500 $, vetítve 610 $');
    const spans = [...bar.querySelectorAll<HTMLElement>('span')];
    expect(spans[0].className).toContain('bg-danger');
    expect(spans[0].style.width).toBe('84%');
    expect(spans[3].style.left).toBe('100%'); // vetítve 122% → 100-ra vágva
    const firstDay = el.querySelector<HTMLElement>('[aria-label^="eloszlás: 0, 1, 2, 4"]')!;
    expect([...firstDay.querySelectorAll<HTMLElement>('span')].map((s) => s.style.height)).toEqual(
      ['4%', '25%', '50%', '100%', '4%', '4%', '4%', '4%', '4%', '4%'],
    );
    const funnelWidths = [...section('mock-sources').querySelectorAll<HTMLElement>('span.h-2')].map((s) => s.style.width);
    expect(funnelWidths).toEqual(['60px', '45px', '36px', '5px', '2px', '2px', '2px', '2px', '60px', '60px', '2px', '2px']);
    const rows = [...section('mock-leaderboard').querySelectorAll('tbody tr')];
    expect(rows[0].className).not.toContain('opacity-60');
    expect(rows[1].className).toContain('opacity-60');
  });

  it('megjelenítés: üres/alacsony állapot – nincs riasztás, nincs sor, olvashatatlan Hangfire-sor, nincs vetítés-jelölő 0 keretnél', async () => {
    req('').flush([SPRING]);
    await settle();
    await flushStatus(7, status({
      event: SPRING, totalBudgetUsd: 0, budgetUsedPercent: 0, costTotalUsd: 0, projectedTotalUsd: 0,
      budgetAlerts: { at50: null, at80: null, exhausted: null }, queuedForAi: { count: 0, oldestSubmittedAt: null }, queueLength: -1, gradingErrors: [],
      marketing: { ...status().marketing, roiAvailable: false, revenueToAiCostRatio: null, bySource: [] },
    }), []);
    expect(el.querySelector('[data-testid="mock-queue"]')).toBeNull();
    expect(text(section('mock-budget'))).toBe('MI-keret Keret emelése 0.00 $ / 0 $ (0%) · ma 12.00 $ · vetítve 0 $ Értékelő sor (Hangfire): nem olvasható');
    expect(section('mock-budget').querySelectorAll('[role="img"] span').length).toBe(3);
    expect(text()).toContain('Értékelési hibák (0) Nincs hiba.');
    expect(text(section('mock-marketing'))).toContain('Marketing A megtérülés (fizetők, bevétel) a közzététel után számolódik. Tesztfiókok nélkül.');
    expect(text(section('mock-marketing'))).toContain('Bevétel / MI-költség –');
    expect(text(section('mock-sources'))).toContain('Még nincs jelentkező.');
    expect(text(section('mock-leaderboard'))).toContain('Senki nem kérte a toplistás megjelenést.');
    // A nem induló, rejtett eseménynél: közzététel és törlés gomb.
    expect(hasButton('Közzététel (sötét indítás vége)')).toBe(true);
    expect(hasButton('Törlés')).toBe(true);
  });

  it('riasztás-jelvények: elfogyott > 80% > 50%', async () => {
    req('').flush([EVENT]);
    await settle();
    await flushStatus(4, status({ budgetAlerts: { at50: 'x', at80: 'x', exhausted: 'x' } }));
    expect(text(section('mock-budget').querySelector('h3')!)).toBe('MI-keret elfogyott');
  });

  it('üres lista: tájékoztató szöveg, nincs státusz-kérés', async () => {
    req('').flush([]);
    await settle();
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(text()).toContain('+ Új esemény Még nincs próbaérettségi. Hozz létre egyet az „Új esemény” gombbal.');
  });

  it('betöltési hibák: lista-hiba → toast és üres állapot; státusz-hiba → toast, a státusz rejtve', async () => {
    fail(req(''), 'Lista-hiba');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Lista-hiba');
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(text()).toContain('Még nincs próbaérettségi.');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminProbaerettsegiComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask: confirmAsk } }],
    });
    http = TestBed.inject(HttpTestingController);
    const danger = vi.spyOn(TestBed.inject(ToastService), 'danger').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(AdminProbaerettsegiComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    req('').flush([EVENT, SPRING]);
    await settle();
    req('/4/status').flush(status());
    fail(req('/4/leaderboard'));
    await settle();
    expect(danger).toHaveBeenCalledWith('A státusz betöltése nem sikerült.');
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(el.querySelector('[data-testid="mock-budget"]')).toBeNull();
    expect(eventButtons().length).toBe(3);
    expect(text()).not.toContain('Még nincs próbaérettségi.');
  });

  // ── Eseményváltás, élő frissítés ─────────────────────────────────

  it('eseményváltás: a másik esemény státusza; betöltés közben és hibánál a régi marad; az aktív újrakattintása újratölt', async () => {
    await loaded();
    eventButtons()[1].click();
    await settle();
    expect(eventButtons()[1].className).toBe('btn btn-primary');
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(text(el.querySelector('h2')!)).toBe('Őszi próbaérettségi 2026'); // még a régi
    await flushStatus(7, status({ event: SPRING }), []);
    expect(text(el.querySelector('h2')!)).toBe('Tavaszi próba 2027');

    eventButtons()[0].click();
    await settle();
    req('/4/leaderboard').flush(LEADERBOARD);
    fail(req('/4/status'));
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('A státusz betöltése nem sikerült.');
    expect(eventButtons()[0].className).toBe('btn btn-primary');
    expect(text(el.querySelector('h2')!)).toBe('Tavaszi próba 2027'); // a hiba után a korábbi státusz marad

    eventButtons()[0].click();
    await settle();
    await flushStatus(4);
    expect(text(el.querySelector('h2')!)).toBe('Őszi próbaérettségi 2026');
    eventButtons()[0].click();
    await settle();
    await flushStatus(4);
  });

  it('gyors eseményváltás: az előző, még futó státusz-kérés lemondódik (a késve érkező régi válasz nem írhatja felül) – WP-C4 javulás', async () => {
    await loaded();
    eventButtons()[1].click();
    await settle();
    eventButtons()[0].click();
    await settle();
    expect(req('/7/status').cancelled).toBe(true);
    expect(req('/7/leaderboard').cancelled).toBe(true);
    await flushStatus(4, status({ started: 99 }));
    expect(text()).toContain('Elkezdte 99');
    expect(eventButtons()[0].className).toBe('btn btn-primary');
  });

  it('élő frissítés: 60 mp-enként, csak az esemény hetében (kezdéstől az eredmény utáni napig); megszűnéskor leáll', async () => {
    await loaded();
    expect(liveTick).not.toBeNull();
    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(asUtc(EVENT.opensAt).getTime() - 1);
    liveTick!();
    await settle();
    noReq('/4/status');

    now.mockReturnValue(asUtc(EVENT.opensAt).getTime());
    liveTick!();
    await settle();
    await flushStatus(4, status({ started: 91 }));
    expect(text()).toContain('Elkezdte 91');

    now.mockReturnValue(asUtc(EVENT.resultsPlannedAt).getTime() + 86_400_000);
    liveTick!();
    await settle();
    await flushStatus(4);

    now.mockReturnValue(asUtc(EVENT.resultsPlannedAt).getTime() + 86_400_001);
    liveTick!();
    await settle();
    noReq('/4/status');

    fixture.destroy();
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
  });

  // ── Űrlap: létrehozás, módosítás ─────────────────────────────────

  it('új esemény: a sorok egyszer töltődnek, alapértékek, pontos POST, toast, a lista újratölt és az új esemény lesz kiválasztva', async () => {
    await loaded();
    await click('+ Új esemény');
    expect(el.querySelector('[data-testid="mock-form"]')).toBeNull(); // a sorok betöltéséig nincs űrlap
    req('/task-set-options').flush(OPTIONS);
    await settle();

    const form = section('mock-form');
    expect(text(form.querySelector('h2')!)).toBe('Új esemény');
    expect(text(form)).not.toContain('Már elindult');
    expect(optionTexts('kozep')).toEqual(['#1 Közép A', '#2 Emelt B', '#3 Tartalék']);
    expect(field<HTMLSelectElement>('kozep').selectedIndex).toBe(0);
    expect(field<HTMLSelectElement>('emelt').selectedIndex).toBe(1);
    expect(field('kozepMin').value).toBe('180');
    expect(field('emeltMin').value).toBe('240');
    expect(field('budget').value).toBe('500');
    expect(['title', 'slug', 'reg', 'opens', 'closes', 'results', 'practice', 'badge'].map((n) => field(n).value)).toEqual(Array(8).fill(''));

    await type('title', 'Tavaszi 2027');
    await type('slug', 'tavasz-2027');
    await type('reg', '2027-03-01T09:00');
    await type('opens', '2027-04-12T08:00');
    await type('closes', '2027-04-18T18:00');
    await type('results', '2027-04-19T18:00');
    await type('practice', '2027-04-21T00:00');
    await type('kozepMin', '90');
    await type('budget', '750');
    await choose('emelt', 2);
    await submit();

    const post = req('', 'POST');
    expect(post.request.body).toEqual({
      slug: 'tavasz-2027', title: 'Tavaszi 2027', registrationOpensAt: '2027-03-01T09:00', opensAt: '2027-04-12T08:00',
      startClosesAt: '2027-04-18T18:00', resultsPlannedAt: '2027-04-19T18:00', practiceReleaseAt: '2027-04-21T00:00',
      kozepTaskSetId: 1, emeltTaskSetId: 3, kozepTimeLimitSeconds: 5400, emeltTimeLimitSeconds: 14400, totalBudgetUsd: 750, badgeKeyPrefix: null,
    });
    expect(button('Mentés', section('mock-form')).disabled).toBe(true);
    post.flush(SPRING);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Létrehozva (rejtve - a közzétételig csak admin látja).');
    expect(el.querySelector('[data-testid="mock-form"]')).toBeNull();
    req('').flush([EVENT, SPRING]);
    await settle();
    expect(eventButtons()[1].className).toBe('btn btn-primary');
    await flushStatus(7, status({ event: SPRING }), []);
    expect(text(el.querySelector('h2')!)).toBe('Tavaszi próba 2027');

    // Másodszor már nem tölti újra a sorokat.
    await click('+ Új esemény');
    noReq('/task-set-options');
    expect(text(section('mock-form').querySelector('h2')!)).toBe('Új esemény');
  });

  it('módosítás: budapesti időkkal előtöltve, az esemény saját sorai is választhatók, „Már elindult” jelzés, pontos PUT', async () => {
    await loaded();
    await click('Módosítás');
    req('/task-set-options').flush([OPTIONS[2]]);
    await settle();

    const form = section('mock-form');
    expect(text(form.querySelector('h2')!)).toBe('Esemény módosítása');
    expect(text(form)).toContain('Már elindult: csak a cím, az eredmény és a gyakorló időpontja módosítható. A keretet a „Keret emelése” gombbal.');
    expect(optionTexts('kozep')).toEqual(['#2 (az esemény sora)', '#1 (az esemény sora)', '#3 Tartalék']);
    expect(field<HTMLSelectElement>('kozep').selectedIndex).toBe(1);
    expect(field<HTMLSelectElement>('emelt').selectedIndex).toBe(0);
    expect(['title', 'slug', 'reg', 'opens', 'closes', 'results', 'practice', 'kozepMin', 'emeltMin', 'budget', 'badge'].map((n) => field(n).value))
      .toEqual(['Őszi próbaérettségi 2026', 'osz-2026', '2026-10-26T08:00', '2026-11-23T06:00', '2026-11-29T18:00', '2026-11-30T18:00',
        '2026-12-01T00:00', '180', '240', '500', 'MOCKEXAM_2026OSZ']);

    await type('title', 'Őszi próba (javítva)');
    await type('results', '2026-12-01T18:00');
    await submit();
    const put = req('/4', 'PUT');
    expect(put.request.body).toEqual({
      slug: 'osz-2026', title: 'Őszi próba (javítva)', registrationOpensAt: '2026-10-26T08:00', opensAt: '2026-11-23T06:00',
      startClosesAt: '2026-11-29T18:00', resultsPlannedAt: '2026-12-01T18:00', practiceReleaseAt: '2026-12-01T00:00',
      kozepTaskSetId: 1, emeltTaskSetId: 2, kozepTimeLimitSeconds: 10800, emeltTimeLimitSeconds: 14400, totalBudgetUsd: 500,
      badgeKeyPrefix: 'MOCKEXAM_2026OSZ',
    });
    put.flush(EVENT);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Mentve.');
    expect(el.querySelector('[data-testid="mock-form"]')).toBeNull();
    req('').flush([EVENT, SPRING]);
    await settle();
    await flushStatus(4);

    // A hozzáadott „saját sorok” a későbbi új eseménynél is a lista elején maradnak (a régi viselkedés rögzítése).
    await click('+ Új esemény');
    expect(optionTexts('emelt')).toEqual(['#2 (az esemény sora)', '#1 (az esemény sora)', '#3 Tartalék']);
    expect(field<HTMLSelectElement>('kozep').selectedIndex).toBe(0);
    expect(field<HTMLSelectElement>('emelt').selectedIndex).toBe(1);
    expect(text(section('mock-form'))).not.toContain('Már elindult');
  });

  it('módosítás: a jelvény-előtag szóközei levágva, üresen null; még nem indult eseménynél nincs „Már elindult”', async () => {
    req('').flush([SPRING]);
    await settle();
    await flushStatus(7, status({ event: SPRING }), []);
    await click('Módosítás');
    req('/task-set-options').flush(OPTIONS);
    await settle();
    expect(text(section('mock-form'))).not.toContain('Már elindult');
    expect(field('badge').value).toBe('');
    await type('badge', 'ABC_1');
    await submit();
    let put = req('/7', 'PUT');
    expect(put.request.body.badgeKeyPrefix).toBe('ABC_1');
    fail(put, 'Foglalt slug');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Foglalt slug');
    expect(el.querySelector('[data-testid="mock-form"]')).not.toBeNull(); // hibánál nyitva marad
    expect(button('Mentés', section('mock-form')).disabled).toBe(false);

    await type('badge', '');
    await submit();
    put = req('/7', 'PUT');
    expect(put.request.body.badgeKeyPrefix).toBeNull();
    put.flush(SPRING);
    await settle();
    req('').flush([SPRING]);
    await settle();
    await flushStatus(7, status({ event: SPRING }), []);
  });

  it('érvénytelen űrlap: nem küld, érthető magyar üzenet (üres kötelező, rossz minta, időkeret tartományon kívül vagy üres)', async () => {
    await loaded();
    await click('Módosítás');
    req('/task-set-options').flush(OPTIONS);
    await settle();
    const message = 'Tölts ki minden kötelező mezőt: a cím, az azonosító és mind az öt időpont (a „Gyakorlóként felszabadul” is) kötelező.';

    const cases: [string, string, string][] = [
      ['title', '', 'Őszi próbaérettségi 2026'], ['slug', 'Nagybetű', 'osz-2026'], ['practice', '', '2026-12-01T00:00'],
      ['badge', 'kisbetu', 'MOCKEXAM_2026OSZ'], ['kozepMin', '5', '180'], ['emeltMin', '301', '240'], ['kozepMin', '', '180'], ['budget', '-1', '500'],
    ];
    for (const [name, bad, good] of cases) {
      toastDanger.mockClear();
      await type(name, bad);
      await submit();
      expect(toastDanger, `${name}=${bad}`).toHaveBeenCalledWith(message);
      noReq('/4', 'PUT');
      await type(name, good);
    }
    await submit();
    req('/4', 'PUT').flush(EVENT);
    await settle();
    req('').flush([EVENT, SPRING]);
    await settle();
    await flushStatus(4);
  });

  it('Mégse: bezárja az űrlapot, kérés nélkül', async () => {
    await loaded();
    await click('+ Új esemény');
    req('/task-set-options').flush(OPTIONS);
    await settle();
    await click('Mégse', section('mock-form'));
    expect(el.querySelector('[data-testid="mock-form"]')).toBeNull();
  });

  // ── Esemény-műveletek ────────────────────────────────────────────

  it('elrejtés megerősítés nélkül; közzététel megerősítéssel (elutasítva nincs kérés); utána lista + státusz újratölt', async () => {
    await loaded();
    await click('Elrejtés');
    expect(confirmAsk).not.toHaveBeenCalled();
    req('/4/unpublish', 'POST').flush({ ...EVENT, isPublished: false });
    await settle();
    req('').flush([{ ...EVENT, isPublished: false }, SPRING]);
    await settle();
    await flushStatus(4, status({ event: { ...EVENT, isPublished: false } }));
    expect(eventButtons().map((b) => text(b))[0]).toBe('Őszi próbaérettségi 2026 rejtett');

    confirmAsk.mockResolvedValueOnce(false);
    await click('Közzététel (sötét indítás vége)');
    expect(confirmAsk).toHaveBeenCalledWith({
      title: 'Közzéteszed az eseményt?', message: 'Utána mindenki látja a /probaerettsegi oldalon, és jelentkezhet.', confirmLabel: 'Közzététel',
    });
    noReq('/4/publish', 'POST');

    await click('Közzététel (sötét indítás vége)');
    req('/4/publish', 'POST').flush(EVENT);
    await settle();
    req('').flush([EVENT, SPRING]);
    await settle();
    await flushStatus(4);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('eredmény közzététele (veszélyes megerősítés, kész / már kint toast), utána a felszabadítás gyakorlóként', async () => {
    await loaded();
    await click('Eredmény közzététele most');
    expect(confirmAsk).toHaveBeenCalledWith({
      title: 'Közzéteszed most az eredményt?', message: 'A rangsor most rögzül; a később értékelt beadások ehhez mérve kapnak helyezést.',
      confirmLabel: 'Közzététel', danger: true,
    });
    req('/4/publish-results', 'POST').flush(false);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Már közzé volt téve.');
    const published = { ...EVENT, resultsPublishedAt: '2026-11-30T17:00:00' };
    req('').flush([published, SPRING]);
    await settle();
    await flushStatus(4, status({ event: published }));
    expect(hasButton('Eredmény közzététele most')).toBe(false);
    expect(text()).toContain('közzétéve');

    await click('Felszabadítás gyakorlóként');
    expect(confirmAsk).toHaveBeenLastCalledWith({
      title: 'Felszabadítod gyakorlóként?', message: 'A két feladatsor (fizetős) gyakorlóként megjelenik a „Próbaérettségi feladatsorok” kategóriában.',
      confirmLabel: 'Felszabadítás',
    });
    req('/4/release-practice', 'POST').flush(true);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Felszabadítva.');
    const released = { ...published, releasedAsPracticeAt: '2026-12-01T00:00:00' };
    req('').flush([released, SPRING]);
    await settle();
    await flushStatus(4, status({ event: released }));
    expect(hasButton('Felszabadítás gyakorlóként')).toBe(false);
    expect(text()).toContain('gyakorlóként kint');
  });

  it('eredmény közzététele „kész” toasttal; művelet-hiba → toast, a gombok újra aktívak', async () => {
    await loaded();
    await click('Eredmény közzététele most');
    req('/4/publish-results', 'POST').flush(true);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Az eredmény közzétéve.');
    req('').flush([EVENT, SPRING]);
    await settle();
    await flushStatus(4);

    await click('Eredmény közzététele most');
    fail(req('/4/publish-results', 'POST'));
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('A művelet nem sikerült.');
    noReq('');
    expect(button('Levétel').disabled).toBe(false);
  });

  it('törlés: csak induló nélküli eseménynél; megerősítés, a státusz azonnal eltűnik, a lista újratölt és az első lesz kiválasztva', async () => {
    req('').flush([SPRING, EVENT]);
    await settle();
    await flushStatus(7, status({ event: SPRING }), []);
    expect(hasButton('Törlés')).toBe(true);

    confirmAsk.mockResolvedValueOnce(false);
    await click('Törlés');
    expect(confirmAsk).toHaveBeenCalledWith({ title: 'Törlöd az eseményt?', message: 'Tavaszi próba 2027', confirmLabel: 'Törlés', danger: true });
    noReq('/7', 'DELETE');

    await click('Törlés');
    req('/7', 'DELETE').flush(null);
    await settle();
    expect(el.querySelector('[data-testid="mock-budget"]')).toBeNull();
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(eventButtons().every((b) => b.className === 'btn btn-ghost')).toBe(true);
    req('').flush([EVENT]);
    await settle();
    expect(el.querySelector('[data-testid="mock-budget"]')).toBeNull();
    expect(el.querySelector('app-local-spinner')).toBeNull();
    await flushStatus(4);
    expect(text(el.querySelector('h2')!)).toBe('Őszi próbaérettségi 2026');
    expect(hasButton('Törlés')).toBe(false);
  });

  // ── Keretemelés, toplista ────────────────────────────────────────

  it('keret-emelés: javasolt összeg, csak felfelé, vesszővel is; megerősítés; utána csak a státusz tölt újra', async () => {
    await loaded();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('abc').mockReturnValueOnce('612,5').mockReturnValueOnce('700');

    await click('Keret emelése');
    expect(prompt).toHaveBeenLastCalledWith('Új MI-összkeret ($) - most 500 $, a sor kiürítéséhez kb. 6 $ kell:', '600');
    expect(toastDanger).not.toHaveBeenCalled();

    await click('Keret emelése');
    expect(toastDanger).toHaveBeenCalledWith('A keret csak emelhető (most 500 $).');

    confirmAsk.mockResolvedValueOnce(false);
    await click('Keret emelése');
    expect(confirmAsk).toHaveBeenCalledWith({
      title: 'Emeled a keretet?', message: '500 $ → 612.5 $. A várakozó beadások ezután azonnal értékelődnek.', confirmLabel: 'Emelés',
    });
    noReq('/4/budget', 'POST');

    await click('Keret emelése');
    const post = req('/4/budget', 'POST');
    expect(post.request.body).toEqual({ totalBudgetUsd: 700 });
    post.flush(EVENT);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Keret emelve - a várakozó beadások értékelése elindult.');
    noReq('');
    await flushStatus(4, status({ totalBudgetUsd: 700 }));
    expect(text(section('mock-budget'))).toContain('/ 700 $');
  });

  it('toplista: levétel megerősítéssel, visszahelyezés közvetlenül; a művelet és az újratöltés alatt a gombok tiltva', async () => {
    await loaded();
    confirmAsk.mockResolvedValueOnce(false);
    await click('Levétel');
    expect(confirmAsk).toHaveBeenCalledWith({
      title: 'Levétel a toplistáról',
      message: '„Anna” becenév nem jelenik meg a nyilvános toplistán és a megosztott kártyán. Később visszahelyezhető.',
      confirmLabel: 'Levétel',
    });
    noReq('/registrations/11/hide', 'POST');

    await click('Levétel');
    const hide = req('/registrations/11/hide', 'POST');
    expect(hide.request.params.get('hidden')).toBe('true');
    expect(button('Levétel').disabled).toBe(true);
    expect(button('Visszahelyezés').disabled).toBe(true);
    hide.flush(null);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Levéve a toplistáról.');
    expect(button('Levétel').disabled).toBe(true); // az újratöltés végéig
    noReq('');
    await flushStatus(4, status(), [{ ...LEADERBOARD[0], hiddenByAdminAt: '2026-12-01T10:00:00' }, LEADERBOARD[1]]);
    expect(text(section('mock-leaderboard'))).toContain('Anna (levéve)');

    confirmAsk.mockClear();
    await click('Visszahelyezés', section('mock-leaderboard').querySelectorAll('tbody tr')[1]);
    expect(confirmAsk).not.toHaveBeenCalled();
    const unhide = req('/registrations/12/hide', 'POST');
    expect(unhide.request.params.get('hidden')).toBe('false');
    unhide.flush(null);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Visszahelyezve a toplistára.');
    await flushStatus(4);
    expect(button('Levétel').disabled).toBe(false);
  });
});
