import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminErettsegiEredmenyekComponent } from './admin-erettsegi-eredmenyek.component';
import { ExamOutcomeQuote, ExamOutcomeSummary } from '../../models/exam-outcomes.model';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin/exam-outcomes';

const summary = (year: number, usable = 7): ExamOutcomeSummary => ({
  year, years: [2027, 2026], responses: 9, notTaken: 1, fromParents: 2, usable, pendingQuotes: 1,
  levels: [{ level: 'kozep', count: 4, averagePercent: 71.5, grades: [0, 0, 1, 2, 1], segments: [] }],
  accuracy: { count: 0, meanAbsoluteError: null, withinBandShare: null, meanSignedError: null },
});
const Q1: ExamOutcomeQuote = { id: 3, year: 2027, level: 'emelt', percent: 68, grade: 4, quote: 'Megérte!', status: 'pending', updatedAt: '2027-07-01T10:00:00' };
const Q2: ExamOutcomeQuote = { ...Q1, id: 4, quote: 'Jó volt.', level: 'kozep' };

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): az Érettségi-eredmények oldal betöltése,
 * évváltása, idézet-szűrője, moderálása és CSV-letöltése a valódi service-szel + HttpTestingController, DOM-on keresztül.
 */
describe('AdminErettsegiEredmenyekComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminErettsegiEredmenyekComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const text = (root: Element | null) => {
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
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger')?.textContent?.trim() ?? null;
  const tiles = () => text(el.querySelector('.grid.grid-cols-2'));
  const quotes = () => [...el.querySelectorAll('[data-testid="quotes"] li')].map((li) => text(li));
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });
  const summaryReq = (year: string | null) =>
    http.expectOne((r) => r.url === `${API}/summary` && r.params.get('year') === year);
  const quotesReq = (status: string) => http.expectOne((r) => r.url === `${API}/quotes` && r.params.get('status') === status);
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }
  async function loaded(quoteList: ExamOutcomeQuote[] = [Q1, Q2]) {
    await settle();
    summaryReq(null).flush(summary(2027));
    quotesReq('pending').flush(quoteList);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminErettsegiEredmenyekComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminErettsegiEredmenyekComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: spinner, az aktuális év összesítője és a moderálásra váró idézetek; az év-választó', async () => {
    await settle();
    expect(spinner()).toBe(1);
    summaryReq(null).flush(summary(2027));
    quotesReq('pending').flush([Q1]);
    await settle();
    expect(spinner()).toBe(0);
    expect(tiles()).toBe('Válasz 9 Felhasználható eredmény 7 Szülő adta meg 2 „Nem érettségiztem” 1');
    const select = el.querySelector('select')!;
    expect([...select.options].map((o) => [o.value, o.selected])).toEqual([['2027', true], ['2026', false]]);
    expect(quotes()).toEqual(['„Megérte!” Emelt szint, 2027 · 68% · 2027.07.01. Jóváhagyom Elutasítom']);
    const chips = [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Állapot"] button')];
    expect(chips.map((b) => [text(b), b.classList.contains('bg-primary')])).toEqual([
      ['Moderálásra vár', true], ['Jóváhagyott', false], ['Elutasított', false],
    ]);
  });

  it('az összesítő hibája: üzenet, tartalom nélkül', async () => {
    await settle();
    fail(summaryReq(null));
    quotesReq('pending').flush([Q1]);
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('Az érettségi-eredmények betöltése nem sikerült.');
    expect(el.querySelector('[data-testid="quotes"]')).toBeNull();
  });

  it('évváltás: spinner nélkül a régi tartalom marad a válaszig; hibánál üzenet és a régi tartalom', async () => {
    await loaded();
    const select = el.querySelector('select')!;
    select.value = '2026';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(spinner()).toBe(0);
    expect(tiles()).toContain('Felhasználható eredmény 7');
    summaryReq('2026').flush({ ...summary(2026, 3) });
    await settle();
    expect(tiles()).toContain('Felhasználható eredmény 3');
    expect([...el.querySelector('select')!.options].map((o) => o.selected)).toEqual([false, true]);

    const select2 = el.querySelector('select')!;
    select2.value = '2027';
    select2.dispatchEvent(new Event('change'));
    await settle();
    fail(summaryReq('2027'));
    await settle();
    expect(errorText()).toBe('Az érettségi-eredmények betöltése nem sikerült.');
    expect(tiles()).toContain('Felhasználható eredmény 3');
  });

  it('idézet-szűrő: az állapot azonnal vált, a régi lista a válaszig marad; hibánál üzenet', async () => {
    await loaded();
    await click(button('Jóváhagyott'));
    expect(button('Jóváhagyott').classList.contains('bg-primary')).toBe(true);
    expect(quotes().length).toBe(2);
    quotesReq('approved').flush([{ ...Q1, status: 'approved' }]);
    await settle();
    expect(quotes()).toEqual(['„Megérte!” Emelt szint, 2027 · 68% · 2027.07.01.']);

    await click(button('Elutasított'));
    quotesReq('rejected').flush([]);
    await settle();
    expect(quotes()).toEqual(['Nincs ilyen idézet.']);

    await click(button('Moderálásra vár'));
    fail(quotesReq('pending'));
    await settle();
    expect(errorText()).toBe('Az idézetek betöltése nem sikerült.');
    expect(quotes()).toEqual(['Nincs ilyen idézet.']);
  });

  it('moderálás: PUT, sikernél a sor kikerül; hibánál üzenet és a sor marad', async () => {
    await loaded();
    await click(el.querySelectorAll<HTMLButtonElement>('[data-testid="quotes"] li')[0].querySelectorAll('button')[1]);
    const req = http.expectOne(`${API}/quotes/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ approved: false });
    req.flush({ ...Q1, status: 'rejected' });
    await settle();
    expect(quotes().length).toBe(1);
    expect(quotes()[0]).toContain('Jó volt.');

    await click(button('Jóváhagyom'));
    fail(http.expectOne(`${API}/quotes/4`));
    await settle();
    expect(errorText()).toBe('A moderálás nem sikerült.');
    expect(quotes().length).toBe(1);
  });

  it('CSV: a kiválasztott év, a fájlnév; 0 felhasználható eredménynél tiltva; hibánál üzenet', async () => {
    await loaded();
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    await click(button('CSV letöltése'));
    http.expectOne((r) => r.url === `${API}/export` && r.params.get('year') === '2027').flush(new Blob(['x']));
    await settle();
    expect(downloadName).toBe('erettsegi-eredmenyek-2027.csv');

    await click(button('CSV letöltése'));
    http.expectOne(`${API}/export?year=2027`).flush(new Blob(['x']), { status: 500, statusText: 'Server Error' });
    await settle();
    expect(errorText()).toBe('A CSV letöltése nem sikerült.');

    const select = el.querySelector('select')!;
    select.value = '2026';
    select.dispatchEvent(new Event('change'));
    await settle();
    summaryReq('2026').flush(summary(2026, 0));
    await settle();
    expect(button('CSV letöltése').disabled).toBe(true);
    vi.restoreAllMocks();
  });
});
