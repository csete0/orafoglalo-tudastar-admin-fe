import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminCsapatokComponent } from './admin-csapatok.component';
import { AdminTeamService } from '../../services/admin/admin-team.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AdminTeamRow } from '../../models/team.model';

const row: AdminTeamRow = {
  id: 5, name: 'Büfé', kind: 'school', status: 'active', groupName: '13.T', members: 3, repoName: 't5-c-bufe', repoSizeKb: 2048, githubRepo: 'diak/bufe',
  githubStatus: 'active', lastSyncStatus: 'diverged', lastSyncAt: '2027-03-12T10:00:00Z', lastError: 'eltér', reviewsThisMonth: 2, reviewCostUsd: 0.05, createdAt: '2027-03-01T10:00:00Z',
};

describe('AdminCsapatokComponent', () => {
  function setup() {
    const api = {
      search: vi.fn(() => of([row])), get: vi.fn(() => of({ team: row, members: [], branches: { 'refs/heads/main': { action: 'diverged', ours: 'a', theirs: 'b', detail: null, at: '' } } })),
      retryMirror: vi.fn(() => of(undefined)), unlink: vi.fn(() => of(undefined)),
    };
    const confirm = { ask: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({ imports: [AdminCsapatokComponent], providers: [{ provide: AdminTeamService, useValue: api }, { provide: ConfirmService, useValue: confirm }] });
    const fixture = TestBed.createComponent(AdminCsapatokComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, confirm };
  }

  it('betöltéskor az összes csapat (a hibaszűrő alapból ki); a sorban a GitHub-repó és az állapot magyarul', async () => {
    const { fixture, el, api } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.search).toHaveBeenCalledWith('', false);
    expect(el.textContent).toContain('diak/bufe');
    expect(el.textContent).toContain('eltért a GitHubon');
  });

  it('részletek: ágak; újrapróbálás és leválasztás megerősítéssel, utána újratölt', async () => {
    const { fixture, c, el, api, confirm } = setup();
    await fixture.whenStable();
    // A részlet és a lista rxResource: a betöltés a változás-észleléskor indul, az érték egy makrotask-kör után érkezik.
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    c.open(row);
    await settle();
    expect(el.textContent).toContain('main');
    c.retry(row);
    await settle();
    expect(api.retryMirror).toHaveBeenCalledWith(5);
    await c.unlink(row);
    await settle();
    expect(confirm.ask).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
    expect(api.unlink).toHaveBeenCalledWith(5);
    expect(api.search).toHaveBeenCalledTimes(3);
  });
});
