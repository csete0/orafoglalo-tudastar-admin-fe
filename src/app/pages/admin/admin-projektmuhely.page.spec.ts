import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminProjektmuhelyComponent } from './admin-projektmuhely.component';
import { ProjectAdminCosts, ProjectAdminFunnel, ProjectAdminOverview, ProjectAdminTechnikumStats } from '../../models/projektmuhely.model';

const BASE = 'http://localhost:7090/api/admin/projects';

const OVERVIEW: ProjectAdminOverview = {
  days: 30,
  projects: [
    { slug: 'bufe-rendelo', title: 'Büfé-rendelő', isPublished: true, milestoneCount: 3, started: 10, completed: 2, active7: 4, active30: 8,
      byRuntime: { 'browser-python': 7, 'judge0-csharp': 3, 'ismeretlen-futtato': 1 } },
    { slug: 'jatek-bolt', title: 'Játékbolt', isPublished: false, milestoneCount: 2, started: 0, completed: 0, active7: 0, active30: 0, byRuntime: {} },
  ],
  daily: [
    { date: '2026-09-30', checks: 5, previews: 2, aiRequests: 3, aiCostUsd: 0.004 },
    { date: '2026-10-01', checks: 7, previews: 0, aiRequests: 1, aiCostUsd: 0.05 },
    { date: '2026-10-02', checks: 0, previews: 0, aiRequests: 0, aiCostUsd: 0 },
  ],
};
const OVERVIEW_7: ProjectAdminOverview = {
  days: 7,
  projects: [{ ...OVERVIEW.projects[0], started: 3, completed: 1, active7: 3, active30: 3 }],
  daily: [{ date: '2026-10-02', checks: 1, previews: 1, aiRequests: 2, aiCostUsd: 1.5 }],
};
const FUNNEL: ProjectAdminFunnel = {
  slug: 'bufe-rendelo', title: 'Büfé-rendelő', started: 10,
  milestones: [
    { orderNo: 1, title: 'Az adatbázis', kind: 'build', reached: 10, passed: 9, avgChecks: 2.14, hint1: 3, hint2: 1, hint3: 0, medianMinutesToPass: 35 },
    { orderNo: 2, title: 'A menü', kind: 'build', reached: 9, passed: 4, avgChecks: 4.5, hint1: 8, hint2: 5, hint3: 2, medianMinutesToPass: 130 },
    { orderNo: 3, title: 'Rendelés', kind: 'build', reached: 4, passed: 3, avgChecks: 3, hint1: 1, hint2: 0, hint3: 0, medianMinutesToPass: null },
    { orderNo: 4, title: 'Átadás', kind: 'build', reached: 3, passed: 3, avgChecks: 1, hint1: 0, hint2: 0, hint3: 0, medianMinutesToPass: 4000 },
  ],
};
const FUNNEL_2: ProjectAdminFunnel = { slug: 'jatek-bolt', title: 'Játékbolt', started: 0, milestones: [
  { orderNo: 1, title: 'Kezdés', kind: 'build', reached: 0, passed: 0, avgChecks: 0, hint1: 0, hint2: 0, hint3: 0, medianMinutesToPass: null },
] };
const COSTS: ProjectAdminCosts = {
  days: 30, totalAiUsd: 0.054, unattributedAiUsd: 0.001, checks: 12, previews: 2, judge0CpuSeconds: 30,
  bySource: [{ source: 'project-hint', requests: 3, costUsd: 0.004 }, { source: 'project-review', requests: 0, costUsd: 0 },
    { source: 'ismeretlen', requests: 1, costUsd: 1.2 }],
  byProject: [{ slug: 'bufe-rendelo', title: 'Büfé-rendelő', aiRequests: 3, aiCostUsd: 0.004, checks: 12, previews: 2, judge0CpuSeconds: 150,
    activeStudents: 8, aiCostPerActiveStudentUsd: 0.0005 }],
};
const COSTS_7: ProjectAdminCosts = { ...COSTS, days: 7, totalAiUsd: 1.5, unattributedAiUsd: 0, bySource: [], byProject: [] };
const TECHNIKUM: ProjectAdminTechnikumStats = {
  days: 30,
  projects: [
    { slug: 'konyvtar', title: 'Könyvtári kölcsönzés', kind: 'exam', isPublished: true, parts: [
      { partKey: 'console', maxPoints: 15,
        exam: { results: 2, students: 2, avgPercent: 60, failRatePercent: 50 },
        practice: { results: 0, students: 0, avgPercent: null, failRatePercent: null } },
      { partKey: 'egyeb', maxPoints: 5,
        exam: { results: 1, students: 1, avgPercent: 33.33, failRatePercent: 100 },
        practice: { results: 4, students: 3, avgPercent: 87.25, failRatePercent: 0 } },
    ] },
    { slug: 'gyak', title: 'Gyakorló projekt', kind: 'practice', isPublished: false, parts: [] },
  ],
};

