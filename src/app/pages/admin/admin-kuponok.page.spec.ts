import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminKuponokComponent } from './admin-kuponok.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { CouponAdminDto, SubscriptionTypeOption } from '../../models/coupon.model';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin/coupons';

const C1: CouponAdminDto = {
  id: 1, code: 'ISKOLA2026', percentOff: 20, amountOffHuf: null, validFrom: '2026-09-01T00:00:00', validTo: null, maxRedemptions: 5,
  redemptionCount: 2, subscriptionTypeId: null, subscriptionTypeName: null, isActive: true, createdAt: '2026-09-01T00:00:00', note: 'Szülői est',
};
const C2: CouponAdminDto = {
  id: 2, code: 'REGI', percentOff: null, amountOffHuf: 1500, validFrom: '2026-01-01T00:00:00', validTo: '2026-02-01T00:00:00',
  maxRedemptions: null, redemptionCount: 0, subscriptionTypeId: 2, subscriptionTypeName: 'Standard', isActive: false,
  createdAt: '2026-01-01T00:00:00', note: null,
};
const TYPES: SubscriptionTypeOption[] = [
  { id: 1, name: 'Ingyenes', price: 0, billingCycle: 'monthly' },
  { id: 2, name: 'Standard', price: 2990, billingCycle: 'monthly' },
  { id: 3, name: 'Prémium', price: 29900, billingCycle: 'yearly' },
];

const CHIP_BASE = ['border', 'font-semibold', 'px-3', 'py-1.5', 'rounded-lg', 'transition-colors'];
const CHIP_ACTIVE = [...CHIP_BASE, 'bg-primary', 'border-primary', 'text-white'].sort();
const CHIP_INACTIVE = [...CHIP_BASE, 'border-border-default', 'text-text-muted'].sort();

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Kuponok oldal a valódi service-szel +
 * HttpTestingController, csak DOM-on keresztül (betöltés, szűrő, létrehozó űrlap, inaktiválás, hibák).
 */
