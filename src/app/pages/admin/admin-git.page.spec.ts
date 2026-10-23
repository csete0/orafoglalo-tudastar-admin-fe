import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminGitComponent } from './admin-git.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { GitAdminRepo, GitQuota } from '../../models/git.model';

registerLocaleData(localeHu);

const API = 'http://localhost:7090/api/admin/git';

const QUOTA: GitQuota = {
  repoMaxMb: 60, reposPerUser: 15, fileMaxMb: 4, pushesPerMinute: 8, clonesPerMinute: 30, snapshotMaxMb: 12, teamRepoMaxMb: 70,
  updatedAt: '2026-10-01T08:30:00',
};
const R1: GitAdminRepo = {
  id: 7, name: 'u12-p-bufe', ownerUserId: 12, ownerEmail: 'diak@x.hu', ownerTeamId: null, purpose: 'project', projectSlug: 'bufe', sizeKb: 2048,
  lastPushAt: '2026-10-02T14:05:00', locked: false, lockReason: null, overQuota: true, createdAt: '2026-09-01T10:00:00',
};
const R2: GitAdminRepo = {
  id: 8, name: 't5-c-bufe', ownerUserId: null, ownerEmail: null, ownerTeamId: 5, purpose: 'team', projectSlug: null, sizeKb: 512,
  lastPushAt: null, locked: true, lockReason: 'spam', overQuota: false, createdAt: '2026-09-01T10:00:00',
};
const FIELDS = ['repoMaxMb', 'reposPerUser', 'fileMaxMb', 'pushesPerMinute', 'clonesPerMinute', 'snapshotMaxMb', 'teamRepoMaxMb'] as const;

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Git oldal a valódi service-szel +
 * HttpTestingController, csak DOM-on keresztül (kvóta-űrlap, keresés, zárolás, feloldás, törlés, hibák, foglaltság).
 */