/**
 * Karakterizáció (a WP-C5 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a teljes oldal a valódi
 * AdminProjektmuhelyService-szel + HttpTestingController, csak DOM-on keresztül (betöltés, a 4 fül, időszakváltás, tölcsér-váltás,
 * lusta technikumi betöltés, hibák, a napi diagram geometriája).
 */
describe('AdminProjektmuhelyComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminProjektmuhelyComponent>;
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
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const daysReq = (path: string, days: number): TestRequest =>
    http.expectOne((r) => r.url === `${BASE}/${path}` && r.params.get('days') === String(days));
  const noDaysReq = (path: string) => http.expectNone((r) => r.url === `${BASE}/${path}`);
  const funnelReq = (slug: string) => http.expectOne(`${BASE}/${slug}/funnel`);
  const noFunnelReq = () => http.expectNone((r) => r.url.endsWith('/funnel'));
  const fail = (r: TestRequest, errorMessage?: string) =>
    r.flush(errorMessage ? { errorMessage } : null, { status: 500, statusText: 'Server Error' });
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger')?.textContent?.trim() ?? null;
  const tabButtons = () => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const dayButtons = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Időszak"] button')];
  /** A fülsor-sáv utáni tartalom szövege (a hiba-sor nélkül). */
  const content = () => {
    const parts: string[] = [];
    for (let n = el.querySelector('.max-w-6xl > .hairline + div')!.nextElementSibling; n; n = n.nextElementSibling) {
      if (!n.matches('p.text-danger')) parts.push(text(n));
    }
    return parts.filter(Boolean).join(' ');
  };
  async function tab(label: string) {
    tabButtons().find((b) => text(b) === label)!.click();
    await settle();
  }
  async function day(d: number) {
    dayButtons().find((b) => text(b) === `${d} nap`)!.click();
    await settle();
  }
  async function loaded() {
    await settle();
    daysReq('overview', 30).flush(OVERVIEW);
    daysReq('costs', 30).flush(COSTS);
    await settle();
    funnelReq('bufe-rendelo').flush(FUNNEL);
    await settle();
  }
  const select = () => el.querySelector<HTMLSelectElement>('#pm-funnel-project')!;
  async function chooseProject(index: number) {
    select().selectedIndex = index;
    select().dispatchEvent(new Event('change'));
    await settle();
  }
  const rowTexts = (root: Element = el) => [...root.querySelectorAll('tbody tr')].map((tr) => text(tr));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminProjektmuhelyComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminProjektmuhelyComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  it('betöltés: overview + costs együtt, utána az első projekt tölcsére; a spinner mindhárom végéig látszik', async () => {
    await settle();
    expect(spinner()).toBe(1);
    const ov = daysReq('overview', 30);
    const co = daysReq('costs', 30);
    noFunnelReq();
    ov.flush(OVERVIEW);
    await settle();
    noFunnelReq();
    expect(spinner()).toBe(1);
    co.flush(COSTS);
    await settle();
    expect(spinner()).toBe(1);
    funnelReq('bufe-rendelo').flush(FUNNEL);
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBeNull();
  });

  it('fejléc, fülsor, időszak-választó; az áttekintés teljes szövege', async () => {
    await loaded();
    expect(tabButtons().map((b) => [text(b), b.getAttribute('aria-selected'), b.classList.contains('tab-btn-active')])).toEqual([
      ['Áttekintés', 'true', true], ['Tölcsér', 'false', false], ['Költség', 'false', false], ['Fejlesztőműhely', 'false', false],
    ]);
    expect(tabButtons().every((b) => b.type === 'submit' ? false : b.classList.contains('tab-btn') && b.classList.contains('whitespace-nowrap'))).toBe(true);
    expect(dayButtons().map((b) => [text(b), b.getAttribute('aria-pressed'), b.classList.contains('bg-primary')])).toEqual([
      ['7 nap', 'false', false], ['30 nap', 'true', true], ['90 nap', 'false', false],
    ]);
    expect(text()).toBe(
      'Platform-admin Projektműhely Ki hol tart a projektekben, melyik lépésnél akadnak el, és mennyibe kerül egy aktív diák (AI + Judge0). ' +
      'Áttekintés Tölcsér Költség Fejlesztőműhely 7 nap 30 nap 90 nap ' +
      'Projektek Projekt Elkezdte Befejezte Aktív (7 / 30 nap) Nyelvek ' +
      'Büfé-rendelő 10 2 4 / 8 Python 7 · C# 3 · ismeretlen-futtato 1 Tölcsér → ' +
      'Játékbolt (nem publikált) 0 0 0 / 0 – Tölcsér → ' +
      'Napi futtatások Ellenőrzések és hibrid (C#/Java) előnézet-kérések a Judge0-n; az oszlopra mutatva az AI-költés is. 0 2 4 5 7 ' +
      `${dayLabel('2026-09-30')} · Ellenőrzés: 5 · előnézet: 2 · AI: 3 kérés, $0.0040 ` +
      `${dayLabel('2026-10-01')} · Ellenőrzés: 7 · előnézet: 0 · AI: 1 kérés, $0.050 ` +
      `${dayLabel('2026-10-02')} · Ellenőrzés: 0 · előnézet: 0 · AI: 0 kérés, $0.00 ` +
      'Ellenőrzés 12 Előnézet (C#/Java) 2 AI: 4 kérés, $0.054',
    );
  });

  it('napi diagram: viewBox, rácsvonalak, tick-feliratok, a látható oszlopszeletek és a súgók (golden a régi kódból)', async () => {
    await loaded();
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 860 200');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Napi Judge0-futtatások: Ellenőrzés és előnézet');
    expect(svg.getAttribute('class')).toBe('w-full h-auto block mt-3');
    const attrs = (e: Element, names: string[]) => names.map((n) => e.getAttribute(n));
    expect([...svg.querySelectorAll('line')].map((l) => attrs(l, ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width']))).toEqual(GOLDEN_LINES);
    expect([...svg.querySelectorAll('text')].map((t) => [...attrs(t, ['x', 'y', 'text-anchor', 'font-size', 'fill']), t.textContent])).toEqual(GOLDEN_TEXTS);
    const visible = [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('height') !== '0' && r.getAttribute('fill') !== 'transparent');
    expect(visible.map((r) => attrs(r, ['x', 'y', 'width', 'height', 'fill', 'rx']))).toEqual(GOLDEN_SEGMENTS);
    const hover = [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'transparent');
    expect(hover.map((r) => [...attrs(r, ['x', 'y', 'width', 'height']), r.querySelector('title')!.textContent])).toEqual([
      [GOLDEN_SEGMENTS[0][0], '10', GOLDEN_SEGMENTS[0][2], '168', `${dayLabel('2026-09-30')} · Ellenőrzés: 5 · előnézet: 2 · AI: 3 kérés, $0.0040`],
      [GOLDEN_SEGMENTS[2][0], '10', GOLDEN_SEGMENTS[2][2], '168', `${dayLabel('2026-10-01')} · Ellenőrzés: 7 · előnézet: 0 · AI: 1 kérés, $0.050`],
      [GOLDEN_HOVER_X3, '10', GOLDEN_SEGMENTS[0][2], '168', `${dayLabel('2026-10-02')} · Ellenőrzés: 0 · előnézet: 0 · AI: 0 kérés, $0.00`],
    ]);
  });

  it('tölcsér fül: projekt-választó, teljes táblázat, a legnagyobb lemorzsolódás kiemelve, sáv-szélességek; nincs időszak-választó', async () => {
    await loaded();
    await tab('Tölcsér');
    expect(dayButtons()).toEqual([]);
    expect([...select().options].map((o) => [o.value, text(o)])).toEqual([['bufe-rendelo', 'Büfé-rendelő'], ['jatek-bolt', 'Játékbolt']]);
    expect(select().value).toBe('bufe-rendelo');
    expect(content()).toContain('Büfé-rendelő – 10 diák kezdte el A sáv: a lépést teljesítők aránya az elkezdőkhöz képest.');
    expect(rowTexts()).toEqual([
      '1. Az adatbázis 9 (90%) 10 2.1 3 · 1 · 0 35 perc',
      '2. A menü legnagyobb lemorzsolódás 4 (40%) 9 4.5 8 · 5 · 2 2.2 óra',
      '3. Rendelés 3 (30%) 4 3 1 · 0 · 0 –',
      '4. Átadás 3 (30%) 3 1 0 · 0 · 0 2.8 nap',
    ]);
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows.map((r) => r.classList.contains('bg-bg-element'))).toEqual([false, true, false, false]);
    expect(rows.map((r) => r.querySelector<HTMLElement>('.bg-primary')!.style.width)).toEqual(['90%', '40%', '30%', '30%']);
  });

  it('tölcsér: projektváltás betölti az újat (közben a régi látszik), 0 kezdőnél nincs kiemelés; hibánál üzenet, a régi marad', async () => {
    await loaded();
    await tab('Tölcsér');
    await chooseProject(1);
    expect(select().value).toBe('jatek-bolt');
    expect(rowTexts()[0]).toContain('Az adatbázis');
    expect(spinner()).toBe(0);
    funnelReq('jatek-bolt').flush(FUNNEL_2);
    await settle();
    expect(rowTexts()).toEqual(['1. Kezdés 0 (0%) 0 0 0 · 0 · 0 –']);
    expect(el.querySelector('tbody tr.bg-bg-element')).toBeNull();

    await chooseProject(0);
    fail(funnelReq('bufe-rendelo'));
    await settle();
    expect(errorText()).toBe('A tölcsért nem sikerült betölteni.');
    expect(rowTexts()).toEqual(['1. Kezdés 0 (0%) 0 0 0 · 0 · 0 –']);
    expect(select().value).toBe('bufe-rendelo');

    await chooseProject(1);
    expect(errorText()).toBeNull();
    funnelReq('jatek-bolt').flush(FUNNEL_2);
    await settle();
  });

  it('áttekintés „Tölcsér →”: a tölcsér fülre vált és (ugyanarra a projektre is) újratölti a tölcsért', async () => {
    await loaded();
    [...el.querySelectorAll<HTMLButtonElement>('tbody button')][0].click();
    await settle();
    expect(tabButtons()[1].getAttribute('aria-selected')).toBe('true');
    funnelReq('bufe-rendelo').flush({ ...FUNNEL, started: 12 });
    await settle();
    expect(content()).toContain('Büfé-rendelő – 12 diák kezdte el');

    await tab('Áttekintés');
    [...el.querySelectorAll<HTMLButtonElement>('tbody button')][1].click();
    await settle();
    // Régi hiba (rögzítve, nem javítva): a fülváltáskor létrejövő <select> [value]-ja az <option>-ok előtt áll be, ezért az első
    // projekt látszik kiválasztottnak, a tölcsér viszont a választotté.
    expect(select().value).toBe('bufe-rendelo');
    funnelReq('jatek-bolt').flush(FUNNEL_2);
    await settle();
    expect(content()).toContain('Játékbolt – 0 diák kezdte el');
  });

  it('költség fül: KPI-k, AI forrásonként (ismeretlen forrás kulccsal), nem besorolt összeg, projektenként', async () => {
    await loaded();
    await tab('Költség');
    expect(dayButtons().length).toBe(3);
    expect(content()).toBe(
      'AI-költés (30 nap) $0.054 Ellenőrzések 12 Előnézet-futtatások (C#/Java) 2 Judge0 CPU-idő 30 mp ' +
      'AI forrásonként Projektműhely: AI-segítség 3 kérés $0.0040 Projektműhely: kódvéleményezés 0 kérés $0.00 ismeretlen 1 kérés $1.20 ' +
      'Ebből $0.0010 projekthez nem köthető (a hozzárendelés bevezetése előtti kérések). ' +
      'Projektenként Aktív diák: aki az időszakban dolgozott a projekten. A Judge0 saját gépen fut – annak nincs pénzbeli költsége, csak terhelése. ' +
      'Projekt Aktív diák AI-kérés AI-költés AI / aktív diák Ellenőrzés Előnézet CPU-idő ' +
      'Büfé-rendelő 8 3 $0.0040 $0.0005 12 2 2.5 perc',
    );
    expect([...el.querySelectorAll<HTMLElement>('ul li span.rounded-sm')].map((s) => s.style.background)).toEqual([
      'var(--series-project-hint)', 'var(--series-project-review)', 'var(--color-text-muted)',
    ]);
  });

  it('időszakváltás: spinner, overview + costs az új nappal (tölcsér nélkül), a fül marad; az aktív nap újrakattintása újratölt', async () => {
    await loaded();
    await tab('Költség');
    await day(7);
    expect(spinner()).toBe(1);
    expect(dayButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    noFunnelReq();
    expect(spinner()).toBe(0);
    expect(tabButtons()[2].getAttribute('aria-selected')).toBe('true');
    expect(dayButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(content()).toContain('AI-költés (7 nap) $1.50');
    expect(content()).not.toContain('Ebből');

    await day(7);
    expect(spinner()).toBe(1);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    expect(spinner()).toBe(0);

    await tab('Áttekintés');
    expect(content()).toContain('Ellenőrzés 1 Előnézet (C#/Java) 1 AI: 2 kérés, $1.50');
    await tab('Tölcsér');
    expect([...select().options].map((o) => o.value)).toEqual(['bufe-rendelo']);
    expect(rowTexts().length).toBe(4);
  });

  it('gyors időszakváltás: csak a legutolsó válasz érvényes', async () => {
    await loaded();
    await day(7);
    const ov7 = daysReq('overview', 7);
    const co7 = daysReq('costs', 7);
    await day(90);
    daysReq('overview', 90).flush({ ...OVERVIEW, days: 90 });
    daysReq('costs', 90).flush({ ...COSTS, days: 90 });
    await settle();
    if (!ov7.cancelled) ov7.flush(OVERVIEW_7);
    if (!co7.cancelled) co7.flush(COSTS_7);
    await settle();
    expect(spinner()).toBe(0);
    expect(dayButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    await tab('Költség');
    expect(content()).toContain('AI-költés (90 nap)');
  });

  it('betöltési hiba: üzenet, a korábbi adat marad; a következő sikeres betöltés törli', async () => {
    await loaded();
    await day(7);
    fail(daysReq('overview', 7), 'Belső hiba');
    const co = daysReq('costs', 7);
    if (!co.cancelled) co.flush(COSTS_7);
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('A Projektműhely adatait nem sikerült betölteni.');
    expect(content()).toContain('Büfé-rendelő 10 2 4 / 8');
    await day(30);
    expect(errorText()).toBeNull();
    daysReq('overview', 30).flush(OVERVIEW);
    daysReq('costs', 30).flush(COSTS);
    await settle();
    expect(errorText()).toBeNull();
  });

  it('első betöltés hibája: üzenet, nincs tartalom és nincs tölcsér-kérés', async () => {
    await settle();
    daysReq('overview', 30).flush(OVERVIEW);
    fail(daysReq('costs', 30));
    await settle();
    noFunnelReq();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('A Projektműhely adatait nem sikerült betölteni.');
    expect(content()).toBe('');
  });

  it('az első tölcsér hibája az oldal-betöltés hibájaként jelenik meg; a tölcsér fülön „Válassz projektet.”', async () => {
    await settle();
    daysReq('overview', 30).flush(OVERVIEW);
    daysReq('costs', 30).flush(COSTS);
    await settle();
    fail(funnelReq('bufe-rendelo'));
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('A Projektműhely adatait nem sikerült betölteni.');
    expect(content()).toContain('Büfé-rendelő 10 2 4 / 8');
    await tab('Tölcsér');
    expect(select().value).toBe('bufe-rendelo');
    expect(content()).toContain('Válassz projektet.');
  });

  it('üres adat: nincs projekt → nincs tölcsér-kérés, üres táblák; később megjelenő projektnél az első tölcsére betöltődik', async () => {
    await settle();
    daysReq('overview', 30).flush({ days: 30, projects: [], daily: [] });
    daysReq('costs', 30).flush({ ...COSTS, bySource: [], byProject: [], unattributedAiUsd: 0 });
    await settle();
    noFunnelReq();
    expect(spinner()).toBe(0);
    expect(rowTexts()).toEqual(['Még nincs projekt.']);
    expect(el.querySelectorAll('svg rect').length).toBe(0);
    expect(el.querySelectorAll('svg line').length).toBe(5);
    await tab('Tölcsér');
    expect(select().options.length).toBe(0);
    expect(content()).toBe('Projekt Válassz projektet.');
    await tab('Áttekintés');
    await day(7);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    expect(spinner()).toBe(1);
    funnelReq('bufe-rendelo').flush(FUNNEL);
    await settle();
    expect(spinner()).toBe(0);
    await tab('Tölcsér');
    expect(rowTexts().length).toBe(4);
  });

  it('technikum: csak a fülre lépve tölt (spinnerrel); részenkénti táblák; visszalépve ugyanarra az időszakra nem tölt újra', async () => {
    await loaded();
    noDaysReq('technikum');
    await tab('Fejlesztőműhely');
    expect(spinner()).toBe(1);
    daysReq('technikum', 30).flush(TECHNIKUM);
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toBe(
      'A Technikumi vizsga projektjei részenként, a bírált eredmények alapján (30 nap; a függő és a rendszerhibás bírálat nem számít). ' +
      'Bukás: 40% alatti eredmény (a vizsga megfelelt-határa). Vizsga: önálló próbavizsga és dolgozat; gyakorlás: gyakorló ellenőrzés. ' +
      'Könyvtári kölcsönzés próbavizsga Rész Vizsga Gyakorlás Eredmény (diák) Átlag Bukási arány Eredmény (diák) Átlag Bukási arány ' +
      'Konzolos alkalmazás (15 pont) 2 (2) 60.0% 50.0% 0 (0) – – ' +
      'egyeb (5 pont) 1 (1) 33.3% 100.0% 4 (3) 87.3% 0.0% ' +
      'Gyakorló projekt gyakorló (nem publikált) Rész Vizsga Gyakorlás Eredmény (diák) Átlag Bukási arány Eredmény (diák) Átlag Bukási arány ' +
      'A projektnek nincs vizsgarészhez kötött lépése.',
    );
    expect(el.querySelector('[data-testid="technikum-konyvtar"] .badge')!.className).toBe('badge badge-primary ml-1');
    expect(el.querySelector('[data-testid="technikum-gyak"] .badge')!.className).toBe('badge badge-neutral ml-1');
    await tab('Áttekintés');
    await tab('Fejlesztőműhely');
    noDaysReq('technikum');
    expect(content()).toContain('(30 nap;');
  });

  it('technikum: időszakváltás a fülön mindent újratölt; más fülön váltva a fülre lépéskor tölt az új nappal', async () => {
    await loaded();
    await tab('Fejlesztőműhely');
    daysReq('technikum', 30).flush(TECHNIKUM);
    await settle();
    await day(7);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    daysReq('technikum', 7).flush({ ...TECHNIKUM, days: 7 });
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toContain('(7 nap;');

    await day(7);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    daysReq('technikum', 7).flush({ ...TECHNIKUM, days: 7, projects: [] });
    await settle();
    expect(content()).toContain('Még nincs technikumi vizsgaprojekt.');

    await tab('Költség');
    await day(90);
    daysReq('overview', 90).flush(OVERVIEW);
    daysReq('costs', 90).flush(COSTS);
    await settle();
    noDaysReq('technikum');
    await tab('Fejlesztőműhely');
    expect(spinner()).toBe(1);
    daysReq('technikum', 90).flush({ ...TECHNIKUM, days: 90 });
    await settle();
    expect(content()).toContain('(90 nap;');
  });

  it('technikum hiba: a BE üzenete (vagy alapüzenet), a korábbi adat marad; visszalépve újrapróbál; más betöltés törli az üzenetet', async () => {
    await loaded();
    await tab('Fejlesztőműhely');
    fail(daysReq('technikum', 30), 'A technikumi modul nincs bekapcsolva.');
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('A technikumi modul nincs bekapcsolva.');
    expect(content()).toBe('');

    await tab('Áttekintés');
    expect(errorText()).toBe('A technikumi modul nincs bekapcsolva.');
    await tab('Fejlesztőműhely');
    expect(spinner()).toBe(1);
    daysReq('technikum', 30).flush(TECHNIKUM);
    await settle();
    expect(errorText()).toBeNull();
    expect(content()).toContain('(30 nap;');

    await day(7);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    fail(daysReq('technikum', 7));
    await settle();
    expect(errorText()).toBe('A Fejlesztőműhely-statisztikát nem sikerült betölteni.');
    expect(content()).toContain('(30 nap;');

    await tab('Tölcsér');
    await chooseProject(0);
    expect(errorText()).toBeNull();
    funnelReq('bufe-rendelo').flush(FUNNEL);
    await settle();
  });

  it('technikum: gyors időszakváltásnál a később érkező régi válasz nem írja felül az újat', async () => {
    await loaded();
    await tab('Fejlesztőműhely');
    daysReq('technikum', 30).flush(TECHNIKUM);
    await settle();
    await day(7);
    daysReq('overview', 7).flush(OVERVIEW_7);
    daysReq('costs', 7).flush(COSTS_7);
    await settle();
    const t7 = daysReq('technikum', 7);
    await day(90);
    daysReq('overview', 90).flush(OVERVIEW);
    daysReq('costs', 90).flush(COSTS);
    await settle();
    daysReq('technikum', 90).flush({ ...TECHNIKUM, days: 90 });
    await settle();
    if (!t7.cancelled) t7.flush({ ...TECHNIKUM, days: 7 });
    await settle();
    expect(spinner()).toBe(0);
    expect(content()).toContain('(90 nap;');
  });
});

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

// A régi kódból rögzítve (plotH = 168, max = 7, lépésköz = 272, oszlopszélesség = 18).
const GOLDEN_LINES: (string | null)[][] = ['178', '136', '94', '52', '10'].map((y) => ['36', '852', y, y, 'var(--color-border-default)', '1']);
const GOLDEN_TEXTS: (string | null)[][] = [['181', '0'], ['139', '2'], ['97', '4'], ['55', '5'], ['13', '7']]
  .map(([y, label]) => ['30', y, 'end', '10', 'var(--color-text-muted)', label]);
const GOLDEN_SEGMENTS: (string | null)[][] = [
  ['163', '58', '18', '120', 'var(--series-grading)', '2'],
  ['163', '10', '18', '48', 'var(--series-classtest)', '2'],
  ['435', '10', '18', '168', 'var(--series-grading)', '2'],
];
const GOLDEN_HOVER_X3 = '707';
