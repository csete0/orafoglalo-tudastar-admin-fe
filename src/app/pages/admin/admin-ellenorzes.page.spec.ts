import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate, registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminEllenorzesComponent } from './admin-ellenorzes.component';
import { ToastService } from '../../shared/toast/toast.service';
import { QuizQuestionReportDto } from '../../models/question-report.model';
import { InstitutionalInquiryDto } from '../../models/institutional-inquiry.model';
import { NeedsReviewPaymentDto } from '../../services/admin/admin-payment-review.service';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin';

const R1: QuizQuestionReportDto = {
  id: 1, questionId: 10, questionText: 'Mi az A?', quizId: 4, quizTitle: 'Első kvíz', topicName: 'Hálózatok', reason: 'Hibás válasz',
  createdAt: '2026-09-01T10:00:00', isReviewed: false, reviewedAt: null, questionReportCount: 2, questionIsApproved: true,
};
const R2: QuizQuestionReportDto = {
  id: 2, questionId: 20, questionText: 'Mi a B?', quizId: null, quizTitle: null, topicName: 'SQL', reason: null,
  createdAt: '2026-09-02T08:00:00', isReviewed: false, reviewedAt: null, questionReportCount: 1, questionIsApproved: false,
};
const R3: QuizQuestionReportDto = {
  ...R2, id: 3, questionText: 'Mi a B? (másik)', isReviewed: true, reviewedAt: '2026-09-05T12:00:00',
};
const I1: InstitutionalInquiryDto = {
  id: 7, schoolName: 'Teszt Iskola', contactName: 'Kiss Péter', email: 'kiss@iskola.hu', phone: '+36 1 234 5678',
  estimatedStudents: 120, message: 'Érdekel a licenc', createdAt: '2026-09-03T09:00:00', isHandled: false,
};
const I2: InstitutionalInquiryDto = {
  id: 8, schoolName: 'Másik Gimnázium', contactName: 'Nagy Anna', email: 'nagy@gimi.hu', createdAt: '2026-09-04T09:00:00',
  isHandled: true, handledAt: '2026-09-06T10:00:00', note: 'Felhívtam',
};
const I3: InstitutionalInquiryDto = {
  id: 9, schoolName: 'Harmadik Suli', contactName: 'Tóth Ede', email: 'toth@suli.hu', createdAt: '2026-09-05T09:00:00', isHandled: false,
};
const P1: NeedsReviewPaymentDto = {
  id: 31, userEmail: 'diak@pelda.hu', amount: 4990, stripePaymentIntentId: 'pi_123', createdAt: '2026-09-05T14:30:00',
  reviewNote: 'Kétszer terhelve',
};
const P2: NeedsReviewPaymentDto = {
  id: 32, userEmail: 'masik@pelda.hu', amount: 12000, stripePaymentIntentId: 'pi_456', createdAt: '2026-09-06T08:05:00', reviewNote: null,
};

const TAB_BASE = ['-mb-px', 'border-b-2', 'font-semibold', 'px-4', 'py-2', 'transition-colors'];
const TAB_ACTIVE = [...TAB_BASE, 'border-primary', 'text-primary'].sort();
const TAB_INACTIVE = [...TAB_BASE, 'border-transparent', 'text-text-muted'].sort();
const FILTER_BASE = ['border', 'font-semibold', 'px-3', 'py-1.5', 'rounded-lg', 'transition-colors'];
const FILTER_ACTIVE = [...FILTER_BASE, 'bg-primary', 'border-primary', 'text-white'].sort();
const FILTER_INACTIVE = [...FILTER_BASE, 'border-border-default', 'text-text-muted'].sort();

/**
 * Karakterizáció (a WP-C6 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a teljes Ellenőrzés oldal
 * a valódi service-ekkel + HttpTestingController, csak DOM-on keresztül (fülsor, a három lista szűrővel, lapozással, lusta
 * betöltéssel, hibákkal és a műveletekkel).
 */
