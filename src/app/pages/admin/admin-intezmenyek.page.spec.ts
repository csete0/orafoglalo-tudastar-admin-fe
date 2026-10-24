import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminIntezmenyekComponent } from './admin-intezmenyek.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { SchoolAdminDto } from '../../models/teacher-moderation.model';
import {
  InstitutionalLicenseDto,
  InstitutionalLicenseUsageDto,
  InstitutionalSeatHolderDto,
} from '../../models/institutional-license.model';

const school = (o: Partial<SchoolAdminDto>): SchoolAdminDto => ({
  id: 1,
  name: 'Suli',
  createdAt: '2026-09-01T10:00:00',
  teacherCount: 0,
  groupCount: 0,
  adminDisplayNames: [],
  createdByName: null,
  createdByEmail: null,
  hasLicense: false,
  publicApprovedAt: null,
  publicApprovedByEmail: null,
  mockExamRegistrationCount: 0,
  ...o,
});

const license = (o: Partial<InstitutionalLicenseDto>): InstitutionalLicenseDto => ({
  id: 10,
  schoolId: 1,
  teacherProfileId: null,
  ownerName: 'Alfa Gimnázium',
  tier: 'premium',
  capacity: 30,
  usedSeats: 12,
  heldSeats: 14,
  validFrom: '2026-08-25',
  validTo: '2027-08-25',
  idleWindowMinutes: 20,
  revokedAt: null,
  billingNote: null,
  createdAt: '2026-08-25T00:00:00Z',
  isActive: true,
  skippedDueToActiveSessionCount: 0,
  ...o,
});

const schools: SchoolAdminDto[] = [
  school({
    id: 1, name: 'Alfa Gimnázium', city: 'Budapest', teacherCount: 4, groupCount: 6,
    adminDisplayNames: ['Igaz Gató', 'Más Valaki'], createdByName: 'Teszt Tanár', createdByEmail: 't@example.com',
    hasLicense: true, mockExamRegistrationCount: 7,
  }),
  school({ id: 2, name: 'Alfa Gimnázium', city: 'Szeged', teacherCount: 1, groupCount: 1, createdByEmail: 'csak@example.com', mockExamRegistrationCount: 3 }),
  school({ id: 3, name: 'Béta Suli', publicApprovedAt: '2026-10-10T10:00:00', publicApprovedByEmail: 'admin@example.com' }),
];

const licenses: InstitutionalLicenseDto[] = [
  license({ id: 10, schoolId: 1, billingNote: 'Fenntartó Kft.', rowVersion: 'rv10' }),
  license({ id: 11, schoolId: 1, tier: 'standard', capacity: 5, usedSeats: 5, heldSeats: 5, idleWindowMinutes: 15 }),
  license({ id: 12, schoolId: 1, capacity: 8, usedSeats: 0, heldSeats: 0, revokedAt: '2026-09-01T00:00:00Z', isActive: false }),
  license({ id: 13, schoolId: 1, capacity: 9, usedSeats: 0, heldSeats: 0, isActive: false }),
  license({ id: 20, schoolId: 3, ownerName: 'Béta Suli', capacity: 10, usedSeats: 2, heldSeats: 2, rowVersion: 'rv20' }),
];

const seats: InstitutionalSeatHolderDto[] = [
  { userId: 5, displayName: 'Kovács Anna', email: 'anna@example.com', seatIndex: 0, claimedAt: '2026-10-22T08:00:00',
    lastActivityAt: '2026-10-22T08:20:00', isFresh: true, sessionInProgress: false },
  { userId: 6, displayName: '', email: 'bela@example.com', seatIndex: 1, claimedAt: '2026-10-22T08:00:00',
    lastActivityAt: '2026-10-21T07:05:00', isFresh: false, sessionInProgress: true },
];

const usage: InstitutionalLicenseUsageDto = {
  licenseId: 10, capacity: 30, rangeDays: 30, totalDenied: 4, totalReclaimed: 2, peakSeatsInUse: 30, daysAtCapacity: 1,
  daily: [
    { day: '2026-10-01T00:00:00', peakSeatsInUse: 0, denied: 0, reclaimed: 0, atCapacity: false, capacityThatDay: 30 },
    { day: '2026-10-02T00:00:00', peakSeatsInUse: 30, denied: 4, reclaimed: 0, atCapacity: true, capacityThatDay: 30 },
    { day: '2026-10-03T00:00:00', peakSeatsInUse: 3, denied: 0, reclaimed: 2, atCapacity: false, capacityThatDay: 30 },
  ],
};

