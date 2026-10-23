import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UsersComponent } from './users.component';
import { UserSearchPage, UserSearchResult } from '../../services/users/user.service';
import { environment } from '../../../environments/environment';

const URL_ = `${environment.apiUrl}/users`;

const user = (id: number, overrides: Partial<UserSearchResult> = {}): UserSearchResult => ({
  id, email: `u${id}@example.com`, displayName: `Felhasználó ${id}`, roles: ['student'], createdAt: '2026-09-01T08:00:00',
  hasActiveSubscription: false, isLockedOut: false, ...overrides,
});
const page = (items: UserSearchResult[], totalCount = items.length): UserSearchPage => ({ items, totalCount, page: 1, pageSize: 50 });

/**
 * Karakterizáció (WP-A2): a felhasználó-kereső mostani viselkedése (valódi UserService + HttpTestingController,
 * hogy a WP-A4 service-átírása után is érvényes maradjon).
 */
describe('UsersComponent', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const expectSearch = (): TestRequest => http.expectOne((r) => r.url === URL_);
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsersComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('betöltéskor szűrő nélkül az 1. oldalt kéri 50-es oldalmérettel, közben „Betöltés...”', async () => {
    const req = expectSearch();
    expect(req.request.method).toBe('GET');
    expect(params(req)).toEqual({ page: '1', pageSize: '50' });
    fixture.detectChanges();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Betöltés...');

    req.flush(page([]));
    await settle();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nincs találat.');
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('0 találat');
  });

  it('a sorokat a mostani formában jeleníti meg', async () => {
    expectSearch().flush(page([
      user(7, { roles: ['teacher', 'admin'], hasActiveSubscription: true, isLockedOut: true }),
      user(8, { roles: [] }),
    ]));
    await settle();

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    const cells = (i: number) => Array.from(rows[i].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(cells(0)).toEqual(['u7@example.com', 'Felhasználó 7', 'teacher, admin', '2026-09-01T08:00:00', 'Aktív', 'Zárolva']);
    expect(cells(1)).toEqual(['u8@example.com', 'Felhasználó 8', '-', '2026-09-01T08:00:00', '-', 'OK']);
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/users/7');
  });

  it('a szűrő gépelésre nem keres, csak a Keresés gombra; az üres mezőt nem küldi', async () => {
    expectSearch().flush(page([]));
    await settle();

    setValue('input[name="query"]', 'kovacs');
    setValue('select[name="role"]', 'teacher');
    setValue('select[name="subscriptionStatus"]', 'PaymentFailed');
    await settle();
    http.expectNone((r) => r.url === URL_);

    submit();
    const req = expectSearch();
    expect(params(req)).toEqual({ page: '1', pageSize: '50', query: 'kovacs', role: 'teacher', subscriptionStatus: 'PaymentFailed' });
    req.flush(page([]));
    await settle();

    setValue('select[name="role"]', '');
    submit();
    expect(params(expectSearch())).toEqual({ page: '1', pageSize: '50', query: 'kovacs', subscriptionStatus: 'PaymentFailed' });
  });

  it('lapozás: összes / 50 oldal, határokon tiltott gomb, a Keresés az 1. oldalra ugrik', async () => {
    expectSearch().flush(page([user(1)], 120));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 3');
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('120 találat');
    let [prev, next] = Array.from(pagerButtons());
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    let req = expectSearch();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page([user(2)], 120));
    await settle();
    next.click();
    expectSearch().flush(page([user(3)], 120));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('3 / 3');
    [prev, next] = Array.from(pagerButtons());
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    prev.click();
    req = expectSearch();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page([user(2)], 120));
    await settle();

    submit();
    req = expectSearch();
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([user(1)], 120));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 3');
  });

  it('üres találatnál is legalább 1 oldal; a 0. oldalra lapozás nem kér semmit', async () => {
    expectSearch().flush(page([], 0));
    await settle();
    expect(el.querySelector('.pager span')?.textContent?.trim()).toBe('1 / 1');
    expect(pagerButtons()[1].disabled).toBe(true);

    await fixture.componentInstance.goToPage(0);
    http.expectNone((r) => r.url === URL_);
  });

  it('hibánál a betöltés-jelző leáll, a korábbi sorok maradnak, a hiba továbbmegy (nincs hibaüzenet)', async () => {
    expectSearch().flush(page([user(1)], 1));
    await settle();

    const done = fixture.componentInstance.search();
    expectSearch().flush(null, { status: 500, statusText: 'Server Error' });
    await expect(done).rejects.toMatchObject({ status: 500 });
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody tr td')?.textContent?.trim()).toBe('u1@example.com');
  });
});