describe('AdminKuponokComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminKuponokComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let toastSuccess: ReturnType<typeof vi.spyOn>;
  let toastDanger: ReturnType<typeof vi.spyOn>;
  let ask: ReturnType<typeof vi.spyOn>;

  const text = (root: Element = el) => root.textContent!.replace(/\s+/g, ' ').trim();
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const sorted = (e: Element) => [...e.classList].sort();
  const form = () => el.querySelector('form')!;
  const input = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`);
  const select = () => el.querySelector<HTMLSelectElement>('#subscriptionTypeId')!;
  const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const submit = () => button('Kupon létrehozása');
  const items = () => [...el.querySelectorAll('ul > li')].map((li) => text(li));
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const fail = (r: TestRequest, body: object | null = null) => r.flush(body, { status: 400, statusText: 'Bad Request' });
  async function type(id: string, value: string) {
    const i = input(id)!;
    i.value = value;
    i.dispatchEvent(new Event('input'));
    await settle();
  }
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }

  async function loaded(list: CouponAdminDto[] = [C1, C2], types: SubscriptionTypeOption[] = TYPES) {
    await settle();
    http.expectOne(API).flush(list);
    http.expectOne(`${API}/subscription-types`).flush(types);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminKuponokComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    toastSuccess = vi.spyOn(toast, 'success');
    toastDanger = vi.spyOn(toast, 'danger');
    ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminKuponokComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: spinner, a két kérés, utána csak az aktív kupon; a csomag-lista az ingyenes nélkül', async () => {
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('ul')).toBeNull();
    http.expectOne(API).flush([C1, C2]);
    http.expectOne(`${API}/subscription-types`).flush(TYPES);
    await settle();

    expect(spinner()).toBe(0);
    expect(items()).toEqual([
      'ISKOLA2026 aktív 20% kedvezmény · bármelyik fizetős csomag · beváltva: 2 / 5 2026.09.01 – nincs lejárat · Szülői est Inaktiválás',
    ]);
    expect([...select().options].map((o) => o.textContent!.trim())).toEqual([
      'Bármelyik fizetős csomag', 'Standard (havi, 2990 Ft)', 'Prémium (éves, 29\u00a0900 Ft)',
    ]);
    expect(sorted(button('Csak aktívak'))).toEqual(CHIP_ACTIVE);
    expect(sorted(button('Összes'))).toEqual(CHIP_INACTIVE);
    expect(submit().disabled).toBe(true);
  });

  it('az „Összes” szűrő az inaktívakat is mutatja, kérés nélkül; üres listánál a szűrő szerinti szöveg', async () => {
    await loaded();
    await click(button('Összes'));
    expect(sorted(button('Összes'))).toEqual(CHIP_ACTIVE);
    expect(items()).toEqual([
      'ISKOLA2026 aktív 20% kedvezmény · bármelyik fizetős csomag · beváltva: 2 / 5 2026.09.01 – nincs lejárat · Szülői est Inaktiválás',
      'REGI inaktív 1500 Ft kedvezmény · Standard · beváltva: 0 2026.01.01 – 2026.02.01',
    ]);
    await click(button('Csak aktívak'));
    expect(items().length).toBe(1);
  });

  it('betöltési hiba: üzenet és üres lista; a csomag-lista hibájánál csak a „bármelyik” opció marad', async () => {
    await settle();
    fail(http.expectOne(API));
    fail(http.expectOne(`${API}/subscription-types`));
    await settle();
    expect(el.querySelector('p.text-danger')!.textContent!.trim()).toBe('A kuponok betöltése sikertelen.');
    expect(items()).toEqual(['Nincs aktív kupon.']);
    expect([...select().options].map((o) => o.textContent!.trim())).toEqual(['Bármelyik fizetős csomag']);
    await click(button('Összes'));
    expect(items()).toEqual(['Még nincs egyetlen kupon sem.']);
  });

  it('létrehozás százalékkal: a gomb csak kóddal és kedvezménnyel engedett; a kérés pontos; közben minden gomb tiltva; utána lista elejére, üres űrlap', async () => {
    await loaded();
    await type('code', ' uj2026 ');
    expect(submit().disabled).toBe(true);
    await type('percentOff', '25');
    expect(submit().disabled).toBe(false);
    await type('validFrom', '2026-10-01');
    await type('validTo', '2026-12-31');
    await type('maxRedemptions', '10');
    select().value = select().options[2].value;
    select().dispatchEvent(new Event('change'));
    await type('note', ' Őszi kampány ');

    await click(submit());
    const req = http.expectOne((r) => r.method === 'POST' && r.url === API);
    expect(req.request.body).toEqual({
      code: 'uj2026', percentOff: 25, amountOffHuf: null,
      validFrom: new Date('2026-10-01T00:00:00').toISOString(), validTo: new Date('2026-12-31T23:59:59').toISOString(),
      maxRedemptions: 10, subscriptionTypeId: 3, note: 'Őszi kampány',
    });
    expect(submit().disabled).toBe(true);
    expect(button('Inaktiválás').disabled).toBe(true);

    req.flush({ ...C1, id: 9, code: 'UJ2026', percentOff: 25, note: 'Őszi kampány' });
    await settle();
    expect(items()[0]).toContain('UJ2026 aktív 25% kedvezmény');
    expect(items().length).toBe(2);
    expect(toastSuccess).toHaveBeenCalledWith('Kupon létrehozva: UJ2026');
    expect(input('code')!.value).toBe('');
    expect(input('percentOff')!.value).toBe('');
    expect(input('validFrom')!.value).toBe('');
    expect(input('validTo')!.value).toBe('');
    expect(input('maxRedemptions')!.value).toBe('');
    expect(input('note')!.value).toBe('');
    expect(select().selectedIndex).toBe(0);
    expect(submit().disabled).toBe(true);
    expect(button('Inaktiválás').disabled).toBe(false);
  });

  it('típusváltás: a fix összeg mezője jelenik meg, a százalék törlődik; visszaváltva az összeg törlődik; a kérésben csak a választott', async () => {
    await loaded();
    await type('code', 'FIX');
    await type('percentOff', '30');
    await click(button('Fix összeg (Ft)'));
    expect(input('percentOff')).toBeNull();
    expect(input('amountOffHuf')!.value).toBe('');
    expect(sorted(button('Fix összeg (Ft)'))).toEqual(CHIP_ACTIVE);
    expect(sorted(button('Százalék'))).toEqual(CHIP_INACTIVE);
    expect(submit().disabled).toBe(true);
    await type('amountOffHuf', '1000');
    await click(button('Százalék'));
    expect(input('percentOff')!.value).toBe('');
    expect(submit().disabled).toBe(true);
    await click(button('Fix összeg (Ft)'));
    expect(input('amountOffHuf')!.value).toBe('');
    await type('amountOffHuf', '1000');

    form().dispatchEvent(new Event('submit'));
    await settle();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === API);
    expect(req.request.body).toEqual({
      code: 'FIX', percentOff: null, amountOffHuf: 1000, validFrom: null, validTo: null, maxRedemptions: null, subscriptionTypeId: null, note: null,
    });
    req.flush({ ...C1, id: 10, code: 'FIX', percentOff: null, amountOffHuf: 1000 });
    await settle();
    // A típus a mentés után is a választott marad (csak a mezők ürülnek).
    expect(input('amountOffHuf')!.value).toBe('');
    expect(sorted(button('Fix összeg (Ft)'))).toEqual(CHIP_ACTIVE);
  });

  it('a csak szóközből álló kód nem küldhető; a 0 kedvezmény sem', async () => {
    await loaded();
    await type('code', '   ');
    await type('percentOff', '10');
    expect(submit().disabled).toBe(true);
    form().dispatchEvent(new Event('submit'));
    await settle();
    await type('code', 'A');
    await type('percentOff', '0');
    expect(submit().disabled).toBe(true);
    form().dispatchEvent(new Event('submit'));
    await settle();
    http.expectNone((r) => r.method === 'POST');
  });

  it('létrehozási hiba: a szerver üzenete az űrlap alatt, az űrlap megmarad; a következő küldés törli', async () => {
    await loaded();
    await type('code', 'DUPLA');
    await type('percentOff', '10');
    await click(submit());
    fail(http.expectOne((r) => r.method === 'POST'), { errorMessage: 'Ilyen kód már létezik.' });
    await settle();
    expect(el.querySelector('[role="alert"]')!.textContent!.trim()).toBe('Ilyen kód már létezik.');
    expect(input('code')!.value).toBe('DUPLA');
    expect(submit().disabled).toBe(false);

    await click(submit());
    expect(el.querySelector('[role="alert"]')).toBeNull();
    fail(http.expectOne((r) => r.method === 'POST'));
    await settle();
    expect(el.querySelector('[role="alert"]')!.textContent!.trim()).toBe('A kupon létrehozása sikertelen.');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('inaktiválás: megerősítés, kérés, közben a küldés tiltva; a sor kikerül az aktívak közül; elutasított megerősítésnél nincs kérés', async () => {
    await loaded();
    ask.mockResolvedValueOnce(false);
    await click(button('Inaktiválás'));
    expect(ask).toHaveBeenCalledWith({
      message: 'Inaktiválod a(z) ISKOLA2026 kupont? Ezután nem váltható be többé - '
        + 'a korábbi beváltások és az általuk aktivált előfizetések változatlanok maradnak.',
      danger: true,
      confirmLabel: 'Inaktiválás',
    });
    http.expectNone(`${API}/1/deactivate`);

    await type('code', 'X');
    await type('percentOff', '5');
    await click(button('Inaktiválás'));
    const req = http.expectOne(`${API}/1/deactivate`);
    expect(req.request.method).toBe('POST');
    expect(submit().disabled).toBe(true);
    expect(button('Inaktiválás').disabled).toBe(true);
    req.flush({ ...C1, isActive: false });
    await settle();
    expect(items()).toEqual(['Nincs aktív kupon.']);
    expect(toastSuccess).toHaveBeenCalledWith('Kupon inaktiválva.');
    expect(submit().disabled).toBe(false);
    await click(button('Összes'));
    expect(items()[0]).toContain('ISKOLA2026 inaktív');
  });

  it('inaktiválási hiba: toast a szerver üzenetével, a sor marad', async () => {
    await loaded();
    await click(button('Inaktiválás'));
    fail(http.expectOne(`${API}/1/deactivate`), { errorMessage: 'Nem található.' });
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Nem található.');
    expect(items()[0]).toContain('ISKOLA2026 aktív');
    expect(button('Inaktiválás').disabled).toBe(false);
  });

  it('jelvények: elfogyott és lejárt', async () => {
    await loaded([
      { ...C1, id: 5, code: 'ELFOGYOTT', maxRedemptions: 1, redemptionCount: 1 },
      { ...C1, id: 6, code: 'LEJART', validTo: '2020-01-01T00:00:00' },
    ]);
    expect(items().map((t) => t.split(' ').slice(0, 2).join(' '))).toEqual(['ELFOGYOTT elfogyott', 'LEJART lejárt']);
  });
});
