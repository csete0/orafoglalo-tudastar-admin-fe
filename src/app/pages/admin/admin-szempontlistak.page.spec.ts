import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminSzempontlistakComponent } from './admin-szempontlistak.component';
import { RubricDetail, RubricTaskRow } from '../../models/rubrics.model';

const API = 'http://localhost:7090/api/admin/rubrics';

const ROWS: RubricTaskRow[] = [
  { taskId: 90, setTitle: '2024. május', levelId: 3, taskType: 'word', taskTitle: 'Danuvia', taskMaxPoints: 3, rubricId: 9, version: 1, status: 'draft',
    itemCount: 2, hasApproved: false },
  { taskId: 91, setTitle: '2024. május', levelId: 2, taskType: 'sql', taskTitle: 'Ingatlan', taskMaxPoints: 35, rubricId: 10, version: 2,
    status: 'approved', itemCount: 30, hasApproved: true },
  { taskId: 92, setTitle: '2023. október', levelId: 3, taskType: 'other', taskTitle: 'Nincs', taskMaxPoints: null, rubricId: null, version: null,
    status: null, itemCount: 0, hasApproved: false },
];
const detail = (id: number, over: Partial<RubricDetail> = {}): RubricDetail => ({
  id, taskId: 90, setTitle: '2024. május', levelId: 3, taskType: 'word', taskTitle: `Feladat ${id}`, taskMaxPoints: 3, version: 1, status: 'draft',
  source: 'official-xlsx', sourceRef: null, rawTotal: 2, examPoints: 3, note: null, reviewedAt: null, itemPointSum: 2, problems: [],
  items: [
    { id: 1, order: 1, section: 'A fájl', text: 'Létezik a fájl', kind: 'criterion', points: 1, groupNo: null, minCorrect: null, checkMode: null },
    { id: 2, order: 2, section: 'A fájl', text: 'Jó a neve', kind: 'criterion', points: 1, groupNo: null, minCorrect: null, checkMode: null },
  ],
  ...over,
});

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Szempontlisták oldal a valódi
 * service-szel + HttpTestingController, DOM-on keresztül (lista, szűrő, részletek betöltése, jóváhagyás/elutasítás, hibák).
 */
