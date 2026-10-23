import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminGradeDisputesComponent } from './admin-grade-disputes.component';
import { ToastService } from '../../shared/toast/toast.service';
import { GradeDispute } from '../../models/grade-dispute.model';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin/grade-disputes';

const D1: GradeDispute = {
  id: 3, createdAt: '2026-10-03T08:00:00', reason: 'A margó 2 cm volt.', studentName: 'Kiss Anna', studentEmail: 'anna@example.com',
  taskId: 93, taskTitle: 'Dokumentumkészítés', taskSetTitle: '2024. május-június', examSessionId: 2442, kind: 'files',
  rubricStatus: 'draft', model: 'gemini', rawPoints: 28, rawTotal: 35, summary: 'Jó munka.',
  items: [
    { itemId: 1, order: 1, section: null, text: 'A margó 2 cm', kind: 'criterion', maxPoints: 2, points: 1, ok: null, reason: '1,5 cm', groupNo: null },
    { itemId: 2, order: 2, section: null, text: 'A cím középen', kind: 'statement', maxPoints: 0, points: 0, ok: false, reason: 'balra', groupNo: 1 },
    { itemId: 3, order: 3, section: null, text: 'Fejléc', kind: 'criterion', maxPoints: 1, points: 1, ok: null, reason: null, groupNo: null },
  ],
  files: [{ id: 'f1', name: 'danuvia.docx', sizeBytes: 83007 }],
  resolvedAt: null, resolution: null, disputedItemIds: [],
};
const D2: GradeDispute = {
  ...D1, id: 4, studentName: '', studentEmail: 'bela@example.com', taskTitle: 'SQL', examSessionId: null, kind: 'code', rubricStatus: null,
  reason: null, summary: null, files: [], resolvedAt: '2026-10-05T10:00:00', resolution: 'Rendben volt.',
};

const CHIP_BASE = ['border', 'font-semibold', 'px-3', 'py-1.5', 'rounded-lg', 'transition-colors'];
const CHIP_ACTIVE = [...CHIP_BASE, 'bg-primary', 'border-primary', 'text-white'].sort();
const CHIP_INACTIVE = [...CHIP_BASE, 'border-border-default', 'text-text-muted'].sort();

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): az értékelési kifogások várólistája a
 * valódi service-szel + HttpTestingController, DOM-on keresztül (szűrők, lapozás, lezárás javításokkal, letöltés, hibák).
 */
