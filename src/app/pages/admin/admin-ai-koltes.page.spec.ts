import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminAiKoltesComponent } from './admin-ai-koltes.component';
import {
  AiRequestLogPageDto,
  AiSpendingClassTestTeacherDto,
  AiSpendingFullExamUsageDto,
  AiSpendingOverviewDto,
  AiSpendingTopSpenderDto,
} from '../../models/ai-spending.model';

registerLocaleData(localeHu);

const overview: AiSpendingOverviewDto = {
  dailyBySource: [
    { date: '2026-10-01', bySource: { chat: 0.12, grading: 0.3 } },
    { date: '2026-10-02', bySource: {} },
    { date: '2026-10-03', bySource: { chat: 0.05, studyplan: 1.4, maint: 0.2 } },
    { date: '2026-10-04', bySource: { ismeretlen: 0.5 } },
    { date: '2026-10-05', bySource: { chat: 0 } },
    { date: '2026-10-06', bySource: { grading: 2.25 } },
    { date: '2026-10-07', bySource: { chat: 0.4, 'exam-full': 0.6 } },
    { date: '2026-10-08', bySource: { classtest: 0.01 } },
    { date: '2026-10-09', bySource: { chat: 0.33 } },
  ],
  monthTotalsBySource: [
    { source: 'chat', totalUsd: 12.5 },
    { source: 'maint', totalUsd: 3.2 },
    { source: 'ismeretlen', totalUsd: 0.4 },
  ],
  todayTotalUsd: 0.33,
  monthTotalUsd: 16.1,
  myOwnMonthUsd: 1.1,
  automationMonthUsd: 3.7,
  demoTodayUsd: 0,
  demoMonthUsd: 0.4,
};
const topSpenders: AiSpendingTopSpenderDto[] = [
  { userId: 1, userName: 'Teszt Elek', requestCount: 5, totalUsd: 1.2 },
  { userId: 2, userName: 'Kiss Anna', requestCount: 17, totalUsd: 0.045 },
];
const classTests: AiSpendingClassTestTeacherDto[] = [
  { teacherUserId: 7, teacherName: 'Tanár Tamás', email: 't@example.com', institutionName: 'Minta Gimnázium', gradedThisMonth: 42, monthlyLimit: 300 },
  { teacherUserId: 8, teacherName: 'Tanár Tímea', email: 'ti@example.com', institutionName: null, gradedThisMonth: 300, monthlyLimit: 300 },
];
const fullExam: AiSpendingFullExamUsageDto = {
  gradedExamsThisMonth: 12, studentsThisMonth: 9, examCostTodayUsd: 1.6, practiceCostTodayUsd: 0.5, last30DaysCostUsd: 14.2,
  dailyAlertUsd: 2, dailyAlert: true, storageBytes: 52428800, storageFiles: 140, storageLast30DaysBytes: 10485760,
};
const credits = { totalCredits: 100, totalUsage: 23.5, remainingCredits: 76.5 };

const logPage: AiRequestLogPageDto = {
  totalCount: 45,
  items: [
    { id: 1, createdAt: '2026-10-20T08:05:00', userId: 5, userName: 'Kiss Anna', source: 'chat', model: 'openai/gpt-4o-mini',
      promptTokens: 12345, completionTokens: 678, costUsd: 0.0123 },
    { id: 2, createdAt: '2026-10-20T09:15:00', userId: 6, userName: 'Nagy Béla', source: 'ismeretlen', model: 'x/y',
      promptTokens: 1000000, completionTokens: 0, costUsd: null },
  ],
};

const HEADER =
  'Platform-admin AI-költés és automatizmusok Minden AI-hívás (OpenRouter) kérésenkénti költsége, a saját és az automata ' +
  'felhasználás, valamint a token-fogyasztó háttérfolyamatok kézi indítása egy helyen. Áttekintés Havi riport Kérésnapló ' +
  'Kvíz-karbantartás Eredmények kezelése Egyéb automatizmusok';