describe('AdminSzempontlistakComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminSzempontlistakComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const text = (root: Element | null = el) => {
    if (!root) return '';
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
  const row = (taskId: number) => el.querySelector<HTMLButtonElement>(`[data-testid="rubric-row-${taskId}"]`)!;
  const listRows = () => [...el.querySelectorAll('[data-testid="rubric-list"] button')].map((b) => text(b));
  const detailCard = () => el.querySelector('.card.p-5.min-w-0');
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const note = () => el.querySelector<HTMLTextAreaElement>('textarea');
  const fail = (r: TestRequest, body: object | null = null) => r.flush(body, { status: 400, statusText: 'Bad Request' });
  async function click(b: HTMLElement) {
    b.click();
    await settle();
  }
  async function loaded() {
    await settle();
    http.expectOne(`${API}/official`).flush(ROWS);
    await settle();
  }
  async function opened(id = 9, taskId = 90, over: Partial<RubricDetail> = {}) {
    await loaded();
    await click(row(taskId));
    http.expectOne(`${API}/${id}`).flush(detail(id, over));
    await settle();
  }
  async function typeNote(value: string) {
    note()!.value = value;
    note()!.dispatchEvent(new Event('input'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminSzempontlistakComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminSzempontlistakComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: spinner, utána a haladás, a lista és a részlet-helyőrző; a szempontlista nélküli sor tiltott', async () => {
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('[data-testid="rubric-list"]')).toBeNull();
    http.expectOne(`${API}/official`).flush(ROWS);
    await settle();
    expect(spinner()).toBe(0);
    expect(text(el.querySelector('[data-testid="rubric-progress"]'))).toBe('1 / 3 jóváhagyva');
    expect(listRows()).toEqual([
      '2024. május · emelt Szövegszerkesztés · 2 tétel vázlat',
      '2024. május · közép Adatbázis · 30 tétel jóváhagyva',
      '2023. október · emelt other · 0 tétel nincs',
    ]);
    expect(row(92).disabled).toBe(true);
    expect(row(90).querySelector('.shrink-0')!.classList.contains('text-warning')).toBe(true);
    expect(row(91).querySelector('.shrink-0')!.classList.contains('text-success')).toBe(true);
    expect(text(detailCard())).toBe('Válassz egy feladatot a listából.');
  });

  it('a lista betöltési hibája: üzenet, üres lista', async () => {
    await settle();
    fail(http.expectOne(`${API}/official`));
    await settle();
    expect(errorText()).toBe('A szempontlisták betöltése nem sikerült.');
    expect(text(el.querySelector('[data-testid="rubric-progress"]'))).toBe('0 / 0 jóváhagyva');
    expect(text(el.querySelector('[data-testid="rubric-list"]'))).toBe('Nincs jóváhagyásra váró szempontlista.');
  });

  it('a „csak a jóváhagyásra várók” szűrő kérés nélkül szűr', async () => {
    await loaded();
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await settle();
    expect(listRows().length).toBe(2);
    expect(row(91)).toBeNull();
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await settle();
    expect(listRows().length).toBe(3);
  });

  it('részletek: közben spinner a részlet-kártyában; a kijelölt sor kiemelve; fejléc, összegek, tételek; másik sornál a megjegyzés ürül', async () => {
    await loaded();
    await click(row(90));
    expect(text(detailCard())).toBe('Betöltés…');
    expect(detailCard()!.querySelectorAll('app-local-spinner').length).toBe(1);
    expect(row(90).classList.contains('bg-bg-element')).toBe(true);
    http.expectOne(`${API}/9`).flush(detail(9, { note: 'Régi megjegyzés' }));
    await settle();
    expect(text(detailCard())).toBe(
      '2024. május · emeltszint · Szövegszerkesztés Feladat 9 · 1. verzió · vázlat Szempontok összesen: 2 / 2 nyers pont Vizsgapont: 3 (a feladaté: 3) '
      + 'Megjegyzés: Régi megjegyzés A fájl Létezik a fájl 1 p Jó a neve 1 p Megjegyzés (elutasításnál kötelező) Jóváhagyom Elutasítom',
    );
    await typeNote('valami');
    expect(button('Elutasítom').disabled).toBe(false);

    await click(row(91));
    expect(row(90).classList.contains('bg-bg-element')).toBe(false);
    expect(row(91).classList.contains('bg-bg-element')).toBe(true);
    http.expectOne(`${API}/10`).flush(detail(10, { status: 'approved', levelId: 2 }));
    await settle();
    expect(note()).toBeNull();
    expect(text(detailCard())).toContain('Feladat 10 · 1. verzió · jóváhagyva');

    await click(row(90));
    http.expectOne(`${API}/9`).flush(detail(9));
    await settle();
    expect(note()!.value).toBe('');
  });

  it('ugyanarra a sorra újra kattintva újratölt', async () => {
    await opened();
    await click(row(90));
    expect(detailCard()!.querySelectorAll('app-local-spinner').length).toBe(1);
    http.expectOne(`${API}/9`).flush(detail(9, { taskTitle: 'Frissített' }));
    await settle();
    expect(text(detailCard())).toContain('Frissített');
  });

  it('a részlet betöltési hibája: üzenet, a korábbi részlet marad', async () => {
    await opened();
    await click(row(91));
    fail(http.expectOne(`${API}/10`));
    await settle();
    expect(errorText()).toBe('A szempontlista betöltése nem sikerült.');
    expect(text(detailCard())).toContain('Feladat 9');
  });

  it('jóváhagyás: a kérés, közben tiltva; a részlet és a sor állapota frissül, a haladás nő', async () => {
    await opened();
    await click(button('Jóváhagyom'));
    const req = http.expectOne(`${API}/9/review`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ approve: true, note: null });
    expect(button('Jóváhagyom').disabled).toBe(true);
    req.flush(detail(9, { status: 'approved' }));
    await settle();
    expect(text(detailCard())).toContain('Feladat 9 · 1. verzió · jóváhagyva');
    expect(el.querySelector('textarea')).toBeNull();
    expect(listRows()[0]).toBe('2024. május · emelt Szövegszerkesztés · 2 tétel jóváhagyva');
    expect(text(el.querySelector('[data-testid="rubric-progress"]'))).toBe('2 / 3 jóváhagyva');
  });

  it('elutasítás csak megjegyzéssel (levágva megy); hibánál a szerver üzenete, a következő művelet törli', async () => {
    await opened();
    expect(button('Elutasítom').disabled).toBe(true);
    await typeNote('  Rossz összeg  ');
    await click(button('Elutasítom'));
    const req = http.expectOne(`${API}/9/review`);
    expect(req.request.body).toEqual({ approve: false, note: 'Rossz összeg' });
    fail(req, { errorMessage: 'Már jóváhagyták.' });
    await settle();
    expect(errorText()).toBe('Már jóváhagyták.');
    expect(button('Elutasítom').disabled).toBe(false);

    await click(button('Elutasítom'));
    expect(errorText()).toBeNull();
    http.expectOne(`${API}/9/review`).flush(detail(9, { status: 'rejected', note: 'Rossz összeg' }));
    await settle();
    expect(listRows()[0]).toBe('2024. május · emelt Szövegszerkesztés · 2 tétel elutasítva');
    expect(text(el.querySelector('[data-testid="rubric-progress"]'))).toBe('1 / 3 jóváhagyva');
  });

  it('hibás listánál a jóváhagyás tiltott, a problémák látszanak', async () => {
    await opened(9, 90, { problems: ['Az összeg nem egyezik.'] });
    expect(text(el.querySelector('[data-testid="rubric-problems"]'))).toBe('Az összeg nem egyezik.');
    expect(button('Jóváhagyom').disabled).toBe(true);
  });
});
