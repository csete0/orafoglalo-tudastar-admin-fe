import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { UserDetailComponent } from './user-detail.component';
import { UserDetail } from '../../services/users/user.service';
import { ProjectAdminUserProject } from '../../models/projektmuhely.model';
import { PracticeGradeUserDetail } from '../../models/practice-grades.model';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;
const USER_URL = `${API}/users/89`;
const PROJECTS_URL = `${API}/projects/users/89`;
const PRACTICE_URL = `${API}/practice-grades/users/89`;

const fullUser: UserDetail = {
  id: 89, email: 'diak@example.com', userName: 'diak', firstName: 'Teszt', lastName: 'Diák', createdAt: '2026-09-01T10:00:00',
  emailConfirmed: false, isLockedOut: true, roles: ['User', 'Teacher'], trialEndsAt: null,
  subscriptions: [
    { id: 1, subscriptionTypeName: 'Éves', status: 'Active', startDate: '2026-09-01', endDate: '2027-09-01', isCancelled: false,
      autoRenew: true, activatedViaGift: false },
    { id: 2, subscriptionTypeName: 'Havi', status: 'Expired', startDate: '2026-08-01', endDate: '2026-09-01', isCancelled: false,
      autoRenew: false, activatedViaGift: true },
  ],
  payments: [
    { id: 7, amount: 9990, paymentDate: '2026-09-01', status: 'Succeeded', paymentMethod: 'card', refunded: false,
      needsManualReview: false, stripePaymentIntentUrl: 'https://dashboard.stripe.com/payments/pi_1' },
    { id: 8, amount: 1990, paymentDate: '2026-08-01', status: 'Succeeded', paymentMethod: null, refunded: true,
      needsManualReview: true, stripePaymentIntentUrl: null },
  ],
  groupMemberships: [
    { groupId: 3, groupName: '11.B', joinedAt: '2026-09-02', removedAt: null },
    { groupId: 4, groupName: 'Szakkör', joinedAt: '2026-09-03', removedAt: '2026-10-01' },
  ],
  parentEmails: [
    { email: 'anya@example.com', isVerified: true },
    { email: 'apa@example.com', isVerified: false },
  ],
  teacherProfile: {
    teacherProfileId: 12, displayName: 'Diák Tanár', institutionName: null, isActive: true, maxTaskSets: null, actualTaskSetCount: 4,
    maxStorageBytes: 2 * 1024 * 1024, actualStorageBytes: 1536, groupNames: ['11.B'], schoolNames: [],
  },
};

const projects: ProjectAdminUserProject[] = [
  { slug: 'todo', title: 'Teendőlista', runtime: 'browser-python', currentMilestoneOrder: 3, milestoneCount: 5, passedCount: 2, checks: 9,
    hint1: 1, hint2: 2, hint3: 0, aiCostUsd30: 0.0042, startedAt: '2026-09-05T08:00:00', completedAt: null,
    lastActivityAt: '2026-10-01T12:34:56' },
  { slug: 'quiz', title: 'Kvíz', runtime: 'ismeretlen', currentMilestoneOrder: 4, milestoneCount: 4, passedCount: 4, checks: 12,
    hint1: 0, hint2: 0, hint3: 1, aiCostUsd30: 0.125, startedAt: '2026-09-06T08:00:00', completedAt: '2026-09-20T08:00:00',
    lastActivityAt: null },
];

const practice: PracticeGradeUserDetail = {
  tier: 'standard',
  quotas: [{ kind: 'files', usedToday: 1, dailyLimit: 3, usedThisMonth: 4, monthlyLimit: null, creditToday: 2 }],
  grades: [],
  credits: [{ createdAt: '2026-10-10T09:00:00Z', kind: 'files', amount: 2, adminEmail: 'admin@example.com', reason: 'support #7' }],
};

