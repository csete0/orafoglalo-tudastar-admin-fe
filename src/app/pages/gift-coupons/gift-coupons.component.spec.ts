import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { GiftCouponsComponent } from './gift-coupons.component';
import { GiftCouponListItem, GiftCouponPage } from '../../services/gift-coupons/gift-coupon.service';
import { environment } from '../../../environments/environment';

const URL_ = `${environment.apiUrl}/gift-coupons`;

const coupon = (id: number, overrides: Partial<GiftCouponListItem> = {}): GiftCouponListItem => ({
  id, code: `GIFT-${id}`, subscriptionTypeName: 'Éves', purchaserEmail: 'szulo@example.com', childEmail: 'gyerek@example.com',
  isRedeemed: false, redeemedAt: null, isActive: true, validFrom: '2026-10-01T00:00:00', validTo: null, createdAt: '2026-10-01T09:00:00',
  ...overrides,
});
const page = (items: GiftCouponListItem[], totalCount = items.length): GiftCouponPage => ({ items, totalCount, page: 1, pageSize: 50 });

/** Karakterizáció (WP-A2): az ajándékkód-kezelő mostani viselkedése (valódi GiftCouponService + HttpTestingController). */
describe('GiftCouponsComponent', () => {
  let fixture: ComponentFixture<GiftCouponsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const expectPage = (): TestRequest => http.expectOne((r) => r.url === URL_ && r.method === 'GET');
  const params = (req: TestRequest) =>
    Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));
  /** A flush utáni Promise-lánc (firstValueFrom → await → signal) lefutása, utána render. */
  async function settle() {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  function setValue(selector: string, value: string) {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }
  const submit = () => el.querySelector('form')!.dispatchEvent(new Event('submit'));
  const pagerButtons = () => el.querySelectorAll<HTMLButtonElement>('.pager button');
  const rowButtons = (i: number) => el.querySelectorAll('tbody tr')[i].querySelectorAll<HTMLButtonElement>('.actions button');
  const rowMessage = (i: number) => el.querySelectorAll('tbody tr')[i].querySelector('.row-message')?.textContent?.trim() ?? null;

  async function init(items: GiftCouponListItem[], totalCount = items.length) {
    expectPage().flush(page(items, totalCount));
    await settle();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GiftCouponsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GiftCouponsComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('betöltéskor szűrő nélkül az 1. oldalt kéri, közben „Betöltés...”', async () => {
    const req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50' });
    fixture.detectChanges();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Betöltés...');
    req.flush(page([]));
    await settle();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nincs találat.');
  });

  it('a sorokat a mostani formában mutatja; az érvénytelenített sor „inactive”', async () => {
    await init([
      coupon(1, { isRedeemed: true, redeemedAt: '2026-10-05T12:00:00' }),
      coupon(2, { subscriptionTypeName: null, purchaserEmail: null, childEmail: null, isActive: false }),
    ]);

    const rows = el.querySelectorAll('tbody tr');
    const cells = (i: number) => Array.from(rows[i].querySelectorAll('td')).slice(0, 7).map((td) => td.textContent?.trim());
    expect(cells(0)).toEqual(['GIFT-1', 'Éves', 'szulo@example.com', 'gyerek@example.com', 'Igen, 2026-10-05T12:00:00', 'Aktív', '2026-10-01T09:00:00']);
    expect(cells(1)).toEqual(['GIFT-2', '-', '(nincs adat - régi kupon)', '-', 'Nem', 'Érvénytelenítve', '2026-10-01T09:00:00']);
    expect(rows[0].classList).not.toContain('inactive');
    expect(rows[1].classList).toContain('inactive');
    // E-mail nélkül nincs mit újraküldeni, az érvénytelenítettet nem lehet újra érvényteleníteni.
    expect(Array.from(rowButtons(0)).map((b) => b.disabled)).toEqual([false, false]);
    expect(Array.from(rowButtons(1)).map((b) => b.disabled)).toEqual([true, true]);
  });

  it('a szűrő csak a Szűrés gombra fut; a „mindegy” nem kerül a kérésbe', async () => {
    await init([]);

    setValue('input[name="code"]', 'GIFT');
    setValue('input[name="email"]', 'szulo@');
    setValue('select[name="redeemedFilter"]', 'false');
    setValue('select[name="activeFilter"]', 'true');
    await settle();
    http.expectNone((r) => r.url === URL_);

    submit();
    let req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50', code: 'GIFT', email: 'szulo@', redeemed: 'false', active: 'true' });
    req.flush(page([]));
    await settle();

    setValue('select[name="redeemedFilter"]', 'all');
    setValue('select[name="activeFilter"]', 'false');
    setValue('input[name="code"]', '');
    submit();
    req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50', email: 'szulo@', active: 'false' });
  });

  it('lapozás: összes / 50 oldal, a Szűrés az 1. oldalra ugrik', async () => {
    await init([coupon(1)], 150);
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 3');
    expect(pagerButtons()[0].disabled).toBe(true);

    pagerButtons()[1].click();
    const req = expectPage();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page([coupon(51)], 150));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('2 / 3');

    submit();
    expect(expectPage().request.params.get('page')).toBe('1');
  });

  it('újraküldés: mindkét címre kéri, a sor alatt jelzi, kinek ment el; közben a sor gombjai tiltottak', async () => {
    await init([coupon(1), coupon(2)]);

    rowButtons(0)[0].click();
    fixture.detectChanges();
    const req = http.expectOne(`${URL_}/1/resend`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ toPurchaser: true, toChild: true });
    expect(Array.from(rowButtons(0)).map((b) => b.disabled)).toEqual([true, true]);
    expect(Array.from(rowButtons(1)).map((b) => b.disabled)).toEqual([false, false]);

    req.flush({ sentToPurchaser: true, sentToChild: true });
    await settle();
    expect(rowMessage(0)).toBe('vevőnek elküldve, gyermeknek elküldve');
    expect(rowMessage(1)).toBeNull();
    expect(Array.from(rowButtons(0)).map((b) => b.disabled)).toEqual([false, false]);
    // Újraküldés után nincs újratöltés.
    http.expectNone((r) => r.url === URL_);
  });

  it('újraküldés: csak a vevőnek / senkinek / hiba esetén a megfelelő sor-üzenet', async () => {
    await init([coupon(1)]);

    rowButtons(0)[0].click();
    http.expectOne(`${URL_}/1/resend`).flush({ sentToPurchaser: true, sentToChild: false });
    await settle();
    expect(rowMessage(0)).toBe('vevőnek elküldve');

    rowButtons(0)[0].click();
    http.expectOne(`${URL_}/1/resend`).flush({ sentToPurchaser: false, sentToChild: false });
    await settle();
    expect(rowMessage(0)).toBe('Nem sikerült elküldeni.');

    rowButtons(0)[0].click();
    http.expectOne(`${URL_}/1/resend`).flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(rowMessage(0)).toBe('Hiba történt az újraküldés közben.');
    expect(rowButtons(0)[0].disabled).toBe(false);
  });

  it('érvénytelenítés: a böngésző confirm()-ja kérdez; mégse esetén nincs kérés', async () => {
    await init([coupon(1)]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    rowButtons(0)[1].click();
    await settle();

    expect(confirmSpy).toHaveBeenCalledWith('Biztosan érvényteleníted a(z) GIFT-1 ajándékkódot?');
    http.expectNone(`${URL_}/1/deactivate`);
  });

  it('érvénytelenítés: megerősítés után POST, majd a lista újratöltése a mostani szűrővel és oldallal', async () => {
    await init([coupon(1)], 120);
    pagerButtons()[1].click();
    expectPage().flush(page([coupon(1)], 120));
    await settle();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    rowButtons(0)[1].click();
    fixture.detectChanges();
    const req = http.expectOne(`${URL_}/1/deactivate`);
    expect(req.request.method).toBe('POST');
    expect(Array.from(rowButtons(0)).map((b) => b.disabled)).toEqual([true, true]);
    req.flush(null);
    await settle();

    const reload = expectPage();
    expect(params(reload)).toEqual({ page: '2', pageSize: '50' });
    reload.flush(page([coupon(1, { isActive: false })], 120));
    await settle();
    expect(el.querySelector('tbody tr')!.classList).toContain('inactive');
  });

  it('érvénytelenítés hibájánál sor-üzenet, nincs újratöltés', async () => {
    await init([coupon(1)]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    rowButtons(0)[1].click();
    http.expectOne(`${URL_}/1/deactivate`).flush(null, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(rowMessage(0)).toBe('Hiba történt az érvénytelenítés közben.');
    http.expectNone((r) => r.url === URL_);
  });

  it('a lista betöltési hibájánál a betöltés-jelző leáll, a korábbi sorok maradnak, a hiba továbbmegy', async () => {
    await init([coupon(1)]);

    const done = fixture.componentInstance.search();
    expectPage().flush(null, { status: 500, statusText: 'Server Error' });
    await expect(done).rejects.toMatchObject({ status: 500 });
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });
});
