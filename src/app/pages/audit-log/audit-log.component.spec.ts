import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditLogComponent } from './audit-log.component';
import { AdminAuditLogEntry, AdminAuditLogPage } from '../../services/audit-log/audit-log.service';
import { environment } from '../../../environments/environment';

const URL_ = `${environment.apiUrl}/audit-log`;
const TYPES_URL = `${environment.apiUrl}/audit-log/target-types`;

const entry = (id: number, overrides: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry => ({
  id, atUtc: '2026-10-01T09:00:00', actorUserId: '42', actorIp: '10.0.0.1', action: 'users.unlock', targetType: 'User',
  targetId: '89', details: 'részletek', success: true, ...overrides,
});
const page = (items: AdminAuditLogEntry[], totalCount = items.length): AdminAuditLogPage => ({ items, totalCount, page: 1, pageSize: 50 });

/** Karakterizáció (WP-A2): az audit-napló mostani viselkedése (valódi AuditLogService + HttpTestingController). */
describe('AuditLogComponent', () => {
  let fixture: ComponentFixture<AuditLogComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const expectPage = (): TestRequest => http.expectOne((r) => r.url === URL_);
  const params = (req: TestRequest) =>
    Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));
  /** A flush utáni aszinkron lánc (resource → signal, illetve await) lefutása, utána render. */
  async function settle() {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  function setValue(selector: string, value: string) {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }
  /** Felhasználói esemény, utána render (a lista-kérést a resource a változásészlelésben indítja, mint az appban). */
  function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }
  function click(button: HTMLButtonElement) {
    button.click();
    fixture.detectChanges();
  }
  const pagerButtons = () => el.querySelectorAll<HTMLButtonElement>('.pager button');

  /** Az init: előbb a TargetType-lista, csak utána az 1. oldal. */
  async function init(items: AdminAuditLogEntry[] = [], totalCount = items.length) {
    http.expectNone((r) => r.url === URL_);
    http.expectOne(TYPES_URL).flush(['User', 'GiftCoupon']);
    await settle();
    expectPage().flush(page(items, totalCount));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLogComponent);
    el = fixture.nativeElement;
    // Nincs whenStable(): a függő lista-kérés (resource) a teszt végéig nyitva tartja az app stabilitását.
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('betöltéskor előbb a TargetType-okat kéri, aztán az 1. oldalt szűrő nélkül; a TargetType-ok a választóba kerülnek', async () => {
    http.expectNone((r) => r.url === URL_);
    http.expectOne(TYPES_URL).flush(['User', 'GiftCoupon']);
    await settle();
    const req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50' });
    req.flush(page([]));
    await settle();

    const options = Array.from(el.querySelectorAll<HTMLOptionElement>('select[name="targetType"] option')).map((o) => [o.value, o.textContent?.trim()]);
    expect(options).toEqual([['', 'Minden TargetType'], ['User', 'User'], ['GiftCoupon', 'GiftCoupon']]);
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nincs találat.');
  });

  it('a sorokat a mostani formában mutatja; a sikertelen sor „failed” jelölést kap', async () => {
    await init([entry(1), entry(2, { success: false, actorUserId: null, actorIp: null, targetId: null, details: null })]);

    const rows = el.querySelectorAll('tbody tr');
    const cells = (i: number) => Array.from(rows[i].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(cells(0)).toEqual(['2026-10-01T09:00:00', '42', '10.0.0.1', 'users.unlock', 'User#89', 'OK', 'részletek']);
    expect(cells(1)).toEqual(['2026-10-01T09:00:00', '-', '-', 'users.unlock', 'User', 'HIBA', '']);
    expect(rows[0].classList).not.toContain('failed');
    expect(rows[1].classList).toContain('failed');
  });

  it('a szűrő csak a Szűrés gombra fut; a helyi dátum UTC ISO-ként, az eredmény logikai paraméterként megy', async () => {
    await init();

    setValue('input[name="actorUserId"]', '42');
    setValue('input[name="action"]', 'unlock');
    setValue('select[name="targetType"]', 'User');
    setValue('select[name="successFilter"]', 'false');
    setValue('input[name="fromDate"]', '2026-10-01T10:00');
    setValue('input[name="toDate"]', '2026-10-02T18:30');
    await settle();
    http.expectNone((r) => r.url === URL_);

    submit();
    let req = expectPage();
    expect(params(req)).toEqual({
      page: '1', pageSize: '50', actorUserId: '42', action: 'unlock', targetType: 'User', success: 'false',
      fromUtc: new Date('2026-10-01T10:00').toISOString(), toUtc: new Date('2026-10-02T18:30').toISOString(),
    });
    req.flush(page([]));
    await settle();

    setValue('select[name="successFilter"]', 'all');
    setValue('input[name="fromDate"]', '');
    setValue('input[name="toDate"]', '');
    submit();
    req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50', actorUserId: '42', action: 'unlock', targetType: 'User' });
  });

  it('lapozás: összes / 50 oldal, határokon tiltott gomb, a Szűrés az 1. oldalra ugrik', async () => {
    await init([entry(1)], 100);
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 2');
    expect(pagerButtons()[0].disabled).toBe(true);

    click(pagerButtons()[1]);
    const req = expectPage();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page([entry(2)], 100));
    await settle();
    expect(pagerButtons()[1].disabled).toBe(true);

    submit();
    expect(expectPage().request.params.get('page')).toBe('1');
  });

  it('hibánál a betöltés-jelző leáll, a korábbi sorok maradnak, nincs hibaüzenet', async () => {
    await init([entry(1)], 1);

    submit();
    expectPage().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(el.querySelector('[role="alert"], .error')).toBeNull();

    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });
});
