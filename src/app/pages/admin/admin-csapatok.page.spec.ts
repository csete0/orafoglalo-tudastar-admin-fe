import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminCsapatokComponent } from './admin-csapatok.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AdminTeamDetail, AdminTeamRow } from '../../models/team.model';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin/teams';

const T1: AdminTeamRow = {
  id: 5, name: 'Büfé', kind: 'school', status: 'active', groupName: '13.T', members: 3, repoName: 't5-c-bufe', repoSizeKb: 2048,
  githubRepo: 'diak/bufe', githubStatus: 'active', lastSyncStatus: 'diverged', lastSyncAt: '2026-10-12T10:00:00', lastError: 'eltér a main',
  reviewsThisMonth: 2, reviewCostUsd: 0.05, createdAt: '2026-10-01T10:00:00',
};
const T2: AdminTeamRow = {
  id: 6, name: 'Mozi', kind: 'individual', status: 'active', groupName: null, members: 2, repoName: null, repoSizeKb: null,
  githubRepo: 'x/mozi', githubStatus: 'broken', lastSyncStatus: null, lastSyncAt: null, lastError: null,
  reviewsThisMonth: 0, reviewCostUsd: 0, createdAt: '2026-10-01T10:00:00',
};
const T3: AdminTeamRow = { ...T2, id: 7, name: 'Könyvtár', githubRepo: null, githubStatus: null };
const DETAIL: AdminTeamDetail = {
  team: T1,
  members: [
    { userId: 1, email: 'a@x.hu', name: 'Anna', role: 'frontend', joinedAt: '2026-10-01T10:00:00', leftAt: null },
    { userId: 2, email: 'b@x.hu', name: 'Béla', role: null, joinedAt: '2026-10-01T10:00:00', leftAt: '2026-10-10T10:00:00' },
  ],
  branches: {
    'refs/heads/main': { action: 'diverged', ours: 'a', theirs: 'b', detail: 'force-push', at: '' },
    'refs/heads/dev': { action: 'pushed', ours: 'c', theirs: 'c', detail: null, at: '' },
  },
};

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Csapatok oldal a valódi service-szel +
 * HttpTestingController, csak DOM-on keresztül (keresés, hibaszűrő, részletek, újrapróbálás, leválasztás, hibák, foglaltság).
 */