/**
 * Karakterizáció (a WP-C3 szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a teljes oldal a valódi
 * store-okkal + HttpTestingController, csak DOM-on keresztül (egyesítés, nyilvánosság, licenc-kártyák, helyek, kihasználtság,
 * szerkesztés, létrehozás, visszavonás és a UI-TT-206 hibairányítás).
 */
describe('AdminIntezmenyekComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminIntezmenyekComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let confirmAsk: ReturnType<typeof vi.fn>;
  let toastWarning: ReturnType<typeof vi.spyOn>;

  const text = (root: Element = el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  const req = (path: string, method = 'GET'): TestRequest =>
    http.expectOne((r) => r.url.endsWith(path) && r.method === method);
  async function settle() {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const schoolCards = () => [...el.querySelectorAll<HTMLElement>('li.card')];
  const schoolCard = (id: number) => {
    const c = el.querySelector(`[data-testid="public-approval-${id}"]`)?.closest<HTMLElement>('li.card');
    if (!c) throw new Error(`Nincs intézmény-kártya: ${id}`);
    return c;
  };
  /** A licenc-blokkok a kapacitásukkal azonosítva (a „/N hely használatban” szöveg egyedi). */
  const licenseBlock = (capacity: number) => {
    const b = [...el.querySelectorAll<HTMLElement>('div.text-xs.mb-2')].find((x) =>
      text(x).includes(`/${capacity} hely használatban`),
    );
    if (!b) throw new Error(`Nincs licenc-blokk: ${capacity}`);
    return b;
  };
  const buttonIn = (root: Element, label: string): HTMLButtonElement => {
    const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent?.trim() === label);
    if (!b) throw new Error(`Nincs gomb: ${label}`);
    return b;
  };
  async function clickIn(root: Element, label: string) {
    buttonIn(root, label).click();
    await settle();
  }
  const input = (name: string) => {
    const i = el.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
    if (!i) throw new Error(`Nincs mező: ${name}`);
    return i;
  };
  async function type(name: string, value: string) {
    const i = input(name);
    i.value = value;
    i.dispatchEvent(new Event(i instanceof HTMLSelectElement ? 'change' : 'input'));
    await settle();
  }
  async function choose(name: string, index: number) {
    const s = input(name) as HTMLSelectElement;
    s.selectedIndex = index;
    s.dispatchEvent(new Event('change'));
    await settle();
  }
  const globalErrors = () => [...el.querySelectorAll('p.text-danger.text-sm.mb-4')].map((p) => text(p));
  async function reloadAfterMutation(withSchools: boolean) {
    req('/licenses').flush(licenses);
    if (withSchools) req('/schools').flush(schools);
    await settle();
  }

  beforeEach(async () => {
    confirmAsk = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [AdminIntezmenyekComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask: confirmAsk } }],
    });
    http = TestBed.inject(HttpTestingController);
    toastWarning = vi.spyOn(TestBed.inject(ToastService), 'warning').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function loaded() {
    req('/schools').flush(schools);
    req('/licenses').flush(licenses);
    await settle();
  }

  // ── Betöltés, megjelenítés ───────────────────────────────────────

  it('betöltés alatt spinner, üres lista üzenet nélkül; betöltés után az intézmények és a licenc-sorok', async () => {
    expect(el.querySelector('app-local-spinner')).not.toBeNull();
    expect(text()).not.toContain('Nincs még intézmény.');
    await loaded();
    expect(el.querySelector('app-local-spinner')).toBeNull();
    expect(schoolCards().length).toBe(3);

    const created = new Date('2026-09-01T10:00:00Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdText = `${created.getFullYear()}.${pad(created.getMonth() + 1)}.${pad(created.getDate())}`;
    expect(text(schoolCard(1))).toBe(
      'Alfa Gimnázium Budapest Igazgató: Igaz Gató, Más Valaki 4 tanár · 6 csoport · létrehozva ' + createdText +
        ' · Teszt Tanár (t@example.com) Nyilvános (licenc alapján) · 7 próbaérettségi-jelentkezés ' +
        'Prémium · 12/30 hely használatban (2 tétlen, átadható) 2026.08.25 – 2027.08.25 Számlázás: Fenntartó Kft. ' +
        'Helyek megtekintése Kihasználtság Szerkesztés Visszavonás ' +
        'Standard · 5/5 hely használatban 2026.08.25 – 2027.08.25 Helyek megtekintése Kihasználtság Szerkesztés Visszavonás ' +
        'Prémium · 0/8 hely használatban 2026.08.25 – 2027.08.25 · visszavonva Helyek megtekintése Kihasználtság ' +
        'Prémium · 0/9 hely használatban 2026.08.25 – 2027.08.25 · nem aktív Helyek megtekintése Kihasználtság Szerkesztés Visszavonás ' +
        '+ Új licenc',
    );
    expect(text(schoolCard(2))).toBe(
      'Alfa Gimnázium Szeged 1 tanár · 1 csoport · létrehozva ' + createdText + ' · (csak@example.com) ' +
        'Nyilvános (próbaérettségi) jóváhagyásra vár · 3 próbaérettségi-jelentkezés ' +
        'Nincs licenc-keret ehhez az intézményhez. + Új licenc',
    );
    const approved = new Date('2026-10-10T10:00:00Z');
    expect(text(schoolCard(3))).toContain(
      `Nyilvános (próbaérettségi) jóváhagyva ${approved.getFullYear()}.${pad(approved.getMonth() + 1)}.${pad(approved.getDate())} , admin@example.com · 0 próbaérettségi-jelentkezés`,
    );
    expect(licenseBlock(5).querySelector('span.text-danger')?.textContent).toContain('5/5');
    expect(licenseBlock(30).querySelector('span.text-danger')).toBeNull();
    expect(globalErrors()).toEqual([]);
  });

  it('üres listánál „Nincs még intézmény.”; betöltési hibák a globális sávban', async () => {
    req('/schools').flush({ errorMessage: 'Iskola-hiba' }, { status: 500, statusText: 'x' });
    req('/licenses').flush({ errorMessage: 'Licenc-hiba' }, { status: 500, statusText: 'x' });
    await settle();
    expect(text()).toContain('Nincs még intézmény.');
    expect(globalErrors()).toEqual(['Iskola-hiba', 'Licenc-hiba']);
  });

  // ── Egyesítés ────────────────────────────────────────────────────

  it('egyesítés: címkék várossal és id-vel, gomb csak érvényes párnál, megerősítés, siker-panel, kiválasztás törlése', async () => {
    await loaded();
    const source = input('sourceId') as HTMLSelectElement;
    expect([...source.options].map((o) => o.textContent?.trim())).toEqual([
      'Válassz…', 'Alfa Gimnázium, Budapest (#1)', 'Alfa Gimnázium, Szeged (#2)', 'Béta Suli (#3)',
    ]);
    const mergeButton = buttonIn(el, 'Egyesítés');
    expect(mergeButton.disabled).toBe(true);
    await choose('sourceId', 2);
    expect(mergeButton.disabled).toBe(true);
    await choose('targetId', 2);
    expect(mergeButton.disabled).toBe(true);
    await choose('targetId', 1);
    expect(mergeButton.disabled).toBe(false);

    mergeButton.click();
    await settle();
    expect(confirmAsk).toHaveBeenCalledWith({
      message:
        'Biztosan egyesíted a(z) „Alfa Gimnázium, Szeged (#2)” intézményt a(z) „Alfa Gimnázium, Budapest (#1)” intézménybe? ' +
        'Minden tanára és csoportja átkerül, a(z) „Alfa Gimnázium, Szeged (#2)” törlődik. Ez nem vonható vissza.',
      danger: true,
      confirmLabel: 'Egyesítés',
    });
    const merge = req('/schools/merge', 'POST');
    expect(merge.request.body).toEqual({ sourceSchoolId: 2, targetSchoolId: 1 });
    expect((input('sourceId') as HTMLSelectElement).selectedIndex).toBe(0);
    expect((input('targetId') as HTMLSelectElement).selectedIndex).toBe(0);
    expect(mergeButton.disabled).toBe(true);
    merge.flush({ movedGroups: 2, movedMemberships: 5, mergedDuplicateMemberships: 1 });
    await settle();
    req('/schools').flush(schools);
    await settle();
    expect(text()).toContain('Egyesítés sikeres. 2 csoport, 5 tagság átkerült , 1 átfedő tagság összevonva .');
  });

  it('egyesítés elutasított megerősítésnél nem hív semmit és a kiválasztás megmarad; backend-hibánál a globális sávban', async () => {
    await loaded();
    await choose('sourceId', 1);
    await choose('targetId', 3);
    confirmAsk.mockResolvedValueOnce(false);
    await clickIn(el, 'Egyesítés');
    expect((input('sourceId') as HTMLSelectElement).selectedIndex).toBe(1);
    expect((input('targetId') as HTMLSelectElement).selectedIndex).toBe(3);

    await clickIn(el, 'Egyesítés');
    req('/schools/merge', 'POST').flush({ errorMessage: 'Már törölve.' }, { status: 400, statusText: 'x' });
    await settle();
    expect(globalErrors()).toEqual(['Már törölve.']);
    expect(text()).not.toContain('Egyesítés sikeres.');
  });

  // ── Próbaérettségi-nyilvánosság ──────────────────────────────────

  it('a „csak jóváhagyásra várók” szűrő a licenc nélküli, jóvá nem hagyott intézményeket mutatja', async () => {
    await loaded();
    expect(text()).toContain('Csak a próbaérettségi-jóváhagyásra várók (1)');
    const filter = el.querySelector<HTMLInputElement>('[data-testid="only-pending-public"]')!;
    filter.click();
    await settle();
    expect(schoolCards().map((c) => text(c).slice(0, 21))).toEqual(['Alfa Gimnázium Szeged']);
    filter.click();
    await settle();
    expect(schoolCards().length).toBe(3);
  });

  it('a szűrő ki-be kapcsolása után a nyitott szerkesztő és új-licenc űrlap a licenc adataival / alapértékekkel tér vissza', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 23, 12, 0));
    try {
      await loaded();
      await clickIn(licenseBlock(30), 'Szerkesztés');
      await clickIn(schoolCard(3), '+ Új licenc');
      const filter = el.querySelector<HTMLInputElement>('[data-testid="only-pending-public"]')!;
      filter.click();
      await settle();
      expect(el.querySelector('[name="edit-cap-10"]')).toBeNull();
      filter.click();
      await settle();

      expect(input('edit-cap-10').value).toBe('30');
      expect(input('edit-from-10').value).toBe('2026-08-25');
      expect(input('edit-to-10').value).toBe('2027-08-25');
      expect(input('edit-idle-10').value).toBe('20');
      expect(input('edit-note-10').value).toBe('Fenntartó Kft.');
      expect(input('tier-3').value).toBe('premium');
      expect(input('cap-3').value).toBe('30');
      expect(input('from-3').value).toBe('2026-10-23');
      expect(input('to-3').value).toBe('2027-10-23');
      expect(input('note-3').value).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a nyilvánosság-kapcsoló kattintásra nem vált; megerősítés után jóváhagy (POST) vagy visszavon (DELETE)', async () => {
    await loaded();
    const box2 = schoolCard(2).querySelector<HTMLInputElement>('[data-testid="public-approval-2"] input')!;
    confirmAsk.mockResolvedValueOnce(false);
    box2.click();
    await settle();
    expect(box2.checked).toBe(false);
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message:
        'Jóváhagyod a(z) „Alfa Gimnázium, Szeged (#2)” intézményt? Megjelenik a próbaérettségi nyilvános iskolakeresőjében és ' +
        'iskola-összesítőjében. Csak valódi, ellenőrzött iskolát hagyj jóvá.',
      danger: false,
      confirmLabel: 'Jóváhagyás',
    });

    box2.click();
    await settle();
    req('/schools/2/public-approval', 'POST').flush(null);
    await settle();
    req('/schools').flush(schools);
    await settle();

    const box3 = schoolCard(3).querySelector<HTMLInputElement>('[data-testid="public-approval-3"] input')!;
    expect(box3.checked).toBe(true);
    box3.click();
    await settle();
    expect(box3.checked).toBe(true);
    expect(confirmAsk).toHaveBeenLastCalledWith(expect.objectContaining({ danger: true, confirmLabel: 'Visszavonás' }));
    req('/schools/3/public-approval', 'DELETE').flush({ errorMessage: 'Nem sikerült.' }, { status: 400, statusText: 'x' });
    await settle();
    expect(globalErrors()).toEqual(['Nem sikerült.']);
  });

  // ── Helyek ───────────────────────────────────────────────────────

  it('helyek: megnyitáskor tölt, egyszerre egy licencé látszik, a gomb szövege vált, üres lista üzenete', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Helyek megtekintése');
    req('/licenses/10/seats').flush(seats);
    await settle();
    const last1 = new Date('2026-10-22T08:20:00Z');
    const last2 = new Date('2026-10-21T07:05:00Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(text(licenseBlock(30).querySelector('ul')!)).toBe(
      `1. hely Kovács Anna aktív utoljára: ${fmt(last1)} Felszabadítás ` +
        `2. hely bela@example.com tétlen · vizsgázik/kvízt ír utoljára: ${fmt(last2)} Felszabadítás`,
    );
    expect(licenseBlock(30).querySelector('.text-success')?.textContent?.trim()).toBe('aktív');
    expect(buttonIn(licenseBlock(30), 'Helyek elrejtése')).toBeTruthy();

    await clickIn(licenseBlock(5), 'Helyek megtekintése');
    req('/licenses/11/seats').flush([]);
    await settle();
    expect(licenseBlock(30).querySelector('ul')).toBeNull();
    expect(text(licenseBlock(5))).toContain('Jelenleg senki nem használ helyet.');

    await clickIn(licenseBlock(5), 'Helyek elrejtése');
    expect(licenseBlock(5).querySelector('ul')).toBeNull();
  });

  it('hely felszabadítása megerősítéssel; siker után a helyek és a licencek újratöltődnek', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Helyek megtekintése');
    req('/licenses/10/seats').flush(seats);
    await settle();

    confirmAsk.mockResolvedValueOnce(false);
    buttonIn(licenseBlock(30), 'Felszabadítás').click();
    await settle();
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message: 'Felszabadítod Kovács Anna helyét? A diák visszaesik a saját előfizetésére, a hely pedig azonnal kiosztható másnak.',
      danger: true,
      confirmLabel: 'Felszabadítás',
    });

    const second = [...licenseBlock(30).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === 'Felszabadítás',
    )[1];
    second.click();
    await settle();
    expect(confirmAsk.mock.lastCall?.[0].message).toContain('Felszabadítod bela@example.com helyét?');
    req('/licenses/10/seats/6/release', 'POST').flush(null);
    await settle();
    req('/licenses/10/seats').flush(seats.slice(0, 1));
    req('/licenses').flush(licenses);
    await settle();
    expect(text(licenseBlock(30))).not.toContain('bela@example.com');
  });

  // ── Kihasználtság ────────────────────────────────────────────────

  it('kihasználtság: betöltés üzenet, összegzés, csak az aktív napok, egyszerre egy licencé', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Kihasználtság');
    expect(text(licenseBlock(30))).toContain('Kimutatás betöltése…');
    req('/licenses/10/usage?days=30').flush(usage);
    await settle();
    const block = text(licenseBlock(30));
    expect(block).toContain(
      'Kihasználtság — elmúlt 30 nap 4 alkalommal nem jutott hely olyan diáknak, aki jogosult lett volna ' +
        'Csúcs: 30/30 hely · 1 napon telt be · 2 átvétel tétlen diáktól ' +
        'Ez a keret szűk: érdemes megfontolni a bővítést. ' +
        '10.02 · csúcs 30/30 · 4 sikertelen belépési kísérlet 10.03 · csúcs 3/30 · 2 átvétel',
    );
    expect(block).not.toContain('10.01');
    expect(licenseBlock(30).querySelector('p.text-danger.font-bold')).not.toBeNull();
    expect(buttonIn(licenseBlock(30), 'Kimutatás elrejtése')).toBeTruthy();

    await clickIn(licenseBlock(5), 'Kihasználtság');
    req('/licenses/11/usage?days=30').flush({ ...usage, licenseId: 11, totalDenied: 0, totalReclaimed: 0, peakSeatsInUse: 0, daysAtCapacity: 0,
      daily: [usage.daily[0]] });
    await settle();
    expect(text(licenseBlock(30))).not.toContain('Kihasználtság —');
    expect(text(licenseBlock(5))).toContain('0 alkalommal nem jutott hely');
    expect(text(licenseBlock(5))).toContain('Ebben az időszakban nem volt használat.');
    expect(text(licenseBlock(5))).not.toContain('Ez a keret szűk');

    await clickIn(licenseBlock(5), 'Kimutatás elrejtése');
    expect(text(licenseBlock(5))).not.toContain('Kihasználtság —');
  });

  it('kihasználtság-betöltési hiba a globális sávban; újranyitáskor a saját hibája törlődik', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Kihasználtság');
    req('/licenses/10/usage?days=30').flush({ errorMessage: 'Kimutatás-hiba' }, { status: 500, statusText: 'x' });
    await settle();
    expect(globalErrors()).toEqual(['Kimutatás-hiba']);
    await clickIn(licenseBlock(30), 'Kimutatás elrejtése');
    await clickIn(licenseBlock(30), 'Kihasználtság');
    expect(globalErrors()).toEqual([]);
    req('/licenses/10/usage?days=30').flush(usage);
    await settle();
  });

  // ── Szerkesztés ──────────────────────────────────────────────────

  it('szerkesztés: kitöltött mezők, mentés a pontos kéréssel, siker után zár és újratölt', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    expect((input('edit-cap-10') as HTMLInputElement).value).toBe('30');
    expect(input('edit-from-10').value).toBe('2026-08-25');
    expect(input('edit-to-10').value).toBe('2027-08-25');
    expect(input('edit-idle-10').value).toBe('20');
    expect(input('edit-note-10').value).toBe('Fenntartó Kft.');

    await type('edit-cap-10', '40');
    await type('edit-from-10', '2026-09-01');
    await type('edit-to-10', '2027-09-01');
    await type('edit-idle-10', '25');
    await type('edit-note-10', '  Új megjegyzés  ');
    await clickIn(licenseBlock(30), 'Mentés');
    const put = req('/licenses/10', 'PUT');
    expect(put.request.body).toEqual({
      capacity: 40, validFrom: '2026-09-01', validTo: '2027-09-01', billingNote: 'Új megjegyzés', idleWindowMinutes: 25, rowVersion: 'rv10',
    });
    put.flush(license({ id: 10, capacity: 40, skippedDueToActiveSessionCount: 0 }));
    await settle();
    await reloadAfterMutation(true);
    expect(el.querySelector('[name="edit-cap-10"]')).toBeNull();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it('szerkesztés: üres megjegyzés null, üres tétlenségi ablak null; kihagyott hely miatt figyelmeztető toast', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await type('edit-note-10', '   ');
    await type('edit-idle-10', '');
    await clickIn(licenseBlock(30), 'Mentés');
    const put = req('/licenses/10', 'PUT');
    expect(put.request.body).toEqual(expect.objectContaining({ billingNote: null, idleWindowMinutes: null, capacity: 30 }));
    put.flush(license({ id: 10, skippedDueToActiveSessionCount: 2 }));
    await settle();
    await reloadAfterMutation(true);
    expect(toastWarning).toHaveBeenCalledWith(
      '2 hely nem szabadult fel - a diák épp vizsgázik/kvízt ír, a hely csak a munkamenet végeztével válik felszabadíthatóvá.',
    );
  });

  it('szerkesztés: nyitott helyek-lista sikeres mentés után újratöltődik', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Helyek megtekintése');
    req('/licenses/10/seats').flush(seats);
    await settle();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await clickIn(licenseBlock(30), 'Mentés');
    req('/licenses/10', 'PUT').flush(license({ id: 10 }));
    await settle();
    req('/licenses/10/seats').flush(seats);
    await reloadAfterMutation(true);
    expect(text(licenseBlock(30))).toContain('Kovács Anna');
  });

  it('szerkesztési hiba: a form nyitva marad a begépelt értékekkel, a hiba a form alatt, nem a globális sávban', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await type('edit-cap-10', '50');
    await type('edit-from-10', '2027-09-01');
    await clickIn(licenseBlock(30), 'Mentés');
    req('/licenses/10', 'PUT').flush({ errorMessage: 'Felcserélt dátumok.' }, { status: 400, statusText: 'x' });
    await settle();
    expect(input('edit-cap-10').value).toBe('50');
    expect(input('edit-from-10').value).toBe('2027-09-01');
    expect(licenseBlock(30).querySelector('p.text-danger.text-xs.w-full')?.textContent).toBe('Felcserélt dátumok.');
    expect(globalErrors()).toEqual([]);

    // Mégse után a hiba már nem tartozik nyitott formhoz: a globális sávba kerül.
    await clickIn(licenseBlock(30), 'Mégse');
    expect(el.querySelector('[name="edit-cap-10"]')).toBeNull();
    expect(globalErrors()).toEqual(['Felcserélt dátumok.']);

    // Újranyitás: az eredeti adatok, a hiba törlődik.
    await clickIn(licenseBlock(30), 'Szerkesztés');
    expect(input('edit-cap-10').value).toBe('30');
    expect(globalErrors()).toEqual([]);
  });

  it('egyszerre egy szerkesztő form; másik licenc szerkesztésének nyitása az elsőt zárja, újrakattintás visszaállít', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await type('edit-cap-10', '77');
    await clickIn(licenseBlock(10), 'Szerkesztés');
    expect(el.querySelector('[name="edit-cap-10"]')).toBeNull();
    expect(input('edit-cap-20').value).toBe('10');
    await type('edit-cap-20', '12');
    await clickIn(licenseBlock(10), 'Szerkesztés');
    expect(input('edit-cap-20').value).toBe('10');
    await clickIn(licenseBlock(30), 'Szerkesztés');
    expect(input('edit-cap-10').value).toBe('30');
  });

  it('licenc-művelet alatt a szerkesztés/mentés/visszavonás/felszabadítás gombok letiltva', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Helyek megtekintése');
    req('/licenses/10/seats').flush(seats);
    await settle();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await clickIn(licenseBlock(30), 'Mentés');
    for (const label of ['Mentés', 'Szerkesztés', 'Visszavonás', 'Felszabadítás']) {
      expect(buttonIn(licenseBlock(30), label).disabled).toBe(true);
    }
    expect(buttonIn(licenseBlock(30), 'Mégse').disabled).toBe(false);
    req('/licenses/10', 'PUT').flush({ errorMessage: 'x' }, { status: 400, statusText: 'x' });
    await settle();
    expect(buttonIn(licenseBlock(30), 'Mentés').disabled).toBe(false);
  });

  // ── Létrehozás ───────────────────────────────────────────────────

  it('új licenc: alapértékek (prémium, 30 hely, ma – egy év múlva), pontos kérés, siker után zár és újratölt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 23, 12, 0));
    try {
      await loaded();
      await clickIn(schoolCard(2), '+ Új licenc');
      expect(input('tier-2').value).toBe('premium');
      expect(input('cap-2').value).toBe('30');
      expect(input('from-2').value).toBe('2026-10-23');
      expect(input('to-2').value).toBe('2027-10-23');
      expect(input('note-2').value).toBe('');

      await type('tier-2', 'standard');
      await type('cap-2', '12');
      await type('to-2', '2027-06-30');
      await type('note-2', ' Számla 1 ');
      await clickIn(schoolCard(2), 'Létrehozás');
      const post = req('/licenses', 'POST');
      expect(post.request.body).toEqual({
        schoolId: 2, tier: 'standard', capacity: 12, validFrom: '2026-10-23', validTo: '2027-06-30', billingNote: 'Számla 1',
      });
      post.flush(license({ id: 30, schoolId: 2 }));
      await settle();
      await reloadAfterMutation(true);
      expect(el.querySelector('[name="cap-2"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('új licenc hibája: a form nyitva marad az adatokkal, a hiba a globális sávban; újranyitás alapértékre állít', async () => {
    await loaded();
    await clickIn(schoolCard(2), '+ Új licenc');
    await type('cap-2', '44');
    await type('note-2', 'Megjegyzés');
    await clickIn(schoolCard(2), 'Létrehozás');
    expect(buttonIn(schoolCard(2), 'Létrehozás').disabled).toBe(true);
    req('/licenses', 'POST').flush({ errorMessage: 'Rossz tartomány.' }, { status: 400, statusText: 'x' });
    await settle();
    expect(input('cap-2').value).toBe('44');
    expect(input('note-2').value).toBe('Megjegyzés');
    expect(globalErrors()).toEqual(['Rossz tartomány.']);

    await clickIn(schoolCard(2), '+ Új licenc');
    expect(input('cap-2').value).toBe('30');
    expect(input('note-2').value).toBe('');
    expect(globalErrors()).toEqual([]);
  });

  it('új licenc: egyszerre egy intézménynél nyitott, a Mégse zár', async () => {
    await loaded();
    await clickIn(schoolCard(2), '+ Új licenc');
    await clickIn(schoolCard(3), '+ Új licenc');
    expect(el.querySelector('[name="cap-2"]')).toBeNull();
    expect(el.querySelector('[name="cap-3"]')).not.toBeNull();
    await clickIn(schoolCard(3), 'Mégse');
    expect(el.querySelector('[name="cap-3"]')).toBeNull();
  });

  // ── Visszavonás és hibairányítás (UI-TT-206) ─────────────────────

  it('visszavonás: megerősítő szöveg, siker után újratölt, kihagyott helynél toast', async () => {
    await loaded();
    confirmAsk.mockResolvedValueOnce(false);
    await clickIn(licenseBlock(30), 'Visszavonás');
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message:
        'Biztosan visszavonod a(z) Prémium licencet (Alfa Gimnázium)? A jelenleg használt 14 hely azonnal ' +
        'felszabadul, az érintett diákok visszaesnek a saját előfizetésükre.',
      danger: true,
      confirmLabel: 'Visszavonás',
    });

    await clickIn(licenseBlock(5), 'Visszavonás');
    expect(confirmAsk.mock.lastCall?.[0].message).toContain('a(z) Standard licencet');
    req('/licenses/11/revoke', 'POST').flush({ releasedCount: 3, skippedDueToActiveSessionCount: 2 });
    await settle();
    await reloadAfterMutation(true);
    expect(toastWarning).toHaveBeenCalledWith(expect.stringContaining('2 hely nem szabadult fel'));
  });

  it('UI-TT-206: egy másik licenc visszavonási hibája a saját kártyáján, nem a nyitott form alatt, és nem a globális sávban', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await clickIn(licenseBlock(5), 'Visszavonás');
    req('/licenses/11/revoke', 'POST').flush({ errorMessage: 'Visszavonás-hiba' }, { status: 400, statusText: 'x' });
    await settle();
    expect(text(licenseBlock(5))).toContain('Visszavonás-hiba');
    expect(licenseBlock(5).querySelector('p.text-danger.text-xs.mt-1')?.textContent).toBe('Visszavonás-hiba');
    expect(text(licenseBlock(30))).not.toContain('Visszavonás-hiba');
    expect(globalErrors()).toEqual([]);
    expect(el.querySelector('[name="edit-cap-10"]')).not.toBeNull();
  });

  it('UI-TT-206/207: felszabadítási hiba a saját kártyán; egy másik licenc helyeinek megnyitása nem törli', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Helyek megtekintése');
    req('/licenses/10/seats').flush(seats);
    await settle();
    await clickIn(licenseBlock(10), 'Szerkesztés');
    await clickIn(licenseBlock(30), 'Felszabadítás');
    req('/licenses/10/seats/5/release', 'POST').flush({ errorMessage: 'Felszabadítás-hiba' }, { status: 400, statusText: 'x' });
    await settle();
    expect(text(licenseBlock(30))).toContain('Felszabadítás-hiba');
    expect(text(licenseBlock(10))).not.toContain('Felszabadítás-hiba');
    expect(globalErrors()).toEqual([]);

    await clickIn(licenseBlock(5), 'Helyek megtekintése');
    req('/licenses/11/seats').flush([]);
    await settle();
    expect(text(licenseBlock(30))).toContain('Felszabadítás-hiba');
  });

  it('egy másik licenc mentési hibája nem jelenik meg egy éppen nyitott (másik) form alatt', async () => {
    await loaded();
    await clickIn(licenseBlock(30), 'Szerkesztés');
    await clickIn(licenseBlock(30), 'Mentés');
    req('/licenses/10', 'PUT').flush({ errorMessage: 'Mentés-hiba' }, { status: 400, statusText: 'x' });
    await settle();
    // A felhasználó egy másik licenc formját nyitja: a startEdit törli a hibát.
    await clickIn(licenseBlock(10), 'Szerkesztés');
    expect(text()).not.toContain('Mentés-hiba');
  });
});