describe('AdminGitComponent – teljes oldal', () => {
  let fixture: ComponentFixture<AdminGitComponent>;
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
  const quotaInput = (name: string) => el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const saveButton = () => el.querySelector<HTMLButtonElement>('[data-testid="git-quota-save"]')!;
  const searchInput = () => el.querySelector<HTMLInputElement>('input[type="search"]')!;
  const reasonInput = () => el.querySelector<HTMLInputElement>('input[maxlength="200"]')!;
  const button = (label: string, root: Element = el) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)!;
  const row = (id: number) => el.querySelector(`[data-testid="git-repo-${id}"]`)!;
  const rows = () => [...el.querySelectorAll('ul li')].map((li) => text(li));
  const errorText = () => el.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const fail = (r: TestRequest, body: object | null = null) => r.flush(body, { status: 400, statusText: 'Bad Request' });
  const reposReq = (q: string) => http.expectOne((r) => r.url === `${API}/repos` && r.params.get('q') === q && r.params.get('take') === '100');
  async function type(i: HTMLInputElement, value: string) {
    i.value = value;
    i.dispatchEvent(new Event('input'));
    await settle();
  }
  async function click(b: HTMLButtonElement) {
    b.click();
    await settle();
  }

  async function loaded(repos: GitAdminRepo[] = [R1, R2]) {
    await settle();
    http.expectOne(`${API}/quota`).flush(QUOTA);
    await settle();
    reposReq('').flush(repos);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminGitComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminGitComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: a kvóta az űrlapba kerül, a tárolók listája üres kereséssel; betöltés közben a gombok tiltva', async () => {
    await settle();
    expect(button('Keresés').disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    http.expectOne(`${API}/quota`).flush(QUOTA);
    await settle();
    reposReq('').flush([R1, R2]);
    await settle();

    expect(FIELDS.map((f) => quotaInput(f).value)).toEqual(['60', '15', '4', '8', '30', '12', '70']);
    expect(text(el.querySelector('[data-testid="git-quota"]')!)).toContain('Utoljára módosítva: 2026.10.01. 08:30');
    expect(button('Keresés').disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
    expect(rows()).toEqual([
      'u12-p-bufe diak@x.hu · 2.0 MB · projekt (bufe) · utolsó push: 2026.10.02. 14:05 kvóta felett Zárolás Törlés',
      't5-c-bufe csapat #5 · 0.5 MB · csapat · még nem pusholtak zárolva: spam Feloldás Törlés',
    ]);
    const lock = button('Zárolás', row(7));
    expect(lock.disabled).toBe(true);
    expect(lock.title).toBe('Előbb add meg a zárolás okát');
  });

  it('üres találat; keresés gombbal és Enterrel, a keresőszó levágva', async () => {
    await loaded([]);
    expect(rows()).toEqual(['Nincs találat.']);
    await type(searchInput(), '  diak@x.hu ');
    await click(button('Keresés'));
    expect(button('Keresés').disabled).toBe(true);
    reposReq('diak@x.hu').flush([R1]);
    await settle();
    expect(rows().length).toBe(1);

    await type(searchInput(), 'bufe');
    searchInput().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    await settle();
    reposReq('bufe').flush([R1, R2]);
    await settle();
    expect(rows().length).toBe(2);
  });

  it('kvóta mentése: megerősítés, a teljes kérés updatedAt nélkül; a válasz dátuma látszik; elutasításnál nincs kérés', async () => {
    await loaded();
    await type(quotaInput('repoMaxMb'), '80');
    ask.mockResolvedValueOnce(false);
    await click(saveButton());
    expect(ask).toHaveBeenCalledWith({
      title: 'Kvóták mentése',
      message: 'A kvóták legfeljebb fél percen belül érvényesek; a méret-korlátot a meglévő tárolókra 5 percen belül telepíti a rendszer.',
      confirmLabel: 'Mentés',
    });
    http.expectNone(`${API}/quota`);

    await click(saveButton());
    const req = http.expectOne(`${API}/quota`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      repoMaxMb: 80, reposPerUser: 15, fileMaxMb: 4, pushesPerMinute: 8, clonesPerMinute: 30, snapshotMaxMb: 12, teamRepoMaxMb: 70,
    });
    expect(saveButton().disabled).toBe(true);
    req.flush({ ...QUOTA, repoMaxMb: 80, updatedAt: '2026-10-23T09:15:00' });
    await settle();
    expect(text(el.querySelector('[data-testid="git-quota"]')!)).toContain('Utoljára módosítva: 2026.10.23. 09:15');
    expect(quotaInput('repoMaxMb').value).toBe('80');
    expect(saveButton().disabled).toBe(false);
  });

  it('kvóta: üres vagy határon kívüli mezőnél a Mentés tiltva és figyelmeztetés látszik; Enterrel sem megy el', async () => {
    await loaded();
    const warning = 'Minden mező kitöltendő, a megadott határokon belül.';
    expect(text(el)).not.toContain(warning);
    for (const [name, bad, good] of [['repoMaxMb', '501', '500'], ['reposPerUser', '0', '1'], ['fileMaxMb', '', '100'],
      ['pushesPerMinute', '121', '120'], ['clonesPerMinute', '601', '600'], ['snapshotMaxMb', '51', '50'], ['teamRepoMaxMb', '0', '1']] as const) {
      await type(quotaInput(name), bad);
      expect(saveButton().disabled).toBe(true);
      expect(text(el)).toContain(warning);
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(ask).not.toHaveBeenCalled();
      await type(quotaInput(name), good);
      expect(saveButton().disabled).toBe(false);
      expect(text(el)).not.toContain(warning);
    }
  });

  it('kvóta mentési hiba: a szerver üzenete; a következő művelet törli', async () => {
    await loaded();
    await click(saveButton());
    fail(http.expectOne(`${API}/quota`), { errorMessage: 'Érvénytelen kvóta.' });
    await settle();
    expect(errorText()).toBe('Érvénytelen kvóta.');
    await click(button('Keresés'));
    expect(errorText()).toBeNull();
    fail(reposReq(''));
    await settle();
    expect(errorText()).toBe('A művelet nem sikerült.');
    expect(rows().length).toBe(2);
  });

  it('zárolás: ok nélkül tiltva; megerősítés a tárolóval és az okkal; utána az ok törlődik és újratölt a mostani keresőszóval', async () => {
    await loaded();
    await type(searchInput(), 'u12');
    await type(reasonInput(), '  nem odaillő  ');
    const lock = button('Zárolás', row(7));
    expect(lock.disabled).toBe(false);
    expect(lock.title).toBe('Zárolás');
    ask.mockResolvedValueOnce(false);
    await click(lock);
    expect(ask).toHaveBeenCalledWith({
      title: 'Tároló zárolása',
      message: 'A(z) „u12-p-bufe” tároló (diak@x.hu) zárolódik: a diák nem klónozhatja és nem fetch-elheti, nem pusholhat bele, '
        + 'nem mentheti és nem törölheti. Ok: „nem odaillő”.',
      confirmLabel: 'Zárolás',
      danger: true,
    });
    http.expectNone(`${API}/repos/7/lock`);

    await click(button('Zárolás', row(7)));
    const req = http.expectOne(`${API}/repos/7/lock`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'nem odaillő' });
    expect(button('Törlés', row(8)).disabled).toBe(true);
    req.flush(null);
    await settle();
    reposReq('u12').flush([{ ...R1, locked: true, lockReason: 'nem odaillő' }]);
    await settle();
    expect(reasonInput().value).toBe('');
    expect(rows()).toEqual([
      'u12-p-bufe diak@x.hu · 2.0 MB · projekt (bufe) · utolsó push: 2026.10.02. 14:05 zárolva: nem odaillő kvóta felett Feloldás Törlés',
    ]);
  });

  it('zárolási hiba: üzenet, az ok megmarad, nincs újratöltés', async () => {
    await loaded();
    await type(reasonInput(), 'spam');
    await click(button('Zárolás', row(7)));
    fail(http.expectOne(`${API}/repos/7/lock`), { errorMessage: 'A tároló nem található.' });
    await settle();
    expect(errorText()).toBe('A tároló nem található.');
    expect(reasonInput().value).toBe('spam');
    http.expectNone((r) => r.url === `${API}/repos`);
  });

  it('feloldás és törlés: megerősítés, DELETE, utána újratölt; elutasításnál nincs kérés; hibánál nincs újratöltés', async () => {
    await loaded();
    ask.mockResolvedValueOnce(false);
    await click(button('Feloldás', row(8)));
    expect(ask).toHaveBeenCalledWith({
      title: 'Zárolás feloldása', message: 'A(z) „t5-c-bufe” tároló (csapat #5) zárolása feloldódik (ok volt: „spam”).', confirmLabel: 'Feloldás',
    });
    http.expectNone(`${API}/repos/8/lock`);
    await click(button('Feloldás', row(8)));
    const unlock = http.expectOne(`${API}/repos/8/lock`);
    expect(unlock.request.method).toBe('DELETE');
    unlock.flush(null);
    await settle();
    reposReq('').flush([R1, { ...R2, locked: false, lockReason: null }]);
    await settle();

    await click(button('Törlés', row(7)));
    expect(ask).toHaveBeenLastCalledWith({
      title: 'Tároló törlése', message: 'A(z) „u12-p-bufe” tároló (diak@x.hu) véglegesen törlődik, a böngészős mentésével együtt. Biztos?',
      confirmLabel: 'Törlés', danger: true,
    });
    const remove = http.expectOne(`${API}/repos/7`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await settle();
    reposReq('').flush([{ ...R2, locked: false, lockReason: null }]);
    await settle();
    expect(rows().length).toBe(1);

    await click(button('Törlés', row(8)));
    fail(http.expectOne(`${API}/repos/8`));
    await settle();
    expect(errorText()).toBe('A művelet nem sikerült.');
    http.expectNone((r) => r.url === `${API}/repos`);
  });
});
