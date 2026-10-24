import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PaymentsComponent } from './payments.component';
import { AdminPaymentListItem, AdminPaymentPage } from '../../services/payments/payment.service';
import { environment } from '../../../environments/environment';

const URL_ = `${environment.apiUrl}/payments`;

const payment = (id: number, overrides: Partial<AdminPaymentListItem> = {}): AdminPaymentListItem => ({
  id, userId: 10 + id, userEmail: `v${id}@example.com`, amount: 4990, paymentDate: '2026-10-01T09:00:00', status: 'Succeeded',
  paymentMethod: 'card', refunded: false, needsManualReview: false, stripePaymentIntentUrl: null, stripeCustomerUrl: null, ...overrides,
});
const page = (items: AdminPaymentListItem[], totalCount = items.length): AdminPaymentPage => ({ items, totalCount, page: 1, pageSize: 50 });

/** Karakterizáció (WP-A2): a fizetés-lista mostani viselkedése (valódi PaymentService + HttpTestingController). */
describe('PaymentsComponent', () => {
  let fixture: ComponentFixture<PaymentsComponent>;
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentsComponent);
    el = fixture.nativeElement;
    // Nincs whenStable(): a függő lista-kérés (resource) a teszt végéig nyitva tartja az app stabilitását.
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('betöltéskor szűrő nélkül az 1. oldalt kéri, közben „Betöltés...”, üresen „Nincs találat.”', async () => {
    const req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50' });
    fixture.detectChanges();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Betöltés...');
    req.flush(page([]));
    await settle();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nincs találat.');
  });

  it('a sorokat, jelöléseket és Stripe-linkeket a mostani formában mutatja', async () => {
    expectPage().flush(page([
      payment(1, { refunded: true, needsManualReview: true, stripePaymentIntentUrl: 'https://s/pi', stripeCustomerUrl: 'https://s/cus' }),
      payment(2, { userEmail: null, paymentMethod: null }),
    ]));
    await settle();

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].classList).toContain('flagged');
    expect(rows[1].classList).not.toContain('flagged');
    const cells = (i: number) => Array.from(rows[i].querySelectorAll('td')).slice(0, 5).map((td) => td.textContent?.trim());
    expect(cells(0)).toEqual(['2026-10-01T09:00:00', 'v1@example.com', '4990 Ft', 'Succeeded', 'card']);
    expect(cells(1)).toEqual(['2026-10-01T09:00:00', '-', '4990 Ft', 'Succeeded', '-']);
    expect(rows[0].querySelector('td a')!.getAttribute('href')).toBe('/users/11');
    const tags = (i: number) => Array.from(rows[i].querySelectorAll('.tag')).map((t) => [t.textContent?.trim(), t.classList.contains('warn')]);
    expect(tags(0)).toEqual([['visszatérítve', false], ['felülvizsgálandó', true]]);
    expect(tags(1)).toEqual([]);
    const stripe = (i: number) => Array.from(rows[i].querySelectorAll<HTMLAnchorElement>('td:last-child a'))
      .map((a) => [a.textContent?.trim(), a.getAttribute('href'), a.target, a.rel]);
    expect(stripe(0)).toEqual([
      ['fizetés', 'https://s/pi', '_blank', 'noopener'],
      ['vevő', 'https://s/cus', '_blank', 'noopener'],
    ]);
    expect(stripe(1)).toEqual([]);
  });

  it('a szűrő csak a Szűrés gombra fut; a „mindegy” nem kerül a kérésbe, az igen/nem logikai paraméter', async () => {
    expectPage().flush(page([]));
    await settle();

    setValue('input[name="query"]', 'pi_123');
    setValue('select[name="status"]', 'Failed');
    setValue('select[name="refundedFilter"]', 'true');
    setValue('select[name="reviewFilter"]', 'false');
    await settle();
    http.expectNone((r) => r.url === URL_);

    submit();
    let req = expectPage();
    expect(params(req)).toEqual({
      page: '1', pageSize: '50', query: 'pi_123', status: 'Failed', refunded: 'true', needsManualReview: 'false',
    });
    req.flush(page([]));
    await settle();

    setValue('select[name="refundedFilter"]', 'all');
    setValue('select[name="reviewFilter"]', 'true');
    setValue('select[name="status"]', '');
    submit();
    req = expectPage();
    expect(params(req)).toEqual({ page: '1', pageSize: '50', query: 'pi_123', needsManualReview: 'true' });
  });

  it('lapozás: összes / 50 oldal, a Szűrés az 1. oldalra ugrik', async () => {
    expectPage().flush(page([payment(1)], 51));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 2');
    expect(pagerButtons()[0].disabled).toBe(true);

    click(pagerButtons()[1]);
    const req = expectPage();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page([payment(51)], 51));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('2 / 2');
    expect(pagerButtons()[1].disabled).toBe(true);

    submit();
    expect(expectPage().request.params.get('page')).toBe('1');
  });

  it('hibánál a betöltés-jelző leáll, a korábbi sorok maradnak, nincs hibaüzenet', async () => {
    expectPage().flush(page([payment(1)], 1));
    await settle();

    submit();
    expectPage().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(el.querySelector('[role="alert"], .error')).toBeNull();

    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('.empty')).toBeNull();
  });
});