/**
 * Karakterizáció (a WP-C2 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): az Áttekintés és a
 * Kérésnapló fül a valódi service-szel + HttpTestingController. A diagram geometriája elemenként rögzítve.
 */
describe('AdminAiKoltesComponent – áttekintés és kérésnapló (teljes oldal)', () => {
  let fixture: ComponentFixture<AdminAiKoltesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const text = (root: Element = el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  const req = (path: string): TestRequest => http.expectOne((r) => r.url.endsWith(path) && r.method === 'GET');
  const noReq = (path: string) => http.expectNone((r) => r.url.endsWith(path));
  async function settle() {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const button = (label: string): HTMLButtonElement => {
    const b = [...el.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent?.trim() === label);
    if (!b) throw new Error(`Nincs gomb: ${label}`);
    return b;
  };
  async function click(label: string) {
    button(label).click();
    await settle();
  }
  /** A diagram elemei sorrendben: tagnév, rendezett attribútumok, szöveg (a `<title>` is). */
  const chart = () => {
    const svg = el.querySelector('svg[role="img"]');
    if (!svg) return [];
    return [...svg.children].map((n) => {
      const attrs = [...n.attributes]
        .filter((a) => !a.name.startsWith('_ng'))
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join(' ');
      const t = n.textContent?.replace(/\s+/g, ' ').trim();
      return `${n.tagName.toLowerCase()} ${attrs}${t ? ' | ' + t : ''}`;
    });
  };
  async function loadOverview() {
    req('/ai-spending/overview').flush(overview);
    req('/ai-spending/top-spenders').flush(topSpenders);
    req('/ai-spending/class-test-usage').flush(classTests);
    req('/ai-spending/full-exam-usage').flush(fullExam);
    req('/ai-spending/credits').flush(credits);
    await settle();
  }
  const fail = (r: TestRequest, errorMessage?: string) =>
    r.flush(errorMessage ? { errorMessage } : null, { status: 500, statusText: 'Server Error' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminAiKoltesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAiKoltesComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  // ── Áttekintés ─────────────────────────────────────────────────────

  it('induláskor egyszerre kéri az 5 áttekintés-adatot; betöltés közben spinner, utána a teljes áttekintés', async () => {
    const reqs = [
      req('/ai-spending/overview'),
      req('/ai-spending/top-spenders'),
      req('/ai-spending/class-test-usage'),
      req('/ai-spending/full-exam-usage'),
      req('/ai-spending/credits'),
    ];
    expect(reqs[0].request.params.toString()).toBe('days=30');
    expect(reqs[1].request.params.toString()).toBe('days=30&limit=10');
    expect(text()).toBe(HEADER + ' Betöltés…');

    reqs[0].flush(overview);
    reqs[1].flush(topSpenders);
    reqs[2].flush(classTests);
    reqs[3].flush(fullExam);
    reqs[4].flush(credits);
    await settle();

    const legend = text(el.querySelector('.card.p-5 .flex.flex-wrap.gap-x-4')!);
    expect(text()).toBe(
      HEADER +
        ' Ma összesen $0.330 Ez a hónap $16.10 Saját (admin) költésem $1.10 Automatizmusok (e hónap) $3.70' +
        ' Demók (e hónap, külön) $0.400 ma $0.000' +
        ' OpenRouter egyenleg $76.50 / $100.00 feltöltve' +
        ' Napi költés, forrás szerint OpenRouter-hívások becsült USD-értéke 30 nap 7 nap ' +
        chart().filter((c) => c.includes(' | ')).map((c) => c.split(' | ')[1]).join(' ') +
        ' ' + legend +
        ' Havi megoszlás forrás szerint AI Mentor (diák chat) $12.50 Kvíz-karbantartás $3.20 ismeretlen $0.400' +
        ' Legtöbbet költő felhasználók utolsó 30 nap Felhasználó Kérés Költés Teszt Elek 5 $1.20 Kiss Anna 17 $0.045' +
        ' Teljes vizsga értékelése irodai/weblap feladatok MI-pontozása - a rendszer állja, a diák havi darabkerete' +
        ' (ingyenes 1 / standard 4 / prémium 10) számít A mai irodai MI-pontozás elérte a riasztási küszöböt ($2.00).' +
        ' E hónapban 12 vizsga · 9 diák Költés ma / 30 nap $1.60 vizsga + $0.500 gyakorlás / $14.20' +
        ' Feltöltések tárhelye 50.0 MB · 140 fájl +10.0 MB az elmúlt 30 napban' +
        ' Dolgozat-pontozás tanáronként ebben a hónapban beadott dolgozatok a tanári havi keretből - a költést a rendszer' +
        ' állja, a „Dolgozat AI-pontozás” sávban látszik Tanár Iskola Havi keret Tanár Tamás t@example.com Minta Gimnázium' +
        ' 42 / 300 Tanár Tímea ti@example.com – 300 / 300',
    );
    expect(legend).toBe(
      'AI Mentor (diák chat) $0.900 Vizsga AI-értékelés $2.55 Dolgozat AI-pontozás (tanári) $0.010' +
        ' Tanulási terv (automata) $1.40 Kvíz-karbantartás $0.200 Teljes vizsga értékelése $0.600',
    );
    // A havi sávok a legnagyobbhoz arányosak; a keret-túllépő tanár sora piros.
    const widths = [...el.querySelectorAll<HTMLElement>('.h-full.rounded-full')].map((d) => d.style.width);
    expect(widths).toEqual(['100%', '25.6%', '3.2%']);
    const limits = [...el.querySelectorAll('[data-testid="class-test-usage"] tbody td:last-child')].map((td) => td.classList.contains('text-danger'));
    expect(limits).toEqual([false, true]);
  });

  it('a napi diagram geometriája (30 nap, majd 7 nap, majd vissza) a régi számítással azonos', async () => {
    await loadOverview();
    expect(el.querySelector('svg[role="img"]')?.getAttribute('viewBox')).toBe('0 0 860 220');
    expect(chart()).toEqual(CHART_30);
    await click('7 nap');
    expect(chart()).toEqual(CHART_7);
    expect(button('7 nap').classList.contains('bg-primary')).toBe(true);
    expect(button('30 nap').classList.contains('bg-primary')).toBe(false);
    expect(text(el.querySelector('.card.p-5 .flex.flex-wrap.gap-x-4')!)).toBe(
      'AI Mentor (diák chat) $0.780 Vizsga AI-értékelés $2.25 Dolgozat AI-pontozás (tanári) $0.010' +
        ' Tanulási terv (automata) $1.40 Kvíz-karbantartás $0.200 Teljes vizsga értékelése $0.600',
    );
    await click('30 nap');
    expect(chart()).toEqual(CHART_30);
  });

  it('fülváltás után visszatérve nem tölt újra, és a 7 napos nézet megmarad', async () => {
    await loadOverview();
    await click('7 nap');
    await click('Eredmények kezelése');
    expect(el.querySelector('svg[role="img"]')).toBeNull();
    await click('Áttekintés');
    noReq('/ai-spending/overview');
    noReq('/ai-spending/credits');
    expect(chart()).toEqual(CHART_7);
    expect(button('7 nap').classList.contains('bg-primary')).toBe(true);
  });

  it('az áttekintés hibájánál a backend üzenete látszik, a csempék nem', async () => {
    fail(req('/ai-spending/overview'), 'Nincs jogosultság.');
    req('/ai-spending/top-spenders').flush(topSpenders);
    req('/ai-spending/class-test-usage').flush(classTests);
    req('/ai-spending/full-exam-usage').flush(fullExam);
    req('/ai-spending/credits').flush(credits);
    await settle();
    expect(text()).toBe(HEADER + ' Nincs jogosultság.');
    expect(el.querySelector('p.text-danger')?.className).toContain('mb-4');
  });

  it('üzenet nélküli áttekintés-hibánál az általános szöveg', async () => {
    fail(req('/ai-spending/overview'));
    req('/ai-spending/top-spenders').flush(topSpenders);
    req('/ai-spending/class-test-usage').flush(classTests);
    req('/ai-spending/full-exam-usage').flush(fullExam);
    req('/ai-spending/credits').flush(credits);
    await settle();
    expect(text()).toBe(HEADER + ' Az áttekintés betöltése sikertelen.');
  });

  it('a mellékadatok hibája csak a saját csempéjüket érinti; a kredit töltés közben „...”, hibánál üzenet', async () => {
    req('/ai-spending/overview').flush(overview);
    fail(req('/ai-spending/top-spenders'));
    fail(req('/ai-spending/class-test-usage'));
    fail(req('/ai-spending/full-exam-usage'));
    const creditsReq = req('/ai-spending/credits');
    await settle();
    const kpi = () => text(el.querySelectorAll('.card.p-4')[5]);
    expect(kpi()).toBe('OpenRouter egyenleg ...');
    expect(text()).toContain('Legtöbbet költő felhasználók utolsó 30 nap Felhasználó Kérés Költés Nincs adat.');
    expect(el.querySelector('[data-testid="full-exam-usage"]')).toBeNull();
    expect(text(el.querySelector('[data-testid="class-test-usage"]')!)).toContain('Ebben a hónapban még nem volt beadott dolgozat.');

    fail(creditsReq);
    await settle();
    expect(kpi()).toBe('OpenRouter egyenleg Nem sikerült lekérni.');
    expect(text()).toContain('Ma összesen $0.330');
  });

  it('üres hónapnál „Nincs adat ebben a hónapban.”, riasztás nélkül nincs alert', async () => {
    req('/ai-spending/overview').flush({ ...overview, monthTotalsBySource: [], dailyBySource: [] });
    req('/ai-spending/top-spenders').flush([]);
    req('/ai-spending/class-test-usage').flush([]);
    req('/ai-spending/full-exam-usage').flush({ ...fullExam, dailyAlert: false });
    req('/ai-spending/credits').flush(credits);
    await settle();
    expect(text()).toContain('Havi megoszlás forrás szerint Nincs adat ebben a hónapban.');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(chart()).toEqual(CHART_EMPTY);
  });

  // ── Kérésnapló ─────────────────────────────────────────────────────

  async function openLog() {
    await loadOverview();
    await click('Kérésnapló');
  }
  const logReq = () => req('/ai-spending/requests');
  const pagerLabel = () => text(el.querySelector('.flex.justify-between.items-center.mt-3 > span')!);

  it('a Kérésnapló első megnyitáskor tölt (spinnerrel), a sorokat és a tartomány-feliratot mutatja', async () => {
    await loadOverview();
    noReq('/ai-spending/requests');
    await click('Kérésnapló');
    const r = logReq();
    expect(r.request.params.toString()).toBe('page=1&pageSize=20');
    expect(text()).toContain('Kérésnapló Minden egyes AI-hívás - ki, mikor, milyen forrásból, mennyiért.');
    expect(el.querySelector('app-local-spinner')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();

    r.flush(logPage);
    await settle();
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(text(el.querySelector('table')!)).toBe(
      'Időpont Felhasználó Forrás Modell Prompt tok. Válasz tok. Költés' +
        ' 10.20. 08:05 Kiss Anna AI Mentor (diák chat) openai/gpt-4o-mini 12 345 678 $0.012' +
        ' 10.20. 09:15 Nagy Béla ismeretlen x/y 1 000 000 0 (becsült)',
    );
    const dots = [...el.querySelectorAll<HTMLElement>('tbody span.rounded-sm')].map((s) => s.style.background);
    expect(dots).toEqual(['var(--series-chat)', 'var(--color-text-muted)']);
    expect(pagerLabel()).toBe('1–20 / 45 kérés');
    expect(button('Előző').disabled).toBe(true);
    expect(button('Következő').disabled).toBe(false);
  });

  it('lapozás lépésenként: tartomány-felirat és gombállapot oldalanként', async () => {
    await openLog();
    logReq().flush(logPage);
    await settle();

    await click('Következő');
    const r2 = logReq();
    expect(r2.request.params.toString()).toBe('page=2&pageSize=20');
    expect(el.querySelector('app-local-spinner')).not.toBeNull();
    r2.flush(logPage);
    await settle();
    expect(pagerLabel()).toBe('21–40 / 45 kérés');
    expect(button('Előző').disabled).toBe(false);

    await click('Következő');
    const r3 = logReq();
    expect(r3.request.params.toString()).toBe('page=3&pageSize=20');
    r3.flush(logPage);
    await settle();
    expect(pagerLabel()).toBe('41–45 / 45 kérés');
    expect(button('Következő').disabled).toBe(true);

    await click('Előző');
    const back = logReq();
    expect(back.request.params.toString()).toBe('page=2&pageSize=20');
    back.flush(logPage);
    await settle();
    expect(pagerLabel()).toBe('21–40 / 45 kérés');
  });

  it('szűrés: minden mezőváltás az 1. oldalra ugrik és azonnal újratölt; a törlés üríti a mezőket', async () => {
    await openLog();
    logReq().flush(logPage);
    await settle();
    await click('Következő');
    logReq().flush(logPage);
    await settle();

    const [userInput, fromInput, toInput] = [...el.querySelectorAll<HTMLInputElement>('input')];
    const select = el.querySelector<HTMLSelectElement>('select')!;

    userInput.value = 'anna';
    userInput.dispatchEvent(new Event('input'));
    await settle();
    let r = logReq();
    expect(r.request.params.toString()).toBe('page=1&pageSize=20&userQuery=anna');
    r.flush(logPage);
    await settle();
    expect(pagerLabel()).toBe('1–20 / 45 kérés');

    expect(select.options[0].textContent?.trim()).toBe('Minden forrás');
    expect(select.options[1].textContent?.trim()).toBe('AI Mentor (diák chat)');
    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change'));
    await settle();
    r = logReq();
    expect(r.request.params.toString()).toBe('page=1&pageSize=20&source=grading&userQuery=anna');
    r.flush(logPage);
    await settle();

    fromInput.value = '2026-10-01';
    fromInput.dispatchEvent(new Event('input'));
    await settle();
    logReq().flush(logPage);
    await settle();
    toInput.value = '2026-10-20';
    toInput.dispatchEvent(new Event('input'));
    await settle();
    r = logReq();
    expect(r.request.params.toString()).toBe(
      'page=1&pageSize=20&source=grading&userQuery=anna&fromDate=2026-10-01&toDate=2026-10-20',
    );
    r.flush(logPage);
    await settle();

    // Egy kiürített mező nem kerül a kérésbe.
    fromInput.value = '';
    fromInput.dispatchEvent(new Event('input'));
    await settle();
    r = logReq();
    expect(r.request.params.toString()).toBe('page=1&pageSize=20&source=grading&userQuery=anna&toDate=2026-10-20');
    r.flush(logPage);
    await settle();

    await click('Szűrés törlése');
    r = logReq();
    expect(r.request.params.toString()).toBe('page=1&pageSize=20');
    r.flush(logPage);
    await settle();
    const [u2, f2, t2] = [...el.querySelectorAll<HTMLInputElement>('input')];
    expect([u2.value, f2.value, t2.value]).toEqual(['', '', '']);
    expect(el.querySelector<HTMLSelectElement>('select')!.selectedIndex).toBe(0);

    // A „Szűrés törlése” üres szűrővel is újratölt.
    await click('Szűrés törlése');
    logReq().flush(logPage);
    await settle();
  });

  it('a naplóról elváltva és visszatérve nem tölt újra; a szűrő és az oldal megmarad', async () => {
    await openLog();
    logReq().flush(logPage);
    await settle();
    const userInput = el.querySelector<HTMLInputElement>('input')!;
    userInput.value = 'béla';
    userInput.dispatchEvent(new Event('input'));
    await settle();
    logReq().flush(logPage);
    await settle();
    await click('Következő');
    logReq().flush(logPage);
    await settle();

    await click('Áttekintés');
    await click('Kérésnapló');
    noReq('/ai-spending/requests');
    expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('béla');
    expect(pagerLabel()).toBe('21–40 / 45 kérés');
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('első betöltési hibánál a backend üzenete, üres táblázat és „0 kérés”', async () => {
    await openLog();
    fail(logReq(), 'A napló most nem elérhető.');
    await settle();
    expect(text()).toContain('Minden egyes AI-hívás - ki, mikor, milyen forrásból, mennyiért.');
    expect(text(el.querySelector('p.text-danger')!)).toBe('A napló most nem elérhető.');
    expect(text(el.querySelector('tbody')!)).toBe('Nincs a szűrésnek megfelelő kérés.');
    expect(pagerLabel()).toBe('0 kérés');
  });

  it('lapozási hibánál az üzenet mellett a korábbi sorok maradnak (az oldalszám már a kért oldal)', async () => {
    await openLog();
    logReq().flush(logPage);
    await settle();
    await click('Következő');
    fail(logReq());
    await settle();
    expect(text(el.querySelector('p.text-danger')!)).toBe('A kérésnapló betöltése sikertelen.');
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(pagerLabel()).toBe('21–40 / 45 kérés');

    // Az újabb sikeres betöltés eltünteti a hibaüzenetet.
    await click('Előző');
    logReq().flush(logPage);
    await settle();
    expect(el.querySelector('p.text-danger')).toBeNull();
    expect(pagerLabel()).toBe('1–20 / 45 kérés');
  });
});

const CHART_30: string[] = [
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=196 y2=196",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=199 | $0.0",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=149.5 y2=149.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=152.5 | $0.6",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=103 y2=103",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=106 | $1",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=56.5 y2=56.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=59.5 | $2",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=10 y2=10",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=13 | $2",
  "rect fill=var(--series-chat) height=8.92 rx=2 width=22 x=74.11111111111111 y=186.08 | okt. 1. · AI Mentor (diák chat): $0.120",
  "rect fill=var(--series-grading) height=23.8 rx=2 width=22 x=74.11111111111111 y=161.28 | okt. 1. · Vizsga AI-értékelés: $0.300",
  "rect fill=transparent height=186 width=22 x=74.11111111111111 y=10 | okt. 1. · összesen: $0.420",
  "rect fill=var(--series-chat) height=3.1333333333333337 rx=2 width=22 x=254.55555555555557 y=191.86666666666667 | okt. 3. · AI Mentor (diák chat): $0.050",
  "rect fill=var(--series-studyplan) height=114.73333333333333 rx=2 width=22 x=254.55555555555557 y=76.13333333333334 | okt. 3. · Tanulási terv (automata): $1.40",
  "rect fill=var(--series-maint) height=15.533333333333335 rx=2 width=22 x=254.55555555555557 y=59.60000000000001 | okt. 3. · Kvíz-karbantartás: $0.200",
  "rect fill=transparent height=186 width=22 x=254.55555555555557 y=10 | okt. 3. · összesen: $1.65",
  "rect fill=transparent height=186 width=22 x=344.7777777777778 y=10 | okt. 4. · összesen: $0.500",
  "rect fill=var(--series-grading) height=185 rx=2 width=22 x=525.2222222222223 y=10 | okt. 6. · Vizsga AI-értékelés: $2.25",
  "rect fill=transparent height=186 width=22 x=525.2222222222223 y=10 | okt. 6. · összesen: $2.25",
  "rect fill=var(--series-chat) height=32.06666666666667 rx=2 width=22 x=615.4444444444445 y=162.93333333333334 | okt. 7. · AI Mentor (diák chat): $0.400",
  "rect fill=var(--series-exam-full) height=48.6 rx=2 width=22 x=615.4444444444445 y=113.33333333333334 | okt. 7. · Teljes vizsga értékelése: $0.600",
  "rect fill=transparent height=186 width=22 x=615.4444444444445 y=10 | okt. 7. · összesen: $1.00",
  "rect fill=var(--series-classtest) height=0 rx=2 width=22 x=705.6666666666667 y=195.17333333333335 | okt. 8. · Dolgozat AI-pontozás (tanári): $0.010",
  "rect fill=transparent height=186 width=22 x=705.6666666666667 y=10 | okt. 8. · összesen: $0.010",
  "rect fill=var(--series-chat) height=26.28 rx=2 width=22 x=795.8888888888889 y=168.72 | okt. 9. · AI Mentor (diák chat): $0.330",
  "rect fill=transparent height=186 width=22 x=795.8888888888889 y=10 | okt. 9. · összesen: $0.330",
];
const CHART_7: string[] = [
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=196 y2=196",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=199 | $0.0",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=149.5 y2=149.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=152.5 | $0.6",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=103 y2=103",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=106 | $1",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=56.5 y2=56.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=59.5 | $2",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=10 y2=10",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=13 | $2",
  "rect fill=var(--series-chat) height=3.1333333333333337 rx=2 width=22 x=87 y=191.86666666666667 | okt. 3. · AI Mentor (diák chat): $0.050",
  "rect fill=var(--series-studyplan) height=114.73333333333333 rx=2 width=22 x=87 y=76.13333333333334 | okt. 3. · Tanulási terv (automata): $1.40",
  "rect fill=var(--series-maint) height=15.533333333333335 rx=2 width=22 x=87 y=59.60000000000001 | okt. 3. · Kvíz-karbantartás: $0.200",
  "rect fill=transparent height=186 width=22 x=87 y=10 | okt. 3. · összesen: $1.65",
  "rect fill=transparent height=186 width=22 x=203 y=10 | okt. 4. · összesen: $0.500",
  "rect fill=var(--series-grading) height=185 rx=2 width=22 x=435 y=10 | okt. 6. · Vizsga AI-értékelés: $2.25",
  "rect fill=transparent height=186 width=22 x=435 y=10 | okt. 6. · összesen: $2.25",
  "rect fill=var(--series-chat) height=32.06666666666667 rx=2 width=22 x=551 y=162.93333333333334 | okt. 7. · AI Mentor (diák chat): $0.400",
  "rect fill=var(--series-exam-full) height=48.6 rx=2 width=22 x=551 y=113.33333333333334 | okt. 7. · Teljes vizsga értékelése: $0.600",
  "rect fill=transparent height=186 width=22 x=551 y=10 | okt. 7. · összesen: $1.00",
  "rect fill=var(--series-classtest) height=0 rx=2 width=22 x=667 y=195.17333333333335 | okt. 8. · Dolgozat AI-pontozás (tanári): $0.010",
  "rect fill=transparent height=186 width=22 x=667 y=10 | okt. 8. · összesen: $0.010",
  "rect fill=var(--series-chat) height=26.28 rx=2 width=22 x=783 y=168.72 | okt. 9. · AI Mentor (diák chat): $0.330",
  "rect fill=transparent height=186 width=22 x=783 y=10 | okt. 9. · összesen: $0.330",
];
const CHART_EMPTY: string[] = [
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=196 y2=196",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=199 | $0.0",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=149.5 y2=149.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=152.5 | $0.1",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=103 y2=103",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=106 | $0.3",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=56.5 y2=56.5",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=59.5 | $0.4",
  "line stroke-width=1 stroke=var(--color-border-default) x1=40 x2=852 y1=10 y2=10",
  "text fill=var(--color-text-muted) font-size=10 text-anchor=end x=32 y=13 | $0.5",
];