describe('AdminEllenorzesComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminEllenorzesComponent>;
  let http: HttpTestingController;
  let toast: ToastService;
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
  const sorted = (e: Element) => [...e.classList].sort();
  const tabBar = () => el.querySelector('.max-w-5xl > .hairline + div')!;
  const tabButtons = () => [...tabBar().querySelectorAll<HTMLButtonElement>('button')];
  /** A fülsor utáni tartalom (a fül teljes DOM-ja); a `display: contents` fül-komponensek (`app-…-tab`) gyerekeivel. */
  const contentNodes = () => {
    const nodes: Element[] = [];
    for (let n = tabBar().nextElementSibling; n; n = n.nextElementSibling) {
      nodes.push(...(/^APP-.*-TAB$/.test(n.tagName) ? [...n.children] : [n]));
    }
    return nodes;
  };
  const filterBar = () => contentNodes()[0];
  const filterButtons = () => [...filterBar().querySelectorAll<HTMLButtonElement>('button')];
  const items = () => [...el.querySelectorAll('li')].map((li) => text(li));
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger')?.textContent?.trim() ?? null;
  const pager = () => el.querySelector<HTMLElement>('div.flex.items-center.gap-4');
  const pagerButtons = () => [...pager()!.querySelectorAll<HTMLButtonElement>('button')];
  const button = (label: string, root: Element = el) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const buttonsIn = (index: number) => [...el.querySelectorAll('li')[index].querySelectorAll<HTMLButtonElement>('button')];
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }
  async function tab(label: string) {
    await click(button(label, tabBar()));
  }
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });

  const reportsReq = (onlyOpen: boolean, page: number) =>
    http.expectOne((r) => r.url === `${API}/question-reports` && r.params.get('onlyOpen') === String(onlyOpen)
      && r.params.get('page') === String(page) && r.params.get('pageSize') === '20');
  const inquiriesReq = (onlyOpen: boolean, page: number) =>
    http.expectOne((r) => r.url === `${API}/institutional-inquiries` && r.params.get('onlyOpen') === String(onlyOpen)
      && r.params.get('page') === String(page) && r.params.get('pageSize') === '20');
  const paymentsReq = () => http.expectOne(`${API}/payments/needs-review`);
  const noListReq = () => {
    http.expectNone((r) => r.url === `${API}/question-reports`);
    http.expectNone((r) => r.url === `${API}/institutional-inquiries`);
    http.expectNone(`${API}/payments/needs-review`);
  };

  async function loaded(reports: QuizQuestionReportDto[] = [R1, R2], totalCount = reports.length) {
    await settle();
    reportsReq(true, 1).flush({ items: reports, totalCount });
    await settle();
  }
  async function inquiriesLoaded(list: InstitutionalInquiryDto[] = [I1, I3], totalCount = list.length) {
    await loaded();
    await tab('Érdeklődések');
    inquiriesReq(true, 1).flush({ items: list, totalCount });
    await settle();
  }
  async function paymentsLoaded(list: NeedsReviewPaymentDto[] = [P1, P2]) {
    await loaded();
    await tab('Fizetések');
    paymentsReq().flush(list);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminEllenorzesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(AdminEllenorzesComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => {
    toast.dismiss();
    http.verify();
  });

  it('betöltés: spinner a lista helyén, pontos kérés, teljes lista-szöveg; a fülsor és a szűrő régi osztályai', async () => {
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('ul')).toBeNull();
    expect(errorText()).toBeNull();
    reportsReq(true, 1).flush({ items: [R1, R2, R3], totalCount: 3 });
    await settle();

    expect(spinner()).toBe(0);
    expect(text(el.querySelector('h1')!)).toBe('Ellenőrzés');
    expect(tabBar().className).toBe('flex gap-1 mb-6 text-sm border-b border-border-default');
    expect(tabButtons().map((b) => text(b))).toEqual(['Kérdés-jelentések', 'Érdeklődések', 'Fizetések', 'Értékelési kifogások']);
    expect(tabButtons().map(sorted)).toEqual([TAB_ACTIVE, TAB_INACTIVE, TAB_INACTIVE, TAB_INACTIVE]);
    expect(filterBar().className).toBe('flex gap-2 mb-6 text-sm flex-wrap');
    expect(filterButtons().map((b) => text(b))).toEqual(['Csak nyitottak', 'Összes']);
    expect(filterButtons().map(sorted)).toEqual([FILTER_ACTIVE, FILTER_INACTIVE]);

    expect(items()).toEqual([
      'Mi az A? Kvíz: Első kvíz · Téma: Hálózatok · 2 jelentés 2026.09.01 „Hibás válasz" Elintézve',
      'Mi a B? Közös bank-kérdés · Téma: SQL · 1 jelentés · deaktivált 2026.09.02 Elintézve Kérdés visszaengedélyezése',
      'Mi a B? (másik) Közös bank-kérdés · Téma: SQL · 1 jelentés · deaktivált 2026.09.02 Elintézve 2026.09.05',
    ]);
    expect(el.querySelectorAll('li')[2].querySelector('.badge.badge-success')).not.toBeNull();
    expect(buttonsIn(1).map((b) => b.className)).toEqual([
      'btn btn-primary !px-3 !py-1.5 !text-xs', 'btn !bg-success !text-white !px-3 !py-1.5 !text-xs',
    ]);
    expect(pager()).toBeNull();
    noListReq();
  });

  it('szűrő: „Összes” → onlyOpen=false az 1. oldalról, közben spinner; ugyanarra újra kattintva is újratölt; üres-szövegek', async () => {
    await loaded([], 0);
    expect(items()).toEqual(['Nincs elintézetlen jelentés.']);

    await click(filterButtons()[1]);
    expect(filterButtons().map(sorted)).toEqual([FILTER_INACTIVE, FILTER_ACTIVE]);
    expect(spinner()).toBe(1);
    expect(el.querySelector('ul')).toBeNull();
    reportsReq(false, 1).flush({ items: [], totalCount: 0 });
    await settle();
    expect(items()).toEqual(['Nincs egyetlen jelentés sem.']);

    await click(filterButtons()[1]);
    reportsReq(false, 1).flush({ items: [R3], totalCount: 1 });
    await settle();
    expect(items()).toEqual(['Mi a B? (másik) Közös bank-kérdés · Téma: SQL · 1 jelentés · deaktivált 2026.09.02 Elintézve 2026.09.05']);
  });

  it('lapozás: 20 fölött látszik, gombok tiltása, oldalváltás a szűrővel; szűrőváltás az 1. oldalra visz', async () => {
    await loaded([R1, R2], 20);
    expect(pager()).toBeNull();

    await click(filterButtons()[0]);
    reportsReq(true, 1).flush({ items: [R1, R2], totalCount: 45 });
    await settle();
    expect(pager()!.className).toBe('flex items-center gap-4 mt-6 text-sm');
    expect(text(pager()!)).toBe('← Előző 1 / 3 Következő →');
    expect(pagerButtons().map((b) => b.className)).toEqual(['btn btn-ghost !px-3 !py-1.5', 'btn btn-ghost !px-3 !py-1.5']);
    expect(pager()!.querySelector('span')!.className).toBe('text-text-muted');
    expect(pagerButtons().map((b) => b.disabled)).toEqual([true, false]);

    await click(pagerButtons()[1]);
    expect(spinner()).toBe(1);
    expect(pager()).toBeNull();
    reportsReq(true, 2).flush({ items: [R1], totalCount: 45 });
    await settle();
    expect(text(pager()!)).toBe('← Előző 2 / 3 Következő →');
    await click(pagerButtons()[1]);
    reportsReq(true, 3).flush({ items: [R2], totalCount: 45 });
    await settle();
    expect(pagerButtons().map((b) => b.disabled)).toEqual([false, true]);
    expect(items().length).toBe(1);

    await click(pagerButtons()[0]);
    reportsReq(true, 2).flush({ items: [R1], totalCount: 45 });
    await settle();

    await click(filterButtons()[1]);
    reportsReq(false, 1).flush({ items: [R1, R2, R3], totalCount: 60 });
    await settle();
    expect(text(pager()!)).toBe('← Előző 1 / 3 Következő →');
  });

  it('betöltési hiba: hibaüzenet, a korábbi lista és lapozó marad; a következő betöltés törli', async () => {
    await loaded([R1, R2], 45);
    await click(pagerButtons()[1]);
    fail(reportsReq(true, 2));
    await settle();
    expect(errorText()).toBe('A jelentések betöltése sikertelen.');
    expect(items().map((t) => t.slice(0, 8))).toEqual(['Mi az A?', 'Mi a B? ']);
    expect(text(pager()!)).toBe('← Előző 2 / 3 Következő →');

    await click(pagerButtons()[0]);
    expect(errorText()).toBeNull();
    reportsReq(true, 1).flush({ items: [R2], totalCount: 45 });
    await settle();
    expect(errorText()).toBeNull();
    expect(items().length).toBe(1);
  });

  it('az első betöltés hibája: hibaüzenet és az üres-szöveg', async () => {
    await settle();
    fail(reportsReq(true, 1));
    await settle();
    expect(errorText()).toBe('A jelentések betöltése sikertelen.');
    expect(items()).toEqual(['Nincs elintézetlen jelentés.']);
  });

  it('Elintézve nyitott módban: POST, közben minden művelet-gomb tiltott, a sor eltűnik, a darabszám csökken, toast', async () => {
    await loaded([R1, R2], 21);
    expect(text(pager()!)).toBe('← Előző 1 / 2 Következő →');

    await click(buttonsIn(0)[0]);
    const req = http.expectOne(`${API}/question-reports/1/resolve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect([...buttonsIn(0), ...buttonsIn(1)].map((b) => b.disabled)).toEqual([true, true, true]);
    req.flush(null);
    await settle();

    expect(items().map((t) => t.slice(0, 7))).toEqual(['Mi a B?']);
    expect(buttonsIn(0).map((b) => b.disabled)).toEqual([false, false]);
    expect(pager()).toBeNull();
    expect(toast.toast()).toEqual({ state: 'success', message: 'Elintézve jelölve.' });
    noListReq();
  });

  it('Elintézve „Összes” módban: a sor helyben „Elintézve” jelvényt kap (dátum nélkül), nincs újratöltés', async () => {
    await loaded();
    await click(filterButtons()[1]);
    reportsReq(false, 1).flush({ items: [R1, R2], totalCount: 2 });
    await settle();

    await click(buttonsIn(1)[0]);
    http.expectOne(`${API}/question-reports/2/resolve`).flush(null);
    await settle();
    expect(items()[1]).toBe('Mi a B? Közös bank-kérdés · Téma: SQL · 1 jelentés · deaktivált 2026.09.02 Elintézve');
    expect(el.querySelectorAll('li')[1].querySelector('.badge.badge-success')).not.toBeNull();
    expect(buttonsIn(1)).toEqual([]);
    noListReq();
  });

  it('visszaengedélyezés: a kérdés minden sora engedélyezett lesz, toast; a művelet hibája toast, a lista változatlan', async () => {
    await loaded([R1, R2, { ...R3, isReviewed: false, reviewedAt: null }]);

    await click(buttonsIn(1)[1]);
    const req = http.expectOne(`${API}/questions/20/approve`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await settle();
    expect(items()).toEqual([
      'Mi az A? Kvíz: Első kvíz · Téma: Hálózatok · 2 jelentés 2026.09.01 „Hibás válasz" Elintézve',
      'Mi a B? Közös bank-kérdés · Téma: SQL · 1 jelentés 2026.09.02 Elintézve',
      'Mi a B? (másik) Közös bank-kérdés · Téma: SQL · 1 jelentés 2026.09.02 Elintézve',
    ]);
    expect(toast.toast()).toEqual({ state: 'success', message: 'Kérdés visszaengedélyezve.' });

    await click(buttonsIn(0)[0]);
    fail(http.expectOne(`${API}/question-reports/1/resolve`));
    await settle();
    expect(toast.toast()).toEqual({ state: 'danger', message: 'Hiba történt.' });
    expect(items().length).toBe(3);
    expect(buttonsIn(0)[0].disabled).toBe(false);
  });

  it('fülváltás: a jelentések nem töltődnek újra, a szűrő és a lista megmarad; a kifogások füle a saját komponensét mutatja', async () => {
    await loaded();
    await click(filterButtons()[1]);
    reportsReq(false, 1).flush({ items: [R3], totalCount: 1 });
    await settle();

    await tab('Értékelési kifogások');
    expect(tabButtons().map(sorted)).toEqual([TAB_INACTIVE, TAB_INACTIVE, TAB_INACTIVE, TAB_ACTIVE]);
    expect(contentNodes().map((n) => n.tagName)).toEqual(['APP-ADMIN-GRADE-DISPUTES']);
    http.expectOne((r) => r.url === `${API}/grade-disputes`).flush({ items: [], totalCount: 0 });
    await settle();

    await tab('Kérdés-jelentések');
    expect(filterButtons().map(sorted)).toEqual([FILTER_INACTIVE, FILTER_ACTIVE]);
    expect(items().length).toBe(1);
    noListReq();
  });

  it('érdeklődések: lusta betöltés a fülre lépve, teljes szöveg; visszalépve nem tölt újra', async () => {
    await loaded();
    http.expectNone((r) => r.url === `${API}/institutional-inquiries`);
    await tab('Érdeklődések');
    expect(tabButtons().map(sorted)).toEqual([TAB_INACTIVE, TAB_ACTIVE, TAB_INACTIVE, TAB_INACTIVE]);
    expect(spinner()).toBe(1);
    expect(filterButtons().map(sorted)).toEqual([FILTER_ACTIVE, FILTER_INACTIVE]);
    inquiriesReq(true, 1).flush({ items: [I1, I2, I3], totalCount: 3 });
    await settle();

    expect(spinner()).toBe(0);
    expect(items()).toEqual([
      'Teszt Iskola Kiss Péter · kiss@iskola.hu · +36 1 234 5678 · ~120 fő 2026.09.03 „Érdekel a licenc" Kezelve jelölés',
      'Másik Gimnázium Nagy Anna · nagy@gimi.hu 2026.09.04 Kezelve 2026.09.06 Megjegyzés: Felhívtam',
      'Harmadik Suli Tóth Ede · toth@suli.hu 2026.09.05 Kezelve jelölés',
    ]);
    const input = el.querySelector<HTMLInputElement>('li input')!;
    expect(input.placeholder).toBe('Megjegyzés (opcionális)');
    expect(input.className).toBe('input !py-1.5 !text-xs ng-untouched ng-pristine ng-valid');
    expect(input.getAttribute('maxlength')).toBe('500');

    await tab('Kérdés-jelentések');
    await tab('Érdeklődések');
    expect(items().length).toBe(3);
    noListReq();
  });

  it('érdeklődések: szűrő, lapozás, hiba (a korábbi lista marad); üres listával visszalépve újratölt a mostani szűrővel', async () => {
    await inquiriesLoaded([I1], 30);
    expect(text(pager()!)).toBe('← Előző 1 / 2 Következő →');
    await click(pagerButtons()[1]);
    expect(spinner()).toBe(1);
    fail(inquiriesReq(true, 2));
    await settle();
    expect(errorText()).toBe('Az érdeklődések betöltése sikertelen.');
    expect(items().map((t) => t.slice(0, 12))).toEqual(['Teszt Iskola']);
    expect(text(pager()!)).toBe('← Előző 2 / 2 Következő →');

    await click(filterButtons()[1]);
    expect(filterButtons().map(sorted)).toEqual([FILTER_INACTIVE, FILTER_ACTIVE]);
    inquiriesReq(false, 1).flush({ items: [], totalCount: 0 });
    await settle();
    expect(errorText()).toBeNull();
    expect(items()).toEqual(['Nincs egyetlen érdeklődés sem.']);
    expect(pager()).toBeNull();

    await tab('Fizetések');
    paymentsReq().flush([]);
    await settle();
    await tab('Érdeklődések');
    expect(filterButtons().map(sorted)).toEqual([FILTER_INACTIVE, FILTER_ACTIVE]);
    inquiriesReq(false, 1).flush({ items: [I2], totalCount: 1 });
    await settle();
    expect(items().map((t) => t.slice(0, 15))).toEqual(['Másik Gimnázium']);
  });

  it('érdeklődések: az első betöltés hibája után visszalépve újrapróbál', async () => {
    await loaded();
    await tab('Érdeklődések');
    fail(inquiriesReq(true, 1));
    await settle();
    expect(errorText()).toBe('Az érdeklődések betöltése sikertelen.');
    expect(items()).toEqual(['Nincs kezeletlen érdeklődés.']);

    await tab('Kérdés-jelentések');
    await tab('Érdeklődések');
    inquiriesReq(true, 1).flush({ items: [I1], totalCount: 1 });
    await settle();
    expect(errorText()).toBeNull();
    expect(items().length).toBe(1);
  });

  it('Kezelve jelölés nyitott módban: a megjegyzés a POST-ban (üresen null), közben tiltott gombok, a sor eltűnik, toast', async () => {
    await inquiriesLoaded([I1, I3], 21);
    const input = el.querySelector<HTMLInputElement>('li input')!;
    input.value = 'Visszahívtam';
    input.dispatchEvent(new Event('input'));
    await settle();

    // a beírt megjegyzés fülváltás után is megmarad
    await tab('Kérdés-jelentések');
    await tab('Érdeklődések');
    expect(el.querySelector<HTMLInputElement>('li input')!.value).toBe('Visszahívtam');

    await click(button('Kezelve jelölés', el.querySelectorAll('li')[0]));
    const req = http.expectOne(`${API}/institutional-inquiries/7/handled`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ note: 'Visszahívtam' });
    expect([...el.querySelectorAll<HTMLButtonElement>('li button')].map((b) => b.disabled)).toEqual([true, true]);
    req.flush(null);
    await settle();
    expect(items().map((t) => t.slice(0, 15))).toEqual(['Harmadik Suli T']);
    expect(pager()).toBeNull();
    expect(toast.toast()).toEqual({ state: 'success', message: 'Érdeklődés kezelve jelölve.' });

    await click(button('Kezelve jelölés'));
    const req2 = http.expectOne(`${API}/institutional-inquiries/9/handled`);
    expect(req2.request.body).toEqual({ note: null });
    req2.flush(null);
    await settle();
    expect(items()).toEqual(['Nincs kezeletlen érdeklődés.']);
    noListReq();
  });

  it('Kezelve jelölés „Összes” módban: helyben kezelt lesz a mai dátummal és a megjegyzéssel; hiba → toast, változatlan', async () => {
    await inquiriesLoaded();
    await click(filterButtons()[1]);
    inquiriesReq(false, 1).flush({ items: [I1, I3], totalCount: 2 });
    await settle();

    await click(button('Kezelve jelölés', el.querySelectorAll('li')[1]));
    fail(http.expectOne(`${API}/institutional-inquiries/9/handled`));
    await settle();
    expect(toast.toast()).toEqual({ state: 'danger', message: 'Hiba történt.' });
    expect(items()[1]).toBe('Harmadik Suli Tóth Ede · toth@suli.hu 2026.09.05 Kezelve jelölés');

    const input = el.querySelectorAll<HTMLInputElement>('li input')[0];
    input.value = 'Ajánlat elküldve';
    input.dispatchEvent(new Event('input'));
    await click(button('Kezelve jelölés', el.querySelectorAll('li')[0]));
    http.expectOne(`${API}/institutional-inquiries/7/handled`).flush(null);
    await settle();
    const today = formatDate(new Date(), 'yyyy.MM.dd', 'en-US');
    expect(items()[0]).toBe(
      `Teszt Iskola Kiss Péter · kiss@iskola.hu · +36 1 234 5678 · ~120 fő 2026.09.03 „Érdekel a licenc" Kezelve ${today} Megjegyzés: Ajánlat elküldve`);

    await click(button('Kezelve jelölés'));
    http.expectOne(`${API}/institutional-inquiries/9/handled`).flush(null);
    await settle();
    expect(items()[1]).toBe(`Harmadik Suli Tóth Ede · toth@suli.hu 2026.09.05 Kezelve ${today}`);
    noListReq();
  });

  it('fizetések: lusta betöltés, teljes szöveg, felülvizsgálva → eltűnik + toast; nem üres listával visszalépve nem tölt', async () => {
    await loaded();
    await tab('Fizetések');
    expect(spinner()).toBe(1);
    expect(contentNodes().map((n) => n.tagName)).toEqual(['APP-LOCAL-SPINNER']);
    paymentsReq().flush([P1, P2]);
    await settle();
    expect(items()).toEqual([
      'diak@pelda.hu 4 990 Ft · pi_123 2026.09.05 14:30 „Kétszer terhelve" Felülvizsgálva',
      'masik@pelda.hu 12 000 Ft · pi_456 2026.09.06 08:05 Felülvizsgálva',
    ]);
    expect(el.querySelector('li span.font-mono')!.textContent).toBe('pi_123');

    await click(button('Felülvizsgálva', el.querySelectorAll('li')[0]));
    const req = http.expectOne(`${API}/payments/31/review-done`);
    expect(req.request.method).toBe('POST');
    expect([...el.querySelectorAll<HTMLButtonElement>('li button')].map((b) => b.disabled)).toEqual([true, true]);
    req.flush(null);
    await settle();
    expect(items().map((t) => t.slice(0, 14))).toEqual(['masik@pelda.hu']);
    expect(toast.toast()).toEqual({ state: 'success', message: 'Felülvizsgálat kész jelölve.' });

    await tab('Kérdés-jelentések');
    await tab('Fizetések');
    expect(items().length).toBe(1);

    await click(button('Felülvizsgálva'));
    fail(http.expectOne(`${API}/payments/32/review-done`));
    await settle();
    expect(toast.toast()).toEqual({ state: 'danger', message: 'Hiba történt.' });
    expect(items().length).toBe(1);
    noListReq();
  });

  it('fizetések: hiba, üres lista; üres listával visszalépve újratölt', async () => {
    await loaded();
    await tab('Fizetések');
    fail(paymentsReq());
    await settle();
    expect(errorText()).toBe('A fizetések betöltése sikertelen.');
    expect(items()).toEqual(['Nincs manuális felülvizsgálatot igénylő fizetés.']);

    await tab('Kérdés-jelentések');
    await tab('Fizetések');
    expect(errorText()).toBeNull();
    paymentsReq().flush([]);
    await settle();
    expect(items()).toEqual(['Nincs manuális felülvizsgálatot igénylő fizetés.']);

    await tab('Érdeklődések');
    inquiriesReq(true, 1).flush({ items: [], totalCount: 0 });
    await settle();
    await tab('Fizetések');
    paymentsReq().flush([P2]);
    await settle();
    expect(items().length).toBe(1);
  });

  it('a lista-gombok a műveletek után is újra aktívak egy másik fülön (a régi oldalon a „pending” jelző közös volt)', async () => {
    await paymentsLoaded([P1]);
    await click(button('Felülvizsgálva'));
    http.expectOne(`${API}/payments/31/review-done`).flush(null);
    await settle();
    await tab('Kérdés-jelentések');
    expect(buttonsIn(0)[0].disabled).toBe(false);
  });

  it('gyors lapozásnál az előző, még futó kérés lemondódik, így mindig a legutóbbi oldal látszik (WP-C6 után)', async () => {
    await loaded([R1, R2], 45);
    await click(pagerButtons()[1]);
    const stale = reportsReq(true, 2);
    await click(filterButtons()[1]);
    expect(stale.cancelled).toBe(true);
    reportsReq(false, 1).flush({ items: [R3], totalCount: 1 });
    await settle();
    expect(items().length).toBe(1);
    expect(pager()).toBeNull();
  });
});