describe('AdminCsapatokComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminCsapatokComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let ask: ReturnType<typeof vi.spyOn>;

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
  const searchInput = () => el.querySelector<HTMLInputElement>('input[type="search"]')!;
  const checkbox = () => el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  const button = (label: string, root: Element = el) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const row = (id: number) => el.querySelector(`[data-testid="team-${id}"]`)!;
  const rows = () => [...el.querySelectorAll('.card > ul > li')].map((li) => text(li));
  const detail = () => el.querySelector('[data-testid="team-detail"]');
  const errorText = () => el.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const fail = (r: TestRequest, body: object | null = null) => r.flush(body, { status: 400, statusText: 'Bad Request' });
  const searchReq = (q: string, problems: boolean) =>
    http.expectOne((r) => r.url === API && r.params.get('q') === q && r.params.get('problems') === String(problems) && r.params.get('take') === '100');
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }
  async function loaded(list: AdminTeamRow[] = [T1, T2, T3]) {
    await settle();
    searchReq('', false).flush(list);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminCsapatokComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminCsapatokComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: üres keresés, hibaszűrő nélkül; a sorok szövege, jelvényei és gomb-állapotai; közben a Keresés tiltva', async () => {
    await settle();
    expect(button('Keresés').disabled).toBe(true);
    searchReq('', false).flush([T1, T2, T3]);
    await settle();
    expect(button('Keresés').disabled).toBe(false);
    expect(rows()).toEqual([
      'Büfé iskolai · 13.T · 3 tag · t5-c-bufe (2.0 MB) · MI-átnézés: 2 (0.050 $) diak/bufe: eltért a GitHubon Újrapróbálás Leválasztás eltér a main',
      'Mozi egyéni · 2 tag · nincs tároló · MI-átnézés: 0 (0.000 $) x/mozi: megszakadt Újrapróbálás Leválasztás',
      'Könyvtár egyéni · 2 tag · nincs tároló · MI-átnézés: 0 (0.000 $)',
    ]);
    const badge1 = row(5).querySelector('.badge')!;
    expect(badge1.classList.contains('badge-warning')).toBe(true);
    expect(badge1.classList.contains('badge-danger')).toBe(false);
    expect(row(6).querySelector('.badge')!.classList.contains('badge-danger')).toBe(true);
    expect(button('Újrapróbálás', row(5)).disabled).toBe(false);
    expect(button('Újrapróbálás', row(6)).disabled).toBe(true);
    expect(button('Leválasztás', row(6)).disabled).toBe(false);
    expect(detail()).toBeNull();
  });

  it('üres találat; keresés gombbal, Enterrel és a hibaszűrő kapcsolásával (azonnal tölt)', async () => {
    await loaded([]);
    expect(rows()).toEqual(['Nincs találat.']);
    searchInput().value = '  bufe ';
    searchInput().dispatchEvent(new Event('input'));
    await click(button('Keresés'));
    searchReq('bufe', false).flush([T1]);
    await settle();
    expect(rows().length).toBe(1);

    checkbox().click();
    await settle();
    searchReq('bufe', true).flush([]);
    await settle();
    expect(rows()).toEqual(['Nincs találat.']);

    searchInput().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    await settle();
    searchReq('bufe', true).flush([T1]);
    await settle();
    expect(rows().length).toBe(1);
  });

  it('részletek: a tagok és az ágak; másik csapatra váltva frissül; hiba esetén üzenet, a korábbi részlet marad', async () => {
    await loaded();
    await click(button('Büfé'));
    expect(button('Keresés').disabled).toBe(true);
    http.expectOne(`${API}/5`).flush(DETAIL);
    await settle();
    expect(text(detail()!)).toBe(
      'Büfé Anna · a@x.hu · frontend · tag Béla · b@x.hu · kilépett: 2026.10.10. Ágak (utolsó tükrözés) dev: pushed main: diverged – force-push',
    );

    await click(button('Mozi'));
    http.expectOne(`${API}/6`).flush({ team: T2, members: [], branches: {} });
    await settle();
    expect(text(detail()!)).toBe('Mozi Ágak (utolsó tükrözés) Még nem volt tükrözés.');

    await click(button('Könyvtár'));
    fail(http.expectOne(`${API}/7`), { errorMessage: 'Nincs ilyen csapat.' });
    await settle();
    expect(errorText()).toBe('Nincs ilyen csapat.');
    expect(text(detail()!)).toContain('Mozi');
  });

  it('újrapróbálás: POST, utána újratölt a mostani szűrőkkel; hibánál üzenet és nincs újratöltés', async () => {
    await loaded();
    checkbox().click();
    await settle();
    searchReq('', true).flush([T1]);
    await settle();
    await click(button('Újrapróbálás', row(5)));
    const req = http.expectOne(`${API}/5/github/retry`);
    expect(req.request.method).toBe('POST');
    expect(button('Leválasztás', row(5)).disabled).toBe(true);
    req.flush(null);
    await settle();
    searchReq('', true).flush([T1]);
    await settle();

    await click(button('Újrapróbálás', row(5)));
    fail(http.expectOne(`${API}/5/github/retry`));
    await settle();
    expect(errorText()).toBe('A művelet nem sikerült.');
    http.expectNone((r) => r.url === API);
    expect(button('Újrapróbálás', row(5)).disabled).toBe(false);
  });

  it('leválasztás: megerősítés (elutasításnál nincs kérés), DELETE, utána újratölt; a következő művelet törli a hibát', async () => {
    await loaded();
    ask.mockResolvedValueOnce(false);
    await click(button('Leválasztás', row(5)));
    expect(ask).toHaveBeenCalledWith({
      title: 'GitHub-kapcsolat leválasztása', message: 'A(z) „Büfé” csapat tükrözése leáll (diak/bufe). A csapat újra összekapcsolhatja.', danger: true,
    });
    http.expectNone(`${API}/5/github`);

    await click(button('Leválasztás', row(5)));
    fail(http.expectOne(`${API}/5/github`), { errorMessage: 'Már le van választva.' });
    await settle();
    expect(errorText()).toBe('Már le van választva.');

    await click(button('Leválasztás', row(5)));
    expect(errorText()).toBeNull();
    const req = http.expectOne(`${API}/5/github`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await settle();
    searchReq('', false).flush([{ ...T1, githubStatus: 'unlinked' }, T2, T3]);
    await settle();
    expect(rows()[0]).toContain('diak/bufe: leválasztva');
    expect(button('Leválasztás', row(5)).disabled).toBe(true);
    expect(button('Újrapróbálás', row(5)).disabled).toBe(true);
  });

  it('betöltési hiba: üzenet, a korábbi lista marad', async () => {
    await loaded();
    await click(button('Keresés'));
    fail(searchReq('', false), { errorMessage: 'Túl sok kérés.' });
    await settle();
    expect(errorText()).toBe('Túl sok kérés.');
    expect(rows().length).toBe(3);
  });

  it('gyors csapatváltásnál az előző részlet-kérés lemondódik — WP-C8, javulás', async () => {
    await loaded();
    await click(button('Büfé'));
    const stale = http.expectOne(`${API}/5`);
    await click(button('Mozi'));
    http.expectOne(`${API}/6`).flush({ team: T2, members: [], branches: {} });
    await settle();
    expect(stale.cancelled).toBe(true);
    expect(text(detail()!)).toContain('Mozi');
  });
});