describe('AdminGradeDisputesComponent – teljes lista', () => {
  let fixture: ComponentFixture<AdminGradeDisputesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let toastSuccess: ReturnType<typeof vi.spyOn>;
  let toastDanger: ReturnType<typeof vi.spyOn>;

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
  const sorted = (e: Element) => [...e.classList].sort();
  const button = (label: string, root: Element = el) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const rows = () => [...el.querySelectorAll('[data-testid="grade-dispute-row"]')];
  const items = () => [...el.querySelectorAll('ul.space-y-3 > li')].map((li) => text(li));
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger.mb-4')?.textContent?.trim() ?? null;
  const pager = () => el.querySelector<HTMLElement>('div.flex.items-center.gap-3.mt-4');
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });
  const listReq = (onlyOpen: boolean, page: number, kind: string | null = null) =>
    http.expectOne((r) => r.url === API && r.method === 'GET' && r.params.get('onlyOpen') === String(onlyOpen)
      && r.params.get('page') === String(page) && r.params.get('pageSize') === '20' && r.params.get('kind') === kind);
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }
  async function loaded(list: GradeDispute[] = [D1], totalCount = list.length) {
    await settle();
    listReq(true, 1).flush({ items: list, totalCount });
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminGradeDisputesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    toastSuccess = vi.spyOn(toast, 'success');
    toastDanger = vi.spyOn(toast, 'danger');
    fixture = TestBed.createComponent(AdminGradeDisputesComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: spinner, a nyitottak első oldala; a sor teljes szövege; a szűrők állapota; nincs lapozó', async () => {
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('ul')).toBeNull();
    listReq(true, 1).flush({ items: [D1, D2], totalCount: 2 });
    await settle();
    expect(spinner()).toBe(0);
    expect(text(rows()[0])).toBe(
      '2024. május-június – Dokumentumkészítés Kiss Anna (anna@example.com) · vizsga #2442 · 28/35 nyers pont · gemini · vázlat-útmutató '
      + '2026.10.03 08:00 A diák szerint: A margó 2 cm volt. MI-összegzés: Jó munka. Letöltés: danuvia.docx (81 KB) '
      + 'Pontot vesztett szempontok (2 / 3) 1/2 A margó 2 cm – 1,5 cm ✗ A cím középen – balra '
      + 'Javítás tételenként (a pontot vesztett tételek) – csak ha a diáknak igaza van: / 2 A margó 2 cm – 1,5 cm igaz A cím középen – balra '
      + 'Lezárás',
    );
    expect(text(rows()[1])).toBe(
      '2024. május-június – SQL bela@example.com (bela@example.com) · gyakorlás (kód/SQL) · 28/35 nyers pont · gemini 2026.10.03 08:00 '
      + 'A diák szerint: (nem írt indoklást) Pontot vesztett szempontok (2 / 3) 1/2 A margó 2 cm – 1,5 cm ✗ A cím középen – balra '
      + 'Lezárva 2026.10.05 Válasz: Rendben volt.',
    );
    expect(sorted(button('Csak nyitottak'))).toEqual(CHIP_ACTIVE);
    expect(sorted(button('Összes'))).toEqual(CHIP_INACTIVE);
    expect(sorted(button('Minden fajta'))).toEqual(CHIP_ACTIVE);
    expect(button('Minden fajta').getAttribute('aria-pressed')).toBe('true');
    expect(button('Kód / SQL').getAttribute('aria-pressed')).toBe('false');
    expect(pager()).toBeNull();
  });

  it('üres lista: a szűrő szerinti szöveg', async () => {
    await loaded([]);
    expect(items()).toEqual(['Nincs nyitott értékelési kifogás.']);
    await click(button('Összes'));
    listReq(false, 1).flush({ items: [], totalCount: 0 });
    await settle();
    expect(items()).toEqual(['Nincs értékelési kifogás.']);
  });

  it('szűrők: az állapot- és a fajta-szűrő az első oldalról tölt; közben spinner; ugyanarra kattintva is újratölt', async () => {
    await loaded([D1], 45);
    await click(button('Következő →'));
    listReq(true, 2).flush({ items: [D1], totalCount: 45 });
    await settle();

    await click(button('Kód / SQL'));
    expect(spinner()).toBe(1);
    expect(sorted(button('Kód / SQL'))).toEqual(CHIP_ACTIVE);
    listReq(true, 1, 'code').flush({ items: [D2], totalCount: 1 });
    await settle();
    expect(rows().length).toBe(1);

    await click(button('Összes'));
    listReq(false, 1, 'code').flush({ items: [D2], totalCount: 1 });
    await settle();
    await click(button('Összes'));
    listReq(false, 1, 'code').flush({ items: [D2], totalCount: 1 });
    await settle();
    await click(button('Irodai / weblap'));
    listReq(false, 1, 'files').flush({ items: [], totalCount: 0 });
    await settle();
    await click(button('Minden fajta'));
    listReq(false, 1).flush({ items: [], totalCount: 0 });
    await settle();
  });

  it('lapozás: 20 fölött látszik; oldalszám, tiltások, oldalváltás közben spinner', async () => {
    await loaded([D1], 45);
    expect(text(pager()!)).toBe('← Előző 1 / 3 Következő →');
    expect(button('← Előző').disabled).toBe(true);
    expect(button('Következő →').disabled).toBe(false);
    await click(button('Következő →'));
    expect(spinner()).toBe(1);
    listReq(true, 2).flush({ items: [D1], totalCount: 45 });
    await settle();
    await click(button('Következő →'));
    listReq(true, 3).flush({ items: [D1], totalCount: 45 });
    await settle();
    expect(text(pager()!)).toBe('← Előző 3 / 3 Következő →');
    expect(button('Következő →').disabled).toBe(true);
    await click(button('← Előző'));
    listReq(true, 2).flush({ items: [D1], totalCount: 45 });
    await settle();
    expect(text(pager()!)).toBe('← Előző 2 / 3 Következő →');
  });

  it('betöltési hiba: üzenet, a korábbi lista marad; a következő betöltés törli', async () => {
    await loaded([D1], 45);
    await click(button('Következő →'));
    fail(listReq(true, 2));
    await settle();
    expect(errorText()).toBe('Nem sikerült betölteni a kifogásokat.');
    expect(rows().length).toBe(1);
    expect(text(pager()!)).toBe('← Előző 2 / 3 Következő →');
    await click(button('← Előző'));
    expect(errorText()).toBeNull();
    listReq(true, 1).flush({ items: [D1], totalCount: 45 });
    await settle();
  });

  it('lezárás: a válasz és csak a megváltozott javítások mennek; közben tiltott; utána toast és újratöltés (az oldal marad)', async () => {
    await loaded([D1], 45);
    await click(button('Következő →'));
    listReq(true, 2).flush({ items: [D1], totalCount: 45 });
    await settle();

    const row = rows()[0];
    const points = row.querySelector<HTMLInputElement>('input[type="number"]')!;
    points.value = '2';
    points.dispatchEvent(new Event('input'));
    const ok = row.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    ok.click();
    await settle();
    ok.click();
    await settle();
    const answer = row.querySelector('textarea')!;
    answer.value = '  Igazad van.  ';
    answer.dispatchEvent(new Event('input'));
    await settle();

    await click(button('Lezárás'));
    const req = http.expectOne(`${API}/3/resolve`);
    expect(req.request.body).toEqual({ resolution: 'Igazad van.', corrections: [{ itemId: 1, points: 2, ok: null }] });
    expect(button('Lezárás').disabled).toBe(true);
    req.flush({});
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Lezárva - 1 tétel javítva, a diák értesítést kapott.');
    expect(spinner()).toBe(1);
    listReq(true, 2).flush({ items: [{ ...D1, id: 5 }], totalCount: 44 });
    await settle();
    expect(button('Lezárás').disabled).toBe(false);
  });

  it('lezárás javítás és válasz nélkül; hibánál toast és nincs újratöltés', async () => {
    await loaded();
    await click(button('Lezárás'));
    const req = http.expectOne(`${API}/3/resolve`);
    expect(req.request.body).toEqual({ resolution: null, corrections: [] });
    fail(req);
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Hiba történt.');
    expect(button('Lezárás').disabled).toBe(false);

    await click(button('Lezárás'));
    http.expectOne(`${API}/3/resolve`).flush({});
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Lezárva - a diák értesítést kapott.');
    listReq(true, 1).flush({ items: [], totalCount: 0 });
    await settle();
  });

  it('a diák által jelölt tételek javíthatók (a pontot nem vesztett is)', async () => {
    await loaded([{ ...D1, disputedItemIds: [3] }]);
    const box = el.querySelector('[data-testid="grade-corrections"]')!;
    expect(text(box)).toBe('Javítás tételenként (a diák által jelölt tételek) – csak ha a diáknak igaza van: / 1 Fejléc');
  });

  it('letöltés: a fájl a nevével; hibánál toast', async () => {
    await loaded();
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    await click(button('Letöltés: danuvia.docx (81 KB)'));
    http.expectOne(`${API}/3/files/f1`).flush(new Blob(['x']));
    await settle();
    expect(downloadName).toBe('danuvia.docx');
    await click(button('Letöltés: danuvia.docx (81 KB)'));
    http.expectOne(`${API}/3/files/f1`).flush(new Blob(['hiba']), { status: 404, statusText: 'Not Found' });
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('A fájl nem tölthető le.');
    vi.restoreAllMocks();
  });
});