/** Karakterizáció (WP-C1 előtt rögzítve): a teljes oldal valódi service-ekkel + HttpTestingController. */
describe('UserDetailComponent – teljes oldal', () => {
  let fixture: ComponentFixture<UserDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  /** A látható szöveg szövegcsomópontonként, szóközzel elválasztva (a sablon tördelésétől független). */
  const text = () => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  const get = (url: string): TestRequest => http.expectOne((r) => r.url === url && r.method === 'GET');
  const post = (url: string): TestRequest => http.expectOne((r) => r.url === url && r.method === 'POST');
  const actionButtons = () => el.querySelectorAll<HTMLButtonElement>('section.actions button');
  async function settle() {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  async function load(user: UserDetail = fullUser) {
    // Mindhárom kérés egyszerre indul (egymástól független szakaszok).
    const reqs = [get(USER_URL), get(PROJECTS_URL), get(PRACTICE_URL)];
    reqs[1].flush(projects);
    reqs[2].flush(practice);
    reqs[0].flush(user);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '89' } } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserDetailComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('betöltés közben „Betöltés...”, utána minden szakasz a régi szöveggel jelenik meg', async () => {
    expect(text()).toBe('← Vissza a kereséshez Betöltés...');
    await load();
    expect(text()).toBe(
      '← Vissza a kereséshez Teszt Diák diak@example.com User Teacher Zárolva E-mail nincs megerősítve ' +
        'Támogatói műveletek Zárolás feloldása Megerősítő e-mail újraküldése E-mail kézi megerősítése ' +
        'Alapadatok Felhasználónév diak Regisztráció 2026-09-01T10:00:00 Próbaidőszak vége - ' +
        'Tanári profil Megjelenített név Diák Tanár Intézmény - Állapot Aktív Feladatsor-kvóta 4 / korlátlan ' +
        'Tárhely-kvóta 1.5 KB / 2.0 MB Iskolái - Csoportjai 11.B ' +
        'Előfizetések Csomag Állapot Kezdet Vég AutoRenew Ajándék Éves Active 2026-09-01 2027-09-01 Igen - ' +
        'Havi Expired 2026-08-01 2026-09-01 Nem Igen ' +
        'Fizetések Dátum Összeg Állapot Mód Stripe 2026-09-01 9990 Ft Succeeded card Megnyitás ' +
        '2026-08-01 1990 Ft Succeeded (visszatérítve) - - ' +
        'Csoporttagságok 11.B - csatlakozott: 2026-09-02 Szakkör - csatlakozott: 2026-09-03, kilépett: 2026-10-01 ' +
        'Szülői e-mailek anya@example.com (megerősítve) apa@example.com (nincs megerősítve) ' +
        'Projektműhely Projekt Nyelv Lépés Teljesítve Ellenőrzés Tipp · hely · kód AI (30 nap) Utoljára ' +
        'Teendőlista Python 3. 2 / 5 9 1 · 2 · 0 $0.0042 2026-10-01 12:34 ' +
        'Kvíz ✓ kész ismeretlen 4. 4 / 4 12 0 · 0 · 1 $0.125 - ' +
        'Gyakorló értékelések Csomag Standard Irodai / weblap ma 1 / 3 (+2 jóváírva) ' +
        'Kézi keret-jóváírás Irodai / weblap Jóváírás Még nem kért gyakorló értékelést. ' +
        '2026.10.10 ' + new Date('2026-10-10T09:00:00Z').getHours().toString().padStart(2, '0') +
        ':00 · +2 Irodai / weblap · admin@example.com · support #7',
    );
    const flagged = el.querySelectorAll('tr.flagged');
    expect(flagged.length).toBe(1);
    expect(flagged[0].textContent).toContain('1990 Ft');
    expect(el.querySelector('a[href="https://dashboard.stripe.com/payments/pi_1"]')?.getAttribute('target')).toBe('_blank');
  });

  it('a felhasználó betöltési hibájánál csak a hibaüzenet látszik', async () => {
    get(PROJECTS_URL).flush(projects);
    get(PRACTICE_URL).flush(practice);
    get(USER_URL).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toBe('← Vissza a kereséshez A felhasználó nem található.');
  });

  it('a projektműhely hibája csak a saját szakaszát érinti; a még töltő gyakorló szakasz „Betöltés...”', async () => {
    get(PROJECTS_URL).flush(null, { status: 500, statusText: 'Error' });
    get(USER_URL).flush({ ...fullUser, teacherProfile: null });
    const practiceReq = get(PRACTICE_URL);
    await settle();
    expect(text()).toContain('Projektműhely A Projektműhely-adatokat nem sikerült betölteni.');
    expect(text()).toContain('Gyakorló értékelések Betöltés...');
    expect(text()).not.toContain('Tanári profil');
    practiceReq.flush(practice);
    await settle();
    expect(text()).toContain('Gyakorló értékelések Csomag Standard');
  });

  it('üres listáknál a „nincs” szövegek jelennek meg', async () => {
    get(PROJECTS_URL).flush([]);
    get(PRACTICE_URL).flush({ ...practice, quotas: [], credits: undefined });
    get(USER_URL).flush({ ...fullUser, subscriptions: [], payments: [], groupMemberships: [], parentEmails: [] });
    await settle();
    const empties = Array.from(el.querySelectorAll('.empty')).map((e) => e.textContent?.trim());
    expect(empties).toEqual([
      'Nincs előfizetése.', 'Nincs fizetése.', 'Nincs csoporttagsága.', 'Nincs regisztrált szülői e-mail.',
      'Még nem kezdett projektet.', 'Még nem kért gyakorló értékelést.',
    ]);
    expect(text()).not.toContain('Kézi keret-jóváírás');
  });

  it('zárolás feloldása: POST, üzenet, a felhasználó újratöltődik; közben a gombok tiltva', async () => {
    await load();
    const [unlock, resend, manual] = Array.from(actionButtons());
    expect(unlock.disabled).toBe(false);
    expect(resend.disabled).toBe(false);
    expect(manual.disabled).toBe(false);
    unlock.click();
    fixture.detectChanges();
    expect(Array.from(actionButtons()).every((b) => b.disabled)).toBe(true);
    post(`${USER_URL}/unlock`).flush(null);
    await settle();
    expect(Array.from(actionButtons()).every((b) => b.disabled)).toBe(true);
    get(USER_URL).flush({ ...fullUser, isLockedOut: false });
    await settle();
    expect(text()).toContain('Zárolás feloldva.');
    expect(text()).not.toContain('Zárolva');
    expect(actionButtons()[0].disabled).toBe(true);
    expect(actionButtons()[1].disabled).toBe(false);
  });

  it('sikertelen műveletnél „A művelet sikertelen.”, újratöltés nincs', async () => {
    await load();
    actionButtons()[1].click();
    fixture.detectChanges();
    post(`${USER_URL}/resend-confirmation`).flush(null, { status: 500, statusText: 'Error' });
    await settle();
    expect(text()).toContain('A művelet sikertelen.');
    expect(actionButtons()[1].disabled).toBe(false);
  });

  it('megerősítő e-mail újraküldése', async () => {
    await load();
    actionButtons()[1].click();
    fixture.detectChanges();
    post(`${USER_URL}/resend-confirmation`).flush(null);
    await settle();
    get(USER_URL).flush(fullUser);
    await settle();
    expect(text()).toContain('Megerősítő e-mail elküldve.');
  });

  it('e-mail kézi megerősítése csak jóváhagyás után megy el', async () => {
    await load();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    actionButtons()[2].click();
    fixture.detectChanges();
    await settle();
    expect(confirmSpy).toHaveBeenCalledWith('Biztosan kézzel megerősíted ennek a felhasználónak az e-mail-címét?');
    http.expectNone(`${USER_URL}/confirm-email`);

    confirmSpy.mockReturnValue(true);
    actionButtons()[2].click();
    fixture.detectChanges();
    await settle();
    post(`${USER_URL}/confirm-email`).flush(null);
    await settle();
    get(USER_URL).flush({ ...fullUser, emailConfirmed: true });
    await settle();
    expect(text()).toContain('E-mail kézzel megerősítve.');
    expect(text()).not.toContain('E-mail nincs megerősítve');
  });

  it('ha a „Kód” típusnak nincs kerete, a jóváírás az első elérhető típusra megy', async () => {
    await load();
    const select = el.querySelector<HTMLSelectElement>('.credit-form select')!;
    expect(select.value).toBe('files');
  });

  it('újratöltési hiba egy művelet után a hibaüzenetre vált', async () => {
    await load();
    actionButtons()[0].click();
    fixture.detectChanges();
    post(`${USER_URL}/unlock`).flush(null);
    await settle();
    get(USER_URL).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toBe('← Vissza a kereséshez A felhasználó nem található.');
  });
});
